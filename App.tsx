
import React, { useState, useEffect, useRef } from 'react';
import { ActivityType, UserState, Gender, Message } from './types';
import { ACTIVITIES, MOODS, INITIAL_ACTIVITY } from './constants';
import { ActivityCard } from './components/ActivityCard';
import { WidgetView } from './components/WidgetView';
import { getHumorousCaption, getSimulatedWeather, WELCOME_PHRASES } from './services/localSync';

// Peer-to-Peer Sync Channel - Version 5 (Stable Handshake)
const syncChannel = new BroadcastChannel('partnersync_v5_core');

const App: React.FC = () => {
  // --- Core Identity ---
  const [userId] = useState(() => localStorage.getItem('user_id') || Math.random().toString(36).substring(2, 9));
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || '');
  const [userGender, setUserGender] = useState<Gender>(() => (localStorage.getItem('user_gender') as Gender) || 'male');
  const [pairingCode, setPairingCode] = useState(() => localStorage.getItem('my_pairing_code') || (Math.random().toString(36).substring(2, 5).toUpperCase() + Math.floor(Math.random() * 900 + 100)));
  const [isOnboarded, setIsOnboarded] = useState(() => localStorage.getItem('is_onboarded') === 'true');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // --- Sync & Messaging ---
  const [partnerState, setPartnerState] = useState<UserState | null>(() => {
    const saved = localStorage.getItem('partner_state');
    return saved ? JSON.parse(saved) : null;
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [myState, setMyState] = useState<UserState>(() => {
    const saved = localStorage.getItem('my_state');
    return saved ? JSON.parse(saved) : { id: userId, name: userName || 'Me', gender: userGender, activity: INITIAL_ACTIVITY };
  });

  // --- UI Control ---
  const [activeTab, setActiveTab] = useState<'status' | 'widget' | 'chat' | 'settings'>('status');
  const [welcomeText, setWelcomeText] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [humorCaption, setHumorCaption] = useState('Everything is in sync.');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [showMoodDropdown, setShowMoodDropdown] = useState(false);
  const [chatText, setChatText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Persistence & Theme Application ---
  useEffect(() => {
    localStorage.setItem('user_id', userId);
    localStorage.setItem('user_name', userName);
    localStorage.setItem('user_gender', userGender);
    localStorage.setItem('my_pairing_code', pairingCode);
    localStorage.setItem('is_onboarded', isOnboarded.toString());
    localStorage.setItem('my_state', JSON.stringify(myState));
    localStorage.setItem('partner_state', JSON.stringify(partnerState));
    localStorage.setItem('chat_history', JSON.stringify(messages));
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [myState, partnerState, messages, userName, userGender, isOnboarded, pairingCode, darkMode]);

  // --- THE SYNC ENGINE (Core Logic) ---
  useEffect(() => {
    setWelcomeText(WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)]);

    const handleMessage = (event: MessageEvent) => {
      const { type, payload, senderId, targetCode } = event.data;
      
      // Safety Checks
      if (senderId === userId) return; // Don't listen to ourselves
      if (pairingCode !== targetCode) return; // Not our "room"

      switch (type) {
        case 'STATUS_SYNC':
          setPartnerState(payload);
          break;
        case 'CHAT_MSG':
          setMessages(prev => [...prev, payload]);
          break;
        case 'TYPING_INDICATOR':
          setIsPartnerTyping(payload);
          break;
        case 'CHAT_CLEAR':
          setMessages([]);
          break;
        case 'HANDSHAKE_REQ':
          // Someone entered our code! Save them and reply so they save us.
          setPartnerState(payload);
          syncChannel.postMessage({
            type: 'HANDSHAKE_RES',
            payload: myState,
            senderId: userId,
            targetCode: pairingCode
          });
          break;
        case 'HANDSHAKE_RES':
          // They accepted our handshake!
          setPartnerState(payload);
          setIsLinking(false);
          break;
      }
    };

    syncChannel.addEventListener('message', handleMessage);
    return () => syncChannel.removeEventListener('message', handleMessage);
  }, [userId, pairingCode, myState]);

  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, isPartnerTyping]);

  // --- App Actions ---
  const triggerUpdate = async (type: ActivityType, customText?: string) => {
    let lat, lon;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 1500 })
      );
      lat = pos.coords.latitude; lon = pos.coords.longitude;
    } catch {}

    const weather = getSimulatedWeather(lat, lon);
    const caption = getHumorousCaption(type, customText || 'Active', myState.activity.mood);

    const newState = {
      ...myState,
      name: userName || 'Me',
      gender: userGender,
      activity: { 
        ...myState.activity, 
        type, 
        customText, 
        timestamp: Date.now(), 
        weather,
        statusText: 'Just now' 
      }
    };
    
    setMyState(newState);
    setHumorCaption(caption);
    setShowCustomModal(false);
    
    // Broadcast immediately
    syncChannel.postMessage({ type: 'STATUS_SYNC', payload: newState, senderId: userId, targetCode: pairingCode });
  };

  const handleMoodSelect = (moodStr: string) => {
    const newState = { ...myState, activity: { ...myState.activity, mood: moodStr, timestamp: Date.now() } };
    setMyState(newState);
    setShowMoodDropdown(false);
    syncChannel.postMessage({ type: 'STATUS_SYNC', payload: newState, senderId: userId, targetCode: pairingCode });
  };

  const setTyping = (isTyping: boolean) => {
    syncChannel.postMessage({ type: 'TYPING_INDICATOR', payload: isTyping, senderId: userId, targetCode: pairingCode });
  };

  const sendChatMessage = () => {
    if (!chatText.trim()) return;
    const msg: Message = { id: Math.random().toString(36), senderId: userId, text: chatText, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    setChatText('');
    setTyping(false);
    syncChannel.postMessage({ type: 'CHAT_MSG', payload: msg, senderId: userId, targetCode: pairingCode });
  };

  const clearChatHistory = () => {
    if (confirm("Clear chat for both users?")) {
      setMessages([]);
      syncChannel.postMessage({ type: 'CHAT_CLEAR', senderId: userId, targetCode: pairingCode });
    }
  };

  // --- THE FIX: Robust Linking Process ---
  const establishLink = () => {
    if (!partnerCodeInput) return;
    const target = partnerCodeInput.trim().toUpperCase();
    
    setIsLinking(true);
    setPairingCode(target); // Switch to the room we want to join
    
    // We broadcast several times to ensure the other tab picks it up
    const attemptHandshake = () => {
      syncChannel.postMessage({
        type: 'HANDSHAKE_REQ',
        payload: myState,
        senderId: userId,
        targetCode: target
      });
    };

    // Initial attempt
    attemptHandshake();
    
    // Close modal after brief delay
    setTimeout(() => {
      setShowAddPartnerModal(false);
      // Final attempt once state has likely settled
      attemptHandshake();
    }, 500);
  };

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-indigo-600 dark:bg-slate-950 flex items-center justify-center p-8 transition-colors duration-500">
        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-w-sm p-10 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-800 rounded-[2.2rem] flex items-center justify-center text-5xl mx-auto mb-4">🛸</div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none">PartnerSync</h1>
            <p className="text-slate-400 font-bold mt-2 text-xs uppercase tracking-widest">Connect your world</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Your Name</label>
              <input type="text" placeholder="Name" value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold text-lg" />
            </div>
            <button onClick={() => { if(userName) setIsOnboarded(true); }} className="w-full py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black text-xl shadow-xl active:scale-95 transition-all mt-4">Continue</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      {/* Sidebar Nav */}
      <nav className="hidden md:flex flex-col w-24 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 py-10 items-center space-y-8 sticky top-0 h-screen">
        <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl">P</div>
        <div className="flex-1 flex flex-col space-y-6">
          <button onClick={() => setActiveTab('status')} className={`p-4 rounded-2xl transition-all ${activeTab === 'status' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
          <button onClick={() => setActiveTab('widget')} className={`p-4 rounded-2xl transition-all ${activeTab === 'widget' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>
          </button>
          <button onClick={() => setActiveTab('chat')} className={`p-4 rounded-2xl transition-all relative ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            {partnerState && <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></div>}
          </button>
          <button onClick={() => setActiveTab('settings')} className={`p-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto p-6 md:p-12 pb-32 overflow-y-auto">
        {activeTab === 'status' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">{userName}, {welcomeText}</h2>
                <div className="flex items-center space-x-3 mt-1 relative">
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Currently feeling:</p>
                  <button onClick={() => setShowMoodDropdown(!showMoodDropdown)} className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm font-bold text-slate-700 dark:text-slate-200">
                    {myState.activity.mood}
                  </button>
                  {showMoodDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-[100] p-2">
                      {MOODS.map(m => (
                        <button key={m.label} onClick={() => handleMoodSelect(`${m.emoji} ${m.label}`)} className="flex items-center space-x-3 w-full p-3 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-colors">
                          <span className="text-xl">{m.emoji}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>
            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 block">Current Vibe</span>
              <p className="text-2xl font-bold italic">"{humorCaption}"</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {ACTIVITIES.map(act => (
                  <ActivityCard key={act.type} {...act} isSelected={myState.activity.type === act.type} onClick={() => act.type === ActivityType.CUSTOM ? setShowCustomModal(true) : triggerUpdate(act.type)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'widget' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in zoom-in-95">
            <WidgetView 
              userA={myState} 
              userB={partnerState || { id: 'none', name: 'Wait...', gender: 'male', activity: { ...INITIAL_ACTIVITY, statusText: 'Not Linked', mood: '😴 Waiting' } }} 
              onActivityChange={triggerUpdate} 
              onMoodChange={handleMoodSelect} 
            />
            <div className="text-center space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Share Code: <span className="text-indigo-600 dark:text-indigo-400">{pairingCode}</span></p>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 italic">Link on another device to see real-time updates.</p>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[70vh] animate-in slide-in-from-bottom-5">
             {partnerState ? (
               <div className="flex-1 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xl shadow-inner border-2 border-white dark:border-slate-800">
                      {partnerState.gender === 'female' ? '👩' : '👨'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{partnerState.name}</h4>
                      <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Linked</span>
                    </div>
                  </div>
                  <button onClick={clearChatHistory} className="text-slate-200 hover:text-rose-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 p-8 chat-scrollbar bg-slate-50/20 dark:bg-slate-950/20">
                   {messages.map(msg => (
                     <div key={msg.id} className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-5 py-3 rounded-[1.8rem] text-sm font-semibold shadow-sm ${msg.senderId === userId ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700'}`}>
                           {msg.text}
                           <div className="text-[8px] mt-1 opacity-50 uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                     </div>
                   ))}
                   {isPartnerTyping && <div className="text-[10px] font-bold text-slate-400 animate-pulse ml-2">Typing...</div>}
                   <div ref={chatEndRef} />
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex gap-3">
                  <input type="text" placeholder="Message..." value={chatText} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChatMessage()} className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold" />
                  <button onClick={sendChatMessage} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black">Send</button>
                </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3rem] p-12 border border-slate-100 dark:border-slate-800 shadow-sm text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-4xl mb-6">🔒</div>
                  <h3 className="text-xl font-black dark:text-white mb-2">Connect to Chat</h3>
                  <button onClick={() => setActiveTab('settings')} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black mt-4">Link Hub</button>
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-right-4">
             <h2 className="text-4xl font-black text-slate-900 dark:text-white">Hub</h2>
             
             {/* THEME TOGGLE */}
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                   <h3 className="font-black text-slate-800 dark:text-slate-100">Interface Mode</h3>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{darkMode ? 'Dark Vibe Active' : 'Light Mode Active'}</p>
                </div>
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-16 h-10 bg-slate-100 dark:bg-indigo-600 rounded-full relative p-1 transition-all"
                >
                  <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg transition-transform duration-300 ${darkMode ? 'translate-x-6' : 'translate-x-0'}`}>
                    {darkMode ? '🌙' : '☀️'}
                  </div>
                </button>
             </div>

             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="space-y-4">
                   <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">My Profile</h3>
                   <input type="text" placeholder="Name" value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold" />
                   <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => setUserGender('male')} className={`py-3 rounded-2xl border-2 font-bold ${userGender === 'male' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>👨 Male</button>
                     <button onClick={() => setUserGender('female')} className={`py-3 rounded-2xl border-2 font-bold ${userGender === 'female' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>👩 Female</button>
                   </div>
                   <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">My Unique Room Code</p>
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                       <code className="text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-widest">{pairingCode}</code>
                       <button onClick={() => { navigator.clipboard.writeText(pairingCode); alert('Copied!'); }} className="text-indigo-500 font-bold text-sm">Copy</button>
                    </div>
                  </div>
                </div>
             </div>

             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Partner Sync</h3>
                    <button onClick={() => setShowAddPartnerModal(true)} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl">Enter Code</button>
                </div>
                {partnerState ? (
                    <div className="flex items-center justify-between p-5 rounded-[1.8rem] border-2 border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-indigo-500 text-white">{partnerState.gender === 'female' ? '👩' : '👨'}</div>
                            <div>
                                <p className="font-black text-slate-800 dark:text-slate-100">{partnerState.name}</p>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase">Live Connection</p>
                            </div>
                        </div>
                        <button onClick={() => { if(confirm("Sever link?")) { setPartnerState(null); setPairingCode(Math.random().toString(36).substring(2, 5).toUpperCase() + "00"); } }} className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 rounded-lg">Unlink</button>
                    </div>
                ) : (
                    <div className="p-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem]">
                        <p className="text-slate-400 font-medium italic">Listening on room {pairingCode}...</p>
                    </div>
                )}
             </div>

             <div className="pt-4 flex justify-between items-center px-4">
               <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-rose-400 text-xs font-bold">Wipe Data</button>
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">v5.0 Stable Sync</span>
             </div>
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-around z-50 md:hidden safe-bottom">
        <button onClick={() => setActiveTab('status')} className={`flex flex-col items-center gap-1 ${activeTab === 'status' ? 'text-indigo-600' : 'text-slate-300 dark:text-slate-600'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          <span className="text-[9px] font-black uppercase">Home</span>
        </button>
        <button onClick={() => setActiveTab('widget')} className={`flex flex-col items-center gap-1 ${activeTab === 'widget' ? 'text-indigo-600' : 'text-slate-300 dark:text-slate-600'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>
          <span className="text-[9px] font-black uppercase">Widget</span>
        </button>
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 relative ${activeTab === 'chat' ? 'text-indigo-600' : 'text-slate-300 dark:text-slate-600'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="text-[9px] font-black uppercase">Chat</span>
          {partnerState && <div className="absolute top-0 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white dark:border-slate-900"></div>}
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-300 dark:text-slate-600'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-[9px] font-black uppercase">Hub</span>
        </button>
      </nav>

      {/* Link Modal */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-sm rounded-[3rem] p-10 shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 rounded-[1.8rem] flex items-center justify-center text-4xl mx-auto mb-4">🤝</div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Sync Partner</h3>
              </div>
              <input autoFocus type="text" maxLength={6} placeholder="Room Code" value={partnerCodeInput} onChange={e => setPartnerCodeInput(e.target.value.toUpperCase())} className="w-full p-5 bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none rounded-2xl font-black text-center text-xl tracking-widest mb-6" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddPartnerModal(false)} className="flex-1 py-4 font-bold text-gray-400">Cancel</button>
                <button onClick={establishLink} disabled={!partnerCodeInput} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all">Link</button>
              </div>
           </div>
        </div>
      )}

      {/* Custom Status Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 rounded-[1.8rem] flex items-center justify-center text-4xl mx-auto mb-4">✨</div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Status</h3>
              </div>
              <input autoFocus type="text" maxLength={20} placeholder="What's up?" value={customInputValue} onChange={e => setCustomInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && customInputValue && triggerUpdate(ActivityType.CUSTOM, customInputValue)} className="w-full p-5 bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none rounded-2xl font-bold text-center text-lg mb-6" />
              <div className="flex gap-3">
                <button onClick={() => setShowCustomModal(false)} className="flex-1 py-4 font-bold text-gray-400">Cancel</button>
                <button onClick={() => triggerUpdate(ActivityType.CUSTOM, customInputValue)} disabled={!customInputValue.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black">Post</button>
              </div>
           </div>
        </div>
      )}

      {isLinking && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 px-6 py-3 rounded-full shadow-2xl border border-indigo-100 dark:border-indigo-900 flex items-center gap-3 z-[100] animate-in slide-in-from-top-4">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Handshaking...</span>
        </div>
      )}
    </div>
  );
};

export default App;
