import React, { useState, useEffect, useRef } from 'react';
import { ActivityType, UserState, Gender, Message, PartnerRecord, UserActivity } from './types';
import { ACTIVITIES, MOODS, AVATARS, INITIAL_ACTIVITY, ACTIVITY_DEFAULT_MOODS } from './constants';
import { ActivityCard } from './components/ActivityCard';
import { WidgetView } from './components/WidgetView';
import { getHumorousCaption, getSimulatedWeather, getRealWeather, WELCOME_PHRASES } from './services/localSync';
import { db, auth } from './services/firebase';
import { doc, onSnapshot, setDoc, updateDoc, collection, query, where, getDocs, addDoc, orderBy, limit, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';

const App: React.FC = () => {
  // --- User Identity ---
  const [userId] = useState(() => localStorage.getItem('user_id') || Math.random().toString(36).substring(2, 9));
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || '');
  const [userGender, setUserGender] = useState<Gender>(() => (localStorage.getItem('user_gender') as Gender) || 'male');
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem('user_avatar') || '👨');
  
  const [myRoomCode, setMyRoomCode] = useState(() => {
    const saved = localStorage.getItem('my_room_code');
    if (saved) return saved;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('my_room_code', newCode);
    return newCode;
  });

  const [isOnboarded, setIsOnboarded] = useState(() => localStorage.getItem('is_onboarded') === 'true');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notifications_enabled') === 'true');

  // --- Multi-Partner State ---
  const [partnerIds, setPartnerIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('partner_ids_list');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [partners, setPartners] = useState<PartnerRecord[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(() => localStorage.getItem('active_partner_id'));

  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  
  const [myState, setMyState] = useState<UserState>(() => {
    const saved = localStorage.getItem('my_state');
    return saved ? JSON.parse(saved) : { id: userId, name: userName || 'Me', avatar: userAvatar, gender: userGender, activity: { ...INITIAL_ACTIVITY, caption: 'Just getting started! 🚀' } };
  });

  // --- UI Control ---
  const [activeTab, setActiveTab] = useState<'status' | 'chat' | 'settings'>('status');
  const [welcomeText, setWelcomeText] = useState('');
  const [humorCaption, setHumorCaption] = useState('Cloud sync active.');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [showMoodDropdown, setShowMoodDropdown] = useState(false);
  const [chatText, setChatText] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Flag to ensure we don't try to sync until Auth is ready (fixes permission errors)
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // NOTE: Typing indicators require more complex Firestore logic (presence), skipping for MVP to save writes
  const [typingPartnerIds] = useState<Set<string>>(new Set());

  // --- Notification Refs ---
  // Store previous states to detect changes and prevent notification spam on load
  const prevPartnerStates = useRef<Record<string, UserActivity>>({});
  const initialLoadTime = useRef(Date.now());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Persistence & Theme ---
  useEffect(() => {
    localStorage.setItem('user_id', userId);
    localStorage.setItem('user_name', userName);
    localStorage.setItem('user_gender', userGender);
    localStorage.setItem('user_avatar', userAvatar);
    localStorage.setItem('is_onboarded', isOnboarded.toString());
    localStorage.setItem('my_state', JSON.stringify(myState));
    localStorage.setItem('partner_ids_list', JSON.stringify(partnerIds));
    localStorage.setItem('active_partner_id', activePartnerId || '');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('my_room_code', myRoomCode);
    localStorage.setItem('notifications_enabled', notificationsEnabled.toString());
    
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [myState, partnerIds, activePartnerId, userName, userGender, userAvatar, isOnboarded, myRoomCode, darkMode, userId, notificationsEnabled]);

  // --- PWA Install Prompt Listener ---
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log("Install prompt captured");
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  // --- Initial Weather Fetch ---
  useEffect(() => {
    if (!isOnboarded) return;
    
    // Fetch weather on mount
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const weather = await getRealWeather(pos.coords.latitude, pos.coords.longitude);
      setMyState(prev => ({
        ...prev,
        activity: { ...prev.activity, weather }
      }));
    }, (err) => {
      console.warn("Weather init failed (likely perms), using simulation", err);
      const weather = getSimulatedWeather();
      setMyState(prev => ({
        ...prev,
        activity: { ...prev.activity, weather }
      }));
    }, { timeout: 10000 });
  }, [isOnboarded]);

  // --- Utility: Notifications ---
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationsEnabled(true);
      new Notification("Notifications Enabled", { body: "You will now see updates from your partners!" });
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (notificationsEnabled && Notification.permission === "granted") {
      // Only notify if the app is hidden OR we are notifying about something not currently in focus
      if (document.visibilityState === 'hidden' || options?.tag === 'background-update') {
        new Notification(title, {
             icon: '/android-chrome-192x192.png',
             badge: '/android-chrome-192x192.png',
             ...options
        });
      }
    }
  };

  // --- FIREBASE AUTH & SYNC ENGINE ---

  // 0. Authenticate
  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      return;
    }
    signInAnonymously(auth)
      .then(() => {
        console.log("🔥 Authenticated anonymously");
        setIsAuthReady(true);
      })
      .catch((err) => {
        console.error("Auth failed:", err);
        setIsAuthReady(true); 
      });
  }, []);

  // 1. Publish Myself to Cloud
  useEffect(() => {
    if (!db || !isAuthReady) return;
    const userRef = doc(db, 'users', userId);
    
    // Sanitize payload
    const activityPayload = {
        ...myState.activity,
        customText: myState.activity.customText ?? null,
        weather: myState.activity.weather ?? null,
        caption: myState.activity.caption || null
    };

    const payload = { 
        ...myState, 
        activity: activityPayload,
        roomCode: myRoomCode, 
        lastUpdated: Date.now() 
    };
    
    setDoc(userRef, payload, { merge: true }).catch(err => console.error("Sync failed:", err));
  }, [myState, myRoomCode, userId, isAuthReady]);

  // 1.5 Listen to MYSELF for Incoming Connections
  useEffect(() => {
    if (!db || !isAuthReady) return;
    
    const unsub = onSnapshot(doc(db, 'users', userId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as UserState;
            if (data.partners && Array.isArray(data.partners)) {
                setPartnerIds(prev => {
                    const localBots = prev.filter(id => id.startsWith('local_'));
                    const cloudPartners = data.partners || [];
                    const merged = Array.from(new Set([...localBots, ...cloudPartners]));
                    
                    if (merged.length !== prev.length || !merged.every(val => prev.includes(val))) {
                        return merged;
                    }
                    return prev;
                });
            }
        }
    });
    return () => unsub();
  }, [userId, isAuthReady]);

  // 2. Subscribe to Partners & NOTIFY Status Updates
  useEffect(() => {
    if (!db || !isAuthReady || partnerIds.length === 0) {
        if (partnerIds.length === 0) setPartners([]);
        return;
    }

    const unsubs = partnerIds.map(pid => {
       if (pid.startsWith('local_')) return () => {};

       return onSnapshot(doc(db, 'users', pid), (docSnap) => {
         if (docSnap.exists()) {
           const data = docSnap.data() as UserState & { roomCode: string };
           
           // --- Notification Logic ---
           const prev = prevPartnerStates.current[pid];
           const current = data.activity;
           
           // Only notify if we have a previous state to compare to (prevents initial load spam)
           // AND the update is recent (within last 10 seconds to avoid stale updates on reconnect)
           if (prev && (Date.now() - current.timestamp < 10000)) {
               const hasChanged = prev.type !== current.type || prev.customText !== current.customText || prev.mood !== current.mood;
               
               if (hasChanged && notificationsEnabled) {
                   const statusText = current.type === ActivityType.CUSTOM ? (current.customText || 'Something cool') : current.type;
                   sendNotification(`${data.name} updated status`, {
                       body: `Now: ${statusText} ${current.mood}`,
                       tag: 'background-update'
                   });
               }
           }
           
           // Update Ref
           prevPartnerStates.current[pid] = current;
           // --------------------------

           setPartners(prevPartners => {
             const others = prevPartners.filter(p => p.id !== pid);
             return [...others, { id: pid, roomCode: data.roomCode, state: data, lastSeen: Date.now() }];
           });
         }
       }, (error) => {
         console.warn(`Sync warning for ${pid}:`, error);
       });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [partnerIds, isAuthReady, notificationsEnabled]);

  // 3. Subscribe to Chat & NOTIFY Messages
  useEffect(() => {
    if (!db || !isAuthReady || !activePartnerId || activePartnerId.startsWith('local_')) return;

    const chatId = [userId, activePartnerId].sort().join('_');
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));

    const unsub = onSnapshot(q, (snapshot) => {
       const msgs: Message[] = [];
       snapshot.forEach(doc => msgs.push(doc.data() as Message));
       
       // --- Notification Logic ---
       snapshot.docChanges().forEach((change) => {
           if (change.type === "added") {
               const newMsg = change.doc.data() as Message;
               // Only notify if:
               // 1. It's a new message (created after app load)
               // 2. Sender is not me
               // 3. Notifications enabled
               // 4. Tab is not 'chat' OR document is hidden (user is not looking)
               if (newMsg.timestamp > initialLoadTime.current && 
                   newMsg.senderId !== userId && 
                   notificationsEnabled &&
                   (activeTab !== 'chat' || document.visibilityState === 'hidden')
               ) {
                   // Find sender name
                   const sender = partners.find(p => p.id === newMsg.senderId)?.state.name || "Partner";
                   sendNotification(sender, {
                       body: newMsg.text,
                       tag: 'message'
                   });
               }
           }
       });
       // --------------------------

       setMessages(prev => ({ ...prev, [activePartnerId]: msgs }));
    }, (error) => {
      console.error("Chat sync error:", error);
    });

    return () => unsub();
  }, [activePartnerId, userId, isAuthReady, notificationsEnabled, activeTab, partners]);

  useEffect(() => {
    setWelcomeText(WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)]);
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  // --- Actions ---

  const regenerateMyCode = () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setMyRoomCode(newCode);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(myRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
        console.log("No install prompt available");
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleClearData = () => {
    if (window.confirm("⚠️ Clear all local data?\n\nThis will reset your profile and require you to set up your account again. This action cannot be undone.")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleActivityUpdate = (type: ActivityType, customText?: string) => {
    const suggestedMood = ACTIVITY_DEFAULT_MOODS[type] || myState.activity.mood;
    const caption = getHumorousCaption(type, customText || 'Active', suggestedMood);
    const timestamp = Date.now();

    const optimisticActivity = { 
        ...myState.activity, 
        type, 
        customText: customText ?? null, 
        timestamp, 
        mood: suggestedMood,
        statusText: 'Updated now',
        caption: caption
    };

    const nextState = {
      ...myState,
      name: userName || 'Me',
      gender: userGender,
      avatar: userAvatar,
      activity: optimisticActivity
    };
    
    setMyState(nextState);
    setHumorCaption(caption);
    setShowCustomModal(false);

    // Background Weather Fetch with Open-Meteo
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const weather = await getRealWeather(pos.coords.latitude, pos.coords.longitude);
      setMyState(current => {
        if (current.activity.timestamp === timestamp) {
           return { ...current, activity: { ...current.activity, weather } };
        }
        return current;
      });
    }, () => {
       const weather = getSimulatedWeather(); 
       setMyState(current => {
        if (current.activity.timestamp === timestamp) {
           return { ...current, activity: { ...current.activity, weather } };
        }
        return current;
      });
    }, { timeout: 10000 });
  };

  const handleAvatarChange = (emoji: string) => {
    setUserAvatar(emoji);
    setMyState(prev => ({ 
      ...prev, 
      avatar: emoji, 
      activity: { ...prev.activity, timestamp: Date.now() }
    }));
    setShowAvatarPicker(false);
  };

  const handleGenderChange = (selectedGender: Gender) => {
    // Auto-switch avatar based on selected gender
    const newAvatar = selectedGender === 'male' ? '👨' : '👩';
    setUserGender(selectedGender);
    setUserAvatar(newAvatar);
    
    setMyState(prev => ({ 
      ...prev, 
      gender: selectedGender, 
      avatar: newAvatar,
      activity: { ...prev.activity, timestamp: Date.now() }
    }));
  };

  const handleNameBlur = () => {
    if (userName !== myState.name) {
      setMyState(prev => ({ 
        ...prev, 
        name: userName,
        activity: { ...prev.activity, timestamp: Date.now() }
      }));
    }
  };

  const updateMood = (moodStr: string) => {
    setMyState(prev => ({ ...prev, activity: { ...prev.activity, mood: moodStr, timestamp: Date.now() } }));
    setShowMoodDropdown(false);
  };

  const sendText = async () => {
    if (!chatText.trim() || !activePartnerId || !db) return;
    
    const msg: Message = { 
      id: Math.random().toString(36), 
      senderId: userId, 
      text: chatText, 
      timestamp: Date.now() 
    };
    
    setMessages(prev => ({
      ...prev,
      [activePartnerId]: [...(prev[activePartnerId] || []), msg]
    }));
    setChatText('');
    
    if (!activePartnerId.startsWith('local_')) {
        const chatId = [userId, activePartnerId].sort().join('_');
        try {
          await addDoc(collection(db, 'chats', chatId, 'messages'), msg);
        } catch(e) {
          console.error("Error sending message", e);
        }
    }
  };

  const addPartner = async () => {
    const code = partnerCodeInput.trim().toUpperCase();
    if (!code || code === myRoomCode || !db) return;

    try {
      const q = query(collection(db, 'users'), where('roomCode', '==', code));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert("No partner found with that Room Code!");
        return;
      }
      
      let foundPartnerId = "";
      querySnapshot.forEach(doc => {
        foundPartnerId = doc.id;
      });

      if (foundPartnerId === userId) {
        alert("You cannot add yourself!");
        return;
      }

      const myRef = doc(db, 'users', userId);
      await updateDoc(myRef, {
        partners: arrayUnion(foundPartnerId)
      });

      const partnerRef = doc(db, 'users', foundPartnerId);
      await updateDoc(partnerRef, {
        partners: arrayUnion(userId)
      });

      setActivePartnerId(foundPartnerId);
      setShowAddPartnerModal(false);
      setPartnerCodeInput('');
      alert("✅ Linked successfully! You should now appear on each other's devices.");

    } catch(e) {
      console.error("Error finding partner", e);
      alert("Error connecting to cloud. Check console for details.");
    }
  };

  const removePartner = async (id: string) => {
    if (!window.confirm("Permanently remove this partner from your list?")) return;

    setPartnerIds(prev => prev.filter(pid => pid !== id));
    setPartners(prev => prev.filter(p => p.id !== id));
    if (activePartnerId === id) setActivePartnerId(null);

    // Also remove from cloud to prevent re-sync
    if (db) {
        try {
            const myRef = doc(db, 'users', userId);
            await updateDoc(myRef, {
                partners: arrayRemove(id)
            });
        } catch (e) {
            console.error("Error removing partner from cloud", e);
        }
    }
  };

  const clearChat = async () => {
    if (!activePartnerId || !db) return;
    if (!window.confirm("🗑️ Delete entire chat history with this partner?")) return;

    // Optimistic clear
    setMessages(prev => ({
      ...prev,
      [activePartnerId]: []
    }));

    if (!activePartnerId.startsWith('local_')) {
        const chatId = [userId, activePartnerId].sort().join('_');
        try {
            const msgsRef = collection(db, 'chats', chatId, 'messages');
            const snap = await getDocs(msgsRef);
            // Batch delete (or loop since batch limited to 500, but simple loop fine for now)
            const batchPromises = snap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(batchPromises);
        } catch(e) {
            console.error("Error clearing cloud chat", e);
        }
    }
  };

  const activePartner = partners.find(p => p.id === activePartnerId);
  const partnerOnline = activePartner ? (Date.now() - activePartner.lastSeen < 120000) : false; // 2 min threshold

  // --- Render ---

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-indigo-600 dark:bg-slate-950 flex items-center justify-center p-8 transition-all duration-500">
        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-w-sm p-10 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-800 rounded-[2.2rem] flex items-center justify-center text-5xl mx-auto mb-4">🛰️</div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none">Sync</h1>
            <p className="text-slate-400 font-bold mt-2 text-xs uppercase tracking-widest">Setup Your Profile</p>
          </div>
          <div className="space-y-6">
            <input type="text" placeholder="What's your name?" value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold text-lg" />
            <button onClick={() => userName && setIsOnboarded(true)} className="w-full py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black text-xl shadow-xl active:scale-95 transition-all">Start Syncing</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-500 overflow-hidden relative">
      
      {/* --- FLOATING INSTALL BUTTON (BACKUP) --- */}
      {!isStandalone && deferredPrompt && (
         <button
           onClick={handleInstallClick}
           className="fixed bottom-24 right-6 z-[100] flex items-center gap-3 bg-indigo-600 text-white pl-5 pr-6 py-4 rounded-full shadow-2xl shadow-indigo-500/40 animate-bounce font-black uppercase tracking-widest text-xs border-2 border-white dark:border-slate-800 hover:scale-105 active:scale-95 transition-all"
         >
           <span className="text-xl">📲</span>
           <span>Add Widget</span>
         </button>
      )}

      {/* Navigation Desktop */}
      <nav className="hidden md:flex flex-col w-24 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 py-10 items-center space-y-8 sticky top-0 h-screen">
        <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl">S</div>
        <div className="flex-1 flex flex-col space-y-6">
          {['status', 'chat', 'settings'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`p-4 rounded-2xl transition-all relative ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
               {tab === 'status' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
               {tab === 'chat' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
               {tab === 'settings' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
               {tab === 'chat' && partners.length > 0 && <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></div>}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto p-6 md:p-12 pb-32 overflow-y-auto">
        {activeTab === 'status' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2">{userName}, {welcomeText}</h2>
                <div className="flex items-center space-x-3 relative">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">I feel:</p>
                  <button onClick={() => setShowMoodDropdown(!showMoodDropdown)} className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm font-bold text-slate-700 dark:text-slate-200">
                    {myState.activity.mood}
                  </button>
                  {showMoodDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[100] p-2">
                      {MOODS.map(m => (
                        <button key={m.label} onClick={() => updateMood(`${m.emoji} ${m.label}`)} className="flex items-center space-x-3 w-full p-3 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-colors">
                          <span className="text-xl">{m.emoji}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 flex items-center justify-center text-2xl transition-all hover:scale-105 active:scale-95 group">
                <span className="group-hover:rotate-12 transition-transform">{darkMode ? '🌙' : '☀️'}</span>
              </button>
            </header>

            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 block">Vibe Check</span>
              <p className="text-2xl font-bold italic">"{humorCaption}"</p>
            </div>

            {/* --- WIDGET SECTION --- */}
            <div className="flex flex-col items-center justify-center space-y-6">
                <div className="w-full flex items-center justify-center space-x-4">
                   {partners.length > 0 ? (
                     <div className="flex -space-x-4">
                       {partners.map(p => (
                         <button 
                           key={p.id} 
                           onClick={() => setActivePartnerId(p.id)}
                           className={`w-14 h-14 rounded-full border-4 border-slate-50 dark:border-slate-950 text-2xl flex items-center justify-center transition-all ${activePartnerId === p.id ? 'scale-125 z-10 shadow-2xl ring-2 ring-indigo-500 ring-offset-4 dark:ring-offset-slate-950' : 'bg-white dark:bg-slate-800 grayscale opacity-40 hover:opacity-80'}`}
                         >
                           {p.state.avatar || '👨'}
                         </button>
                       ))}
                     </div>
                   ) : (
                     <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">Add a partner to sync</p>
                   )}
                </div>

                <WidgetView 
                  userA={myState} 
                  userB={activePartner?.state || { id: 'none', name: 'Partner', gender: 'male', activity: { ...INITIAL_ACTIVITY, statusText: 'Disconnected', mood: '😴 Offline' } }} 
                  onActivityChange={handleActivityUpdate} 
                  onMoodChange={updateMood}
                  showInstall={!isStandalone && !!deferredPrompt}
                  onInstall={handleInstallClick}
                  partnerOnline={partnerOnline}
                />
            </div>
            {/* --- END WIDGET SECTION --- */}

            <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800">
               <div className="flex justify-between items-center mb-6 px-2">
                 <span className="text-sm font-black uppercase tracking-widest text-slate-400">Select Activity</span>
               </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                {ACTIVITIES.map(act => (
                  <ActivityCard key={act.type} {...act} isSelected={myState.activity.type === act.type} onClick={() => act.type === ActivityType.CUSTOM ? setShowCustomModal(true) : handleActivityUpdate(act.type)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[70vh] animate-in slide-in-from-bottom-5">
             <div className="flex items-center space-x-2 mb-4 overflow-x-auto py-2 no-scrollbar px-2">
                {partners.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => setActivePartnerId(p.id)}
                    className={`flex items-center space-x-3 px-5 py-2.5 rounded-2xl border transition-all shrink-0 ${activePartnerId === p.id ? 'bg-indigo-600 border-indigo-600 text-white font-black shadow-lg shadow-indigo-500/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold'}`}
                  >
                    <span className="text-lg">{p.state.avatar || '👨'}</span>
                    <span className="text-xs">{p.state.name}</span>
                  </button>
                ))}
                {partners.length === 0 && <p className="text-xs text-slate-400 font-black ml-4">No active chats...</p>}
             </div>

             {activePartner ? (
               <div className="flex-1 bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
                <div className="px-8 py-5 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-2xl shadow-inner border-2 border-white dark:border-slate-800">
                      {activePartner.state.avatar || '👨'}
                    </div>
                    <div>
                      <h4 className="text-base font-black dark:text-white leading-none">{activePartner.state.name}</h4>
                      <div className="flex items-center mt-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1.5"></div>
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* DELETE CHAT BUTTON */}
                  <button onClick={clearChat} className="p-2 text-slate-400 hover:text-rose-500 transition-colors bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700" title="Clear Chat">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 p-8 chat-scrollbar bg-slate-50/10 dark:bg-slate-950/10">
                   {(messages[activePartnerId!] || []).map(msg => (
                     <div key={msg.id} className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-5 py-3 rounded-[2rem] text-sm font-semibold shadow-sm ${msg.senderId === userId ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border dark:border-slate-700'}`}>
                           {msg.text}
                        </div>
                     </div>
                   ))}
                   {typingPartnerIds.has(activePartnerId!) && <div className="text-[10px] font-black text-slate-400 italic ml-2">Typing...</div>}
                   <div ref={chatEndRef} />
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex gap-3">
                  <input type="text" placeholder="Speak your mind..." value={chatText} onFocus={() => handleActivityUpdate(myState.activity.type)} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white outline-none font-bold" />
                  <button onClick={sendText} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black active:scale-95 transition-all shadow-xl shadow-indigo-500/20">Send</button>
                </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3.5rem] p-12 border dark:border-slate-800 text-center opacity-80">
                  <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-5xl mb-6 shadow-inner">🛰️</div>
                  <h3 className="text-2xl font-black dark:text-white mb-2">Sync Your Circle</h3>
                  <p className="text-slate-400 font-bold text-sm max-w-[200px]">Link a partner in the Hub to start the conversation.</p>
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-10 animate-in slide-in-from-right-4">
             <header>
               <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">The Hub</h2>
               <p className="text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">Personalize & Connect</p>
             </header>

             {/* AVATAR PICKER */}
             <section className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-xl flex flex-col items-center gap-6">
                <button 
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-7xl shadow-2xl border-4 border-white dark:border-slate-700 hover:scale-105 active:scale-95 transition-all ring-8 ring-indigo-500/5"
                >
                  {userAvatar}
                </button>
                
                {showAvatarPicker ? (
                  <div className="grid grid-cols-5 sm:grid-cols-8 gap-3 w-full animate-in slide-in-from-top-4 fade-in duration-300">
                    {AVATARS.map(emoji => (
                      <button 
                        key={emoji} 
                        onClick={() => handleAvatarChange(emoji)}
                        className={`text-3xl p-3 rounded-2xl transition-all ${userAvatar === emoji ? 'bg-indigo-100 dark:bg-indigo-900/30 scale-110 ring-2 ring-indigo-500' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tap avatar to change</span>
                )}
             </section>

             {/* IDENTITY SETTINGS */}
             <section className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border dark:border-slate-800 shadow-xl space-y-6">
                <h3 className="text-xl font-black dark:text-white">Identity</h3>
                <div className="space-y-4">
                   <div className="space-y-2">
                     <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-600 ml-2">Display Name</span>
                     <input type="text" placeholder="Your Name" value={userName} onChange={e => setUserName(e.target.value)} onBlur={handleNameBlur} className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold text-lg transition-all shadow-inner" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <button onClick={() => handleGenderChange('male')} className={`py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${userGender === 'male' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-50 dark:border-slate-800 text-slate-400'}`}>Male</button>
                     <button onClick={() => handleGenderChange('female')} className={`py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${userGender === 'female' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-50 dark:border-slate-800 text-slate-400'}`}>Female</button>
                   </div>
                </div>
             </section>

             {/* CONNECTION HUB (YOUR CIRCLE + YOUR CODE) */}
             <section className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border dark:border-slate-800 shadow-2xl space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black dark:text-white">Connection Hub</h3>
                </div>

                {/* YOUR CODE DISPLAY */}
                <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-[2.5rem] flex flex-col items-center justify-center border-2 border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                   <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 mb-2">Share Your Room Code</p>
                   
                   <div className="flex items-center gap-2 mb-3 z-10">
                      <p className="text-4xl font-black text-slate-900 dark:text-white tracking-[0.2em]">{myRoomCode}</p>
                      <button 
                        onClick={handleCopyCode}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all active:scale-95"
                        title="Copy Code"
                      >
                        {copied ? (
                          <span className="text-lg">✅</span> 
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        )}
                      </button>
                   </div>

                   <button onClick={regenerateMyCode} className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-500 transition-colors z-10">Rotate Address</button>
                   <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </div>

                {/* PARTNER LIST */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Connected Partners</span>
                     <button onClick={() => setShowAddPartnerModal(true)} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all">Connect New</button>
                  </div>

                  {partners.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-5 rounded-[2.5rem] border-2 transition-all ${activePartnerId === p.id ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-900/10' : 'border-slate-50 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-950/20'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-2xl bg-indigo-500 text-white shadow-md">{p.state.avatar || '👨'}</div>
                        <div>
                          <p className="text-sm font-black dark:text-white leading-none">{p.state.name}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">Room: {p.roomCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                         <button onClick={() => setActivePartnerId(p.id)} className={`text-[9px] font-black px-3 py-2 rounded-xl transition-all ${activePartnerId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            {activePartnerId === p.id ? 'Active' : 'View'}
                         </button>
                         <button onClick={() => removePartner(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors" title="Permanently Remove">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </div>
                    </div>
                  ))}
                  {partners.length === 0 && (
                    <div className="text-center py-10 opacity-40 grayscale flex flex-col items-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                      <div className="text-3xl mb-2">🛸</div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Deep Space: No Partners</p>
                    </div>
                  )}
                </div>
             </section>

             {/* THEME & SYSTEM */}
             <section className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border dark:border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                       <h3 className="text-xl font-black dark:text-white">System</h3>
                       <p className="text-[10px] font-black uppercase text-slate-400 mt-1">App Settings</p>
                    </div>
                </div>
                
                <div className="flex items-center justify-between">
                   <div>
                       <h4 className="font-bold dark:text-white">Dark Mode</h4>
                       <p className="text-[10px] font-black uppercase text-slate-400">Toggle Theme</p>
                   </div>
                   <button 
                      onClick={() => setDarkMode(!darkMode)}
                      className={`w-16 h-8 rounded-full transition-all relative p-1 ${darkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md transition-transform duration-300 ${darkMode ? 'translate-x-8' : 'translate-x-0'}`}>
                        {darkMode ? '🌙' : '☀️'}
                      </div>
                    </button>
                </div>

                {/* Notifications Toggle */}
                <div className="flex items-center justify-between pt-4 border-t dark:border-slate-800">
                   <div>
                       <h4 className="font-bold dark:text-white">Notifications</h4>
                       <p className="text-[10px] font-black uppercase text-slate-400">Status & Messages</p>
                   </div>
                   <button 
                      onClick={() => notificationsEnabled ? setNotificationsEnabled(false) : requestNotificationPermission()}
                      className={`w-16 h-8 rounded-full transition-all relative p-1 ${notificationsEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <div className={`w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-md transition-transform duration-300 ${notificationsEnabled ? 'translate-x-8' : 'translate-x-0'}`}>
                        {notificationsEnabled ? '🔔' : '🔕'}
                      </div>
                    </button>
                </div>

                <div className="pt-6 border-t dark:border-slate-800">
                    {!isStandalone && deferredPrompt && (
                         <div className="mt-2">
                             <button 
                               onClick={handleInstallClick}
                               className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                             >
                               <span className="text-lg">📲</span> Add to Home Screen
                             </button>
                         </div>
                    )}
                    {isStandalone && (
                         <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">✨ App Installed</p>
                         </div>
                    )}
                </div>
             </section>

             {/* DATA & STORAGE */}
             <section className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border dark:border-slate-800 shadow-xl space-y-6">
                <h3 className="text-xl font-black dark:text-white text-rose-500">Danger Zone</h3>
                
                <div className="flex items-center justify-between">
                   <div>
                       <h4 className="font-bold dark:text-white">Reset App</h4>
                       <p className="text-[10px] font-black uppercase text-slate-400">Clear all local data</p>
                   </div>
                   <button 
                      onClick={handleClearData}
                      className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                    >
                      Clear Data
                    </button>
                </div>
             </section>

             <div className="pb-10 text-center opacity-30">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Version 1.3.2 • Cloud Sync</p>
             </div>
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-t dark:border-slate-800 px-8 py-5 flex items-center justify-around z-50 md:hidden safe-bottom">
        {['status', 'chat', 'settings'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === tab ? 'text-indigo-600 scale-110' : 'text-slate-300 dark:text-slate-600'}`}>
            {tab === 'status' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
            {tab === 'chat' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            {tab === 'settings' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            <span className="text-[9px] font-black uppercase tracking-wider">{tab}</span>
            {tab === 'chat' && partners.length > 0 && <div className="absolute top-0 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 shadow-lg"></div>}
          </button>
        ))}
      </nav>

      {/* Modals remain robust... */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl border dark:border-slate-800">
              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner ring-8 ring-indigo-500/5">🔗</div>
                <h3 className="text-3xl font-black dark:text-white leading-tight">Sync Circle</h3>
                <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-[0.2em]">Enter Partner Room ID</p>
              </div>
              <input autoFocus type="text" maxLength={6} placeholder="ABC123" value={partnerCodeInput} onChange={e => setPartnerCodeInput(e.target.value.toUpperCase())} className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none rounded-3xl font-black text-center text-4xl tracking-[0.25em] mb-8 shadow-inner" />
              <div className="flex gap-4">
                <button onClick={() => setShowAddPartnerModal(false)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-xs hover:text-rose-500 transition-colors">Cancel</button>
                <button onClick={addPartner} disabled={!partnerCodeInput} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs">Establish Link</button>
              </div>
           </div>
        </div>
      )}

      {/* Custom Status Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3.5rem] p-10 shadow-2xl border dark:border-slate-800">
              <div className="text-center mb-8">
                <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner ring-8 ring-indigo-500/5">✨</div>
                <h3 className="text-3xl font-black dark:text-white leading-tight">Custom Status</h3>
                <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-[0.2em]">Describe the current vibe</p>
              </div>
              <input autoFocus type="text" maxLength={20} value={customInputValue} onChange={e => setCustomInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && customInputValue && handleActivityUpdate(ActivityType.CUSTOM, customInputValue)} className="w-full p-6 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none rounded-3xl font-black text-center text-xl mb-8 shadow-inner" />
              <div className="flex gap-4">
                <button onClick={() => setShowCustomModal(false)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-xs hover:text-rose-500 transition-colors">Dismiss</button>
                <button onClick={() => handleActivityUpdate(ActivityType.CUSTOM, customInputValue)} disabled={!customInputValue.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest text-xs">Post</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;