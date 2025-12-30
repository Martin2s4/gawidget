
import React, { useState, useEffect, useRef } from 'react';
import { ActivityType, UserState, Gender, Message } from './types';
import { ACTIVITIES, MOODS, AVATARS, INITIAL_ACTIVITY } from './constants';
import { ActivityCard } from './components/ActivityCard';
import { WidgetView } from './components/WidgetView';
import { getHumorousCaption, getSimulatedWeather, WELCOME_PHRASES } from './services/localSync';

// Global Broadcast Channel for P2P Simulation
const syncChannel = new BroadcastChannel('partnersync_v10_final');

const App: React.FC = () => {
  // --- User Identity ---
  const [userId] = useState(() => localStorage.getItem('user_id') || Math.random().toString(36).substring(2, 9));
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || '');
  const [userGender, setUserGender] = useState<Gender>(() => (localStorage.getItem('user_gender') as Gender) || 'male');
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem('user_avatar') || '👨');
  
  // Permanent Personal Address (The one you give to others)
  const [myRoomCode, setMyRoomCode] = useState(() => {
    const saved = localStorage.getItem('my_room_code');
    if (saved) return saved;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('my_room_code', newCode);
    return newCode;
  });

  // Current Active Sync Channel (Defaults to your own room)
  const [currentRoomCode, setCurrentRoomCode] = useState(() => localStorage.getItem('active_room_code') || myRoomCode);

  const [isOnboarded, setIsOnboarded] = useState(() => localStorage.getItem('is_onboarded') === 'true');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // --- Partner & Communication State ---
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
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef(currentRoomCode);

  // --- Persistence & Theme Logic ---
  useEffect(() => {
    roomRef.current = currentRoomCode;
    localStorage.setItem('user_id', userId);
    localStorage.setItem('user_name', userName);
    localStorage.setItem('user_gender', userGender);
    localStorage.setItem('user_avatar', userAvatar);
    localStorage.setItem('is_onboarded', isOnboarded.toString());
    localStorage.setItem('my_state', JSON.stringify(myState));
    localStorage.setItem('partner_state', JSON.stringify(partnerState));
    localStorage.setItem('chat_history', JSON.stringify(messages));
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('active_room_code', currentRoomCode);
    localStorage.setItem('my_room_code', myRoomCode);
    
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [myState, partnerState, messages, userName, userGender, userAvatar, isOnboarded, currentRoomCode, myRoomCode, darkMode, userId]);

  // --- INSTANT P2P SYNC ENGINE ---
  useEffect(() => {
    setWelcomeText(WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)]);

    const handleMessage = (event: MessageEvent) => {
      const { type, payload, senderId, targetCode } = event.data;
      
      // Basic cross-tab security
      if (senderId === userId) return; 
      if (targetCode !== roomRef.current) return;

      switch (type) {
        case 'P2P_HANDSHAKE':
          setPartnerState(payload);
          // Auto-reply to finalize mutual link
          if (event.data.isInitial) {
            syncChannel.postMessage({
              type: 'P2P_HANDSHAKE',
              payload: myState,
              senderId: userId,
              targetCode: roomRef.current,
              isInitial: false
            });
          }
          break;
        case 'P2P_UPDATE':
          setPartnerState(payload);
          break;
        case 'P2P_MSG':
          setMessages(prev => [...prev, payload]);
          break;
        case 'P2P_TYPING':
          setIsPartnerTyping(payload);
          break;
        case 'P2P_UNLINK':
          setPartnerState(null);
          break;
      }
    };

    syncChannel.addEventListener('message', handleMessage);
    return () => syncChannel.removeEventListener('message', handleMessage);
  }, [userId, myState]);

  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, isPartnerTyping]);

  // --- Actions ---
  const broadcast = (type: string, payload: any, extra = {}) => {
    syncChannel.postMessage({ type, payload, senderId: userId, targetCode: currentRoomCode, ...extra });
  };

  const regenerateMyCode = () => {
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    setMyRoomCode(newCode);
    // If not currently joined to someone else, move our sync channel to the new code too
    if (!partnerState) {
      setCurrentRoomCode(newCode);
      roomRef.current = newCode;
    }
  };

  const handleActivityUpdate = async (type: ActivityType, customText?: string) => {
    let lat, lon;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 800 })
      );
      lat = pos.coords.latitude; lon = pos.coords.longitude;
    } catch {}

    const weather = getSimulatedWeather(lat, lon);
    const caption = getHumorousCaption(type, customText || 'Active', myState.activity.mood);

    const updated = {
      ...myState,
      name: userName || 'Me',
      gender: userGender,
      avatar: userAvatar,
      activity: { 
        ...myState.activity, 
        type, customText, timestamp: Date.now(), weather,
        statusText: 'Updated now' 
      }
    };
    
    setMyState(updated);
    setHumorCaption(caption);
    setShowCustomModal(false);
    broadcast('P2P_UPDATE', updated);
  };

  const handleAvatarChange = (emoji: string) => {
    setUserAvatar(emoji);
    const updated = { ...myState, avatar: emoji };
    setMyState(updated);
    setShowAvatarPicker(false);
    broadcast('P2P_UPDATE', updated);
  };

  const updateMood = (moodStr: string) => {
    const updated = { ...myState, activity: { ...myState.activity, mood: moodStr, timestamp: Date.now() } };
    setMyState(updated);
    setShowMoodDropdown(false);
    broadcast('P2P_UPDATE', updated);
  };

  const sendText = () => {
    if (!chatText.trim()) return;
    const msg: Message = { id: Math.random().toString(36), senderId: userId, text: chatText, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    setChatText('');
    broadcast('P2P_MSG', msg);
  };

  // --- THE INSTANT LINKING ACTION ---
  const instantConnect = () => {
    const code = partnerCodeInput.trim().toUpperCase();
    if (!code) return;

    // Switch sync channel to the partner's room
    setCurrentRoomCode(code);
    roomRef.current = code;
    
    // Broadcast presence immediately to target room
    syncChannel.postMessage({
        type: 'P2P_HANDSHAKE',
        payload: myState,
        senderId: userId,
        targetCode: code,
        isInitial: true
    });

    setShowAddPartnerModal(false);
    setPartnerCodeInput('');
    setActiveTab('widget');
  };

  const unlink = () => {
    broadcast('P2P_UNLINK', null);
    setPartnerState(null);
    // Return to my own personal room
    setCurrentRoomCode(myRoomCode);
    roomRef.current = myRoomCode;
  };

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-indigo-600 dark:bg-slate-950 flex items-center justify-center p-8 transition-all duration-500">
        <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] w-full max-sm p-10 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-slate-800 rounded-[2.2rem] flex items-center justify-center text-5xl mx-auto mb-4">🛰️</div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight leading-none">PartnerSync</h1>
            <p className="text-slate-400 font-bold mt-2 text-xs uppercase tracking-widest">Connect your life</p>
          </div>
          <div className="space-y-6">
            <input type="text" placeholder="Your Display Name" value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold text-lg" />
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
               {tab === 'chat' && partnerState && <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900"></div>}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
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
              
              <button 
                onClick={() => setDarkMode(!darkMode)}
                title="Toggle Theme"
                className="w-14 h-14 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 flex items-center justify-center text-2xl transition-all hover:scale-105 active:scale-95 group"
              >
                <span className="group-hover:rotate-12 transition-transform">{darkMode ? '🌙' : '☀️'}</span>
              </button>
            </header>

            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2 block">Vibe Check</span>
              <p className="text-2xl font-bold italic">"{humorCaption}"</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 border border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {ACTIVITIES.map(act => (
                  <ActivityCard key={act.type} {...act} isSelected={myState.activity.type === act.type} onClick={() => act.type === ActivityType.CUSTOM ? setShowCustomModal(true) : handleActivityUpdate(act.type)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'widget' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in zoom-in-95">
            <WidgetView 
              userA={myState} 
              userB={partnerState || { id: 'none', name: 'No Partner', gender: 'male', activity: { ...INITIAL_ACTIVITY, statusText: 'Disconnected', mood: '😴 Offline' } }} 
              onActivityChange={handleActivityUpdate} 
              onMoodChange={updateMood} 
            />
            <div className="text-center">
              {partnerState ? (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 px-6 py-4 rounded-3xl border border-emerald-100 dark:border-emerald-800 flex items-center space-x-3">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                     <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Linked with {partnerState.name}</span>
                  </div>
              ) : (
                <>
                  <div className="flex items-center justify-center space-x-3 mb-2">
                    <p className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Share Your Address:</p>
                  </div>
                  <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-[0.2em]">{myRoomCode}</p>
                  <p className="text-[10px] text-slate-300 dark:text-slate-500 mt-2">Entering this on a partner's device will fuse your widgets.</p>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[70vh] animate-in slide-in-from-bottom-5">
             {partnerState ? (
               <div className="flex-1 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
                <div className="px-8 py-5 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xl shadow-inner border-2 border-white dark:border-slate-800">
                      {partnerState.avatar || '👨'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black dark:text-white leading-none">{partnerState.name}</h4>
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Sync Active</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 p-8 chat-scrollbar bg-slate-50/20 dark:bg-slate-950/20">
                   {messages.map(msg => (
                     <div key={msg.id} className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-5 py-3 rounded-[1.8rem] text-sm font-semibold shadow-sm ${msg.senderId === userId ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border dark:border-slate-700'}`}>
                           {msg.text}
                        </div>
                     </div>
                   ))}
                   {isPartnerTyping && <div className="text-[10px] font-black text-slate-400 italic ml-2">Partner is typing...</div>}
                   <div ref={chatEndRef} />
                </div>
                <div className="p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex gap-3">
                  <input type="text" placeholder="Type a message..." value={chatText} onFocus={() => broadcast('P2P_TYPING', true)} onBlur={() => broadcast('P2P_TYPING', false)} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white outline-none font-bold" />
                  <button onClick={sendText} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black active:scale-95 transition-all">Send</button>
                </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-[3rem] p-12 border dark:border-slate-800 text-center">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner">🔒</div>
                  <h3 className="text-2xl font-black dark:text-white mb-2">Connect to Chat</h3>
                  <p className="text-slate-400 text-sm max-w-[200px]">Link with a partner in the Hub to start sharing messages.</p>
                  <button onClick={() => setActiveTab('settings')} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black mt-8 shadow-xl active:scale-95 transition-all">Go to Hub</button>
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-right-4">
             <h2 className="text-4xl font-black text-slate-900 dark:text-white">Hub</h2>
             
             {/* AVATAR PICKER */}
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-lg font-black dark:text-white">Your Persona</h3>
                   <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl active:scale-95 transition-all">
                    {showAvatarPicker ? 'Done' : 'Edit Avatar'}
                   </button>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-6xl shadow-inner border dark:border-slate-700">
                    {userAvatar}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">Choose an emoji that represents you in the shared widget.</p>
                  </div>
                </div>

                {showAvatarPicker && (
                  <div className="mt-8 grid grid-cols-6 sm:grid-cols-9 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] animate-in zoom-in-95 duration-200">
                    {AVATARS.map(emoji => (
                      <button 
                        key={emoji} 
                        onClick={() => handleAvatarChange(emoji)}
                        className={`text-2xl p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all ${userAvatar === emoji ? 'bg-white dark:bg-slate-700 shadow-md scale-110 ring-2 ring-indigo-500' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
             </div>

             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="space-y-4">
                   <h3 className="text-lg font-black dark:text-white">Identity</h3>
                   <div className="space-y-2">
                     <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-600 ml-2">Display Name</span>
                     <input type="text" placeholder="Your Name" value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none font-bold" />
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                     <button onClick={() => setUserGender('male')} className={`py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest ${userGender === 'male' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'border-slate-50 dark:border-slate-800 text-slate-400'}`}>👨 Male Style</button>
                     <button onClick={() => setUserGender('female')} className={`py-3 rounded-2xl border-2 font-black text-xs uppercase tracking-widest ${userGender === 'female' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300' : 'border-slate-50 dark:border-slate-800 text-slate-400'}`}>👩 Female Style</button>
                   </div>
                </div>
             </div>

             {/* PARTNER SYNC SECTION */}
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black dark:text-white">Partner Sync</h3>
                    {!partnerState && <button onClick={() => setShowAddPartnerModal(true)} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl shadow-lg active:scale-95 transition-all">Link Partner</button>}
                </div>
                {partnerState ? (
                    <div className="flex items-center justify-between p-5 rounded-[1.8rem] border-2 border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/30 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-emerald-500 text-white shadow-lg">{partnerState.avatar || '👨'}</div>
                            <div>
                                <p className="font-black dark:text-white leading-none">{partnerState.name}</p>
                                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">Synced & Online</p>
                            </div>
                        </div>
                        <button onClick={unlink} className="text-[10px] font-black text-rose-500 bg-rose-50 dark:bg-rose-900/30 px-3 py-1.5 rounded-lg active:scale-90 transition-all">Sever link</button>
                    </div>
                ) : (
                    <div className="p-10 text-center border-2 border-dashed dark:border-slate-800 rounded-[2rem] bg-slate-50/30 dark:bg-slate-950/30 relative overflow-hidden">
                        <p className="text-slate-400 font-bold italic mb-3 text-xs uppercase tracking-widest">Your Personal Address</p>
                        <div className="flex items-center justify-center space-x-4">
                           <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-[0.2em]">{myRoomCode}</p>
                           <button 
                             onClick={regenerateMyCode} 
                             title="Generate New Address"
                             className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-90 transition-all"
                           >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                           </button>
                        </div>
                    </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t dark:border-slate-800 px-6 py-4 flex items-center justify-around z-50 md:hidden safe-bottom">
        {['status', 'widget', 'chat', 'settings'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === tab ? 'text-indigo-600 scale-110' : 'text-slate-300 dark:text-slate-600'}`}>
            {tab === 'status' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
            {tab === 'widget' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>}
            {tab === 'chat' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            {tab === 'settings' && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            <span className="text-[8px] font-black uppercase tracking-wider">{tab}</span>
            {tab === 'chat' && partnerState && <div className="absolute top-0 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white dark:border-slate-900 shadow-sm"></div>}
          </button>
        ))}
      </nav>

      {/* Linking Modal */}
      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-sm rounded-[3rem] p-10 shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 rounded-[1.8rem] flex items-center justify-center text-4xl mx-auto mb-4">🔗</div>
                <h3 className="text-2xl font-black dark:text-white leading-tight">Join Partner Room</h3>
                <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">Enter their address to sync</p>
              </div>
              <input autoFocus type="text" maxLength={6} placeholder="ABC123" value={partnerCodeInput} onChange={e => setPartnerCodeInput(e.target.value.toUpperCase())} className="w-full p-5 bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none rounded-2xl font-black text-center text-3xl tracking-[0.2em] mb-6 shadow-inner" />
              <div className="flex gap-3">
                <button onClick={() => setShowAddPartnerModal(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                <button onClick={instantConnect} disabled={!partnerCodeInput} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all uppercase tracking-widest text-xs">Link Now</button>
              </div>
           </div>
        </div>
      )}

      {/* Custom Status Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 rounded-[1.8rem] flex items-center justify-center text-4xl mx-auto mb-4">✨</div>
                <h3 className="text-2xl font-black dark:text-white">Custom Status</h3>
              </div>
              <input autoFocus type="text" maxLength={20} value={customInputValue} onChange={e => setCustomInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && customInputValue && handleActivityUpdate(ActivityType.CUSTOM, customInputValue)} className="w-full p-5 bg-gray-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-indigo-500 outline-none rounded-2xl font-bold text-center text-lg mb-6 shadow-inner" />
              <div className="flex gap-3">
                <button onClick={() => setShowCustomModal(false)} className="flex-1 py-4 font-black text-gray-400 uppercase tracking-widest text-xs">Cancel</button>
                <button onClick={() => handleActivityUpdate(ActivityType.CUSTOM, customInputValue)} disabled={!customInputValue.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs">Post</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
