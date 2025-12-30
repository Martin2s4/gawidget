import React, { useState, useEffect, useRef } from 'react';
import { ActivityType, UserState, Gender, Message, PartnerRecord } from './types';
import { ACTIVITIES, MOODS, AVATARS, INITIAL_ACTIVITY, ACTIVITY_DEFAULT_MOODS } from './constants';
import { ActivityCard } from './components/ActivityCard';
import { WidgetView } from './components/WidgetView';
import { getHumorousCaption, getSimulatedWeather, WELCOME_PHRASES } from './services/localSync';

// Global Broadcast Channel for P2P Simulation
const syncChannel = new BroadcastChannel('partnersync_v12_final_polish');

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

  // --- Multi-Partner State ---
  const [partners, setPartners] = useState<PartnerRecord[]>(() => {
    const saved = localStorage.getItem('partner_list');
    return saved ? JSON.parse(saved) : [];
  });
  const [activePartnerId, setActivePartnerId] = useState<string | null>(() => localStorage.getItem('active_partner_id'));

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('chat_histories');
    return saved ? JSON.parse(saved) : {};
  });

  const [myState, setMyState] = useState<UserState>(() => {
    const saved = localStorage.getItem('my_state');
    return saved ? JSON.parse(saved) : { id: userId, name: userName || 'Me', avatar: userAvatar, gender: userGender, activity: INITIAL_ACTIVITY };
  });

  // --- UI Control ---
  const [activeTab, setActiveTab] = useState<'status' | 'widget' | 'chat' | 'settings'>('status');
  const [welcomeText, setWelcomeText] = useState('');
  const [humorCaption, setHumorCaption] = useState('Sync engine ready.');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [showMoodDropdown, setShowMoodDropdown] = useState(false);
  const [chatText, setChatText] = useState('');
  const [typingPartnerIds, setTypingPartnerIds] = useState<Set<string>>(new Set());

  const chatEndRef = useRef<HTMLDivElement>(null);
  const partnersRef = useRef(partners);

  // --- Sync References ---
  useEffect(() => { partnersRef.current = partners; }, [partners]);

  // --- Persistence & Theme ---
  useEffect(() => {
    localStorage.setItem('user_id', userId);
    localStorage.setItem('user_name', userName);
    localStorage.setItem('user_gender', userGender);
    localStorage.setItem('user_avatar', userAvatar);
    localStorage.setItem('is_onboarded', isOnboarded.toString());
    localStorage.setItem('my_state', JSON.stringify(myState));
    localStorage.setItem('partner_list', JSON.stringify(partners));
    localStorage.setItem('active_partner_id', activePartnerId || '');
    localStorage.setItem('chat_histories', JSON.stringify(messages));
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('my_room_code', myRoomCode);
    
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [myState, partners, activePartnerId, messages, userName, userGender, userAvatar, isOnboarded, myRoomCode, darkMode, userId]);

  // --- THE MULTI-SYNC ENGINE ---
  useEffect(() => {
    setWelcomeText(WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)]);

    const handleMessage = (event: MessageEvent) => {
      const { type, payload, senderId, senderRoomCode, targetRoomCode } = event.data;
      if (senderId === userId) return;

      const isTargetedToMe = targetRoomCode === myRoomCode;
      const partnerIndex = partnersRef.current.findIndex(p => p.roomCode === senderRoomCode);
      const isFromPartner = partnerIndex !== -1;

      switch (type) {
        case 'P2P_HANDSHAKE':
          if (isTargetedToMe || isFromPartner) {
            setPartners(prev => {
              const existing = prev.find(p => p.id === senderId);
              if (existing) {
                 // Conflict resolution: Latest timestamp wins (if payloads differ in timestamp)
                if (existing.state.activity.timestamp > payload.activity.timestamp) {
                  return prev; // Ignore older updates
                }
                return prev.map(p => p.id === senderId ? { ...p, state: payload, lastSeen: Date.now(), roomCode: senderRoomCode } : p);
              }
              return [...prev, { id: senderId, roomCode: senderRoomCode, state: payload, lastSeen: Date.now() }];
            });

            if (event.data.isInitial && isTargetedToMe) {
              syncChannel.postMessage({
                type: 'P2P_HANDSHAKE',
                payload: myState,
                senderId: userId,
                senderRoomCode: myRoomCode,
                targetRoomCode: senderRoomCode,
                isInitial: false
              });
            }
          }
          break;

        case 'P2P_UPDATE':
          if (isFromPartner) {
            setPartners(prev => prev.map(p => {
              if (p.roomCode === senderRoomCode) {
                 // Conflict resolution: Latest timestamp wins
                 if (p.state.activity.timestamp > payload.activity.timestamp) {
                   return p;
                 }
                 return { ...p, state: payload, lastSeen: Date.now() };
              }
              return p;
            }));
          }
          break;

        case 'P2P_MSG':
          if (isFromPartner && targetRoomCode === myRoomCode) {
            setMessages(prev => ({
              ...prev,
              [senderId]: [...(prev[senderId] || []), payload]
            }));
          }
          break;

        case 'P2P_TYPING':
          if (isFromPartner && targetRoomCode === myRoomCode) {
            setTypingPartnerIds(prev => {
              const next = new Set(prev);
              if (payload) next.add(senderId);
              else next.delete(senderId);
              return next;
            });
          }
          break;

        case 'P2P_UNLINK':
          if (isFromPartner && targetRoomCode === myRoomCode) {
            setPartners(prev => prev.filter(p => p.roomCode !== senderRoomCode));
          }
          break;
      }
    };

    syncChannel.addEventListener('message', handleMessage);
    return () => syncChannel.removeEventListener('message', handleMessage);
  }, [userId, myState, myRoomCode]);

  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, typingPartnerIds]);

  // --- Actions ---
  const broadcastStatus = (updatedState: UserState) => {
    syncChannel.postMessage({
      type: 'P2P_UPDATE',
      payload: updatedState,
      senderId: userId,
      senderRoomCode: myRoomCode
    });
  };

  const regenerateMyCode = () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setMyRoomCode(newCode);
  };

  const handleActivityUpdate = async (type: ActivityType, customText?: string) => {
    let lat, lon;
    try {
      // simulate minimal delay or real fetch if permitted
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 800 })
      );
      lat = pos.coords.latitude; lon = pos.coords.longitude;
    } catch {}

    const weather = getSimulatedWeather(lat, lon);
    
    // Auto-suggest mood based on activity (Feature Requirement #6)
    // If it's a new activity type, switch the mood to the default for that activity.
    const suggestedMood = ACTIVITY_DEFAULT_MOODS[type] || myState.activity.mood;
    
    const caption = getHumorousCaption(type, customText || 'Active', suggestedMood);

    const updated = {
      ...myState,
      name: userName || 'Me',
      gender: userGender,
      avatar: userAvatar,
      activity: { 
        ...myState.activity, 
        type, 
        customText, 
        timestamp: Date.now(), 
        weather,
        mood: suggestedMood, // Apply auto-suggestion
        statusText: 'Updated now' 
      }
    };
    
    setMyState(updated);
    setHumorCaption(caption);
    setShowCustomModal(false);
    broadcastStatus(updated);
  };

  const handleAvatarChange = (emoji: string) => {
    setUserAvatar(emoji);
    const updated = { ...myState, avatar: emoji, name: userName };
    setMyState(updated);
    setShowAvatarPicker(false);
    // Explicitly broadcast a handshake update to force all partners to "recognize" the new face
    syncChannel.postMessage({
      type: 'P2P_HANDSHAKE',
      payload: updated,
      senderId: userId,
      senderRoomCode: myRoomCode,
      isInitial: false
    });
  };

  const updateMood = (moodStr: string) => {
    const updated = { ...myState, activity: { ...myState.activity, mood: moodStr, timestamp: Date.now() } };
    setMyState(updated);
    setShowMoodDropdown(false);
    broadcastStatus(updated);
  };

  const sendText = () => {
    if (!chatText.trim() || !activePartnerId) return;
    const msg: Message = { id: Math.random().toString(36), senderId: userId, text: chatText, timestamp: Date.now() };
    setMessages(prev => ({
      ...prev,
      [activePartnerId]: [...(prev[activePartnerId] || []), msg]
    }));
    setChatText('');
    
    const partner = partners.find(p => p.id === activePartnerId);
    if (partner) {
      syncChannel.postMessage({
        type: 'P2P_MSG',
        payload: msg,
        senderId: userId,
        senderRoomCode: myRoomCode,
        targetRoomCode: partner.roomCode
      });
    }
  };

  const addPartner = () => {
    const code = partnerCodeInput.trim().toUpperCase();
    if (!code || code === myRoomCode) return;

    syncChannel.postMessage({
      type: 'P2P_HANDSHAKE',
      payload: myState,
      senderId: userId,
      senderRoomCode: myRoomCode,
      targetRoomCode: code,
      isInitial: true
    });

    setShowAddPartnerModal(false);
    setPartnerCodeInput('');
  };

  const removePartner = (id: string) => {
    const partner = partners.find(p => p.id === id);
    if (partner) {
      syncChannel.postMessage({
        type: 'P2P_UNLINK',
        senderId: userId,
        senderRoomCode: myRoomCode,
        targetRoomCode: partner.roomCode
      });
    }
    setPartners(prev => prev.filter(p => p.id !== id));
    if (activePartnerId === id) setActivePartnerId(null);
  };

  const activePartner = partners.find(p => p.id === activePartnerId);

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-indigo-600 dark:bg-slate-950 flex items-center justify-center p-8 transition-all duration-500">
        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-w-sm p-10 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-800 rounded-[2.2rem] flex items-center justify-center text-5xl mx-auto mb-4">🛰️</div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none">PartnerSync</h1>
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
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-500 overflow-hidden">
      {/* Navigation Desktop */}
      <nav className="hidden md:flex flex-col w-24 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 py-10 items-center space-y-8 sticky top-0 h-screen">
        <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl">S</div>
        <div className="flex-1 flex flex-col space-y-6">
          {['status', 'widget', 'chat', 'settings'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`p-4 rounded-2xl transition-all relative ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
               {tab === 'status' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
               {tab === 'widget' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>}
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

        {activeTab === 'widget' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in zoom-in-95">
            <div className="w-full flex items-center justify-center space-x-4 mb-4">
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
            />

            <div className="text-center bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-xl w-full max-w-sm">
               <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-500 dark:text-indigo-400 mb-3">Your Global Link</p>
               <p className="text-4xl font-black text-slate-900 dark:text-white tracking-[0.2em]">{myRoomCode}</p>
               <button onClick={regenerateMyCode} className="mt-4 text-[10px] font-black uppercase text-slate-400 hover:text-indigo-500 transition-colors">Rotate Address</button>
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
                  <input type="text" placeholder="Speak your mind..." value={chatText} onFocus={() => broadcastStatus({ ...myState })} onBlur={() => broadcastStatus({ ...myState })} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white outline-none font-bold" />
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

             {/* AVATAR PICKER (Simplified) */}
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
                     <input type="text" placeholder="Your Name" value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold text-lg transition-all shadow-inner" />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <button onClick={() => setUserGender('male')} className={`py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${userGender === 'male' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-50 dark:border-slate-800 text-slate-400'}`}>👨 Masculine Style</button>
                     <button onClick={() => setUserGender('female')} className={`py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${userGender === 'female' ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' : 'border-slate-50 dark:border-slate-800 text-slate-400'}`}>👩 Feminine Style</button>
                   </div>
                </div>
             </section>

             {/* THEME TOGGLE (Dedicated Hub Section) */}
             <section className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border dark:border-slate-800 shadow-xl flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black dark:text-white">Appearance</h3>
                   <p className="text-[10px] font-black uppercase text-slate-400 mt-1">Currently in {darkMode ? 'Dark' : 'Light'} Mode</p>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className={`w-20 h-10 rounded-full transition-all relative p-1 ${darkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-xl transition-transform duration-300 ${darkMode ? 'translate-x-10' : 'translate-x-0'}`}>
                    {darkMode ? '🌙' : '☀️'}
                  </div>
                </button>
             </section>

             {/* PARTNER LIST */}
             <section className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border dark:border-slate-800 shadow-2xl space-y-8">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black dark:text-white">Your Circle</h3>
                    <button onClick={() => setShowAddPartnerModal(true)} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-5 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/20 active:scale-95 transition-all">Connect New</button>
                </div>
                <div className="space-y-4">
                  {partners.map(p => (
                    <div key={p.id} className={`flex items-center justify-between p-6 rounded-[2.5rem] border-2 transition-all ${activePartnerId === p.id ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-900/10' : 'border-slate-50 dark:border-slate-800 bg-slate-50/10 dark:bg-slate-950/20'}`}>
                      <div className="flex items-center space-x-5">
                        <div className="w-14 h-14 rounded-[1.5rem] flex items-center justify-center text-3xl bg-indigo-500 text-white shadow-xl">{p.state.avatar || '👨'}</div>
                        <div>
                          <p className="text-base font-black dark:text-white leading-none">{p.state.name}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 opacity-70">Room: {p.roomCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                         <button onClick={() => setActivePartnerId(p.id)} className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all ${activePartnerId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            {activePartnerId === p.id ? 'Focused' : 'Switch'}
                         </button>
                         <button onClick={() => removePartner(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                         </button>
                      </div>
                    </div>
                  ))}
                  {partners.length === 0 && (
                    <div className="text-center py-16 opacity-40 grayscale flex flex-col items-center">
                      <div className="text-4xl mb-4">🛸</div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Deep Space: No Partners Found</p>
                    </div>
                  )}
                </div>
             </section>
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-t dark:border-slate-800 px-8 py-5 flex items-center justify-around z-50 md:hidden safe-bottom">
        {['status', 'widget', 'chat', 'settings'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === tab ? 'text-indigo-600 scale-110' : 'text-slate-300 dark:text-slate-600'}`}>
            {tab === 'status' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
            {tab === 'widget' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>}
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