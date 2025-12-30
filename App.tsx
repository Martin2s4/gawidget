
import React, { useState, useEffect, useRef } from 'react';
import { ActivityType, UserState, Gender, Message } from './types';
import { ACTIVITIES, MOODS, INITIAL_ACTIVITY } from './constants';
import { ActivityCard } from './components/ActivityCard';
import { WidgetView } from './components/WidgetView';
import { getHumorousCaption, getSimulatedWeather, WELCOME_PHRASES } from './services/localSync';

// Peer-to-Peer Sync Channel (Shared across browser tabs/windows)
const syncChannel = new BroadcastChannel('partnersync_realtime_hub_v2');

const App: React.FC = () => {
  // --- Core Identity & Persistent State ---
  const [userId] = useState(() => localStorage.getItem('user_id') || Math.random().toString(36).substring(2, 9));
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || '');
  const [userGender, setUserGender] = useState<Gender>(() => (localStorage.getItem('user_gender') as Gender) || 'male');
  const [pairingCode, setPairingCode] = useState(() => localStorage.getItem('my_pairing_code') || Math.random().toString(36).substring(2, 5).toUpperCase() + Math.floor(Math.random() * 900 + 100));
  const [isOnboarded, setIsOnboarded] = useState(() => localStorage.getItem('is_onboarded') === 'true');

  // --- Connection & Messaging State ---
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

  // --- UI State ---
  const [activeTab, setActiveTab] = useState<'status' | 'widget' | 'chat' | 'settings'>('status');
  const [welcomeText, setWelcomeText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [humorCaption, setHumorCaption] = useState('Vibing in real-time.');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [showMoodDropdown, setShowMoodDropdown] = useState(false);
  const [chatText, setChatText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Initialization & Local Storage ---
  useEffect(() => {
    localStorage.setItem('user_id', userId);
    localStorage.setItem('user_name', userName);
    localStorage.setItem('user_gender', userGender);
    localStorage.setItem('my_pairing_code', pairingCode);
    localStorage.setItem('is_onboarded', isOnboarded.toString());
    localStorage.setItem('my_state', JSON.stringify(myState));
    localStorage.setItem('partner_state', JSON.stringify(partnerState));
    localStorage.setItem('chat_history', JSON.stringify(messages));
  }, [myState, partnerState, messages, userName, userGender, isOnboarded, pairingCode]);

  useEffect(() => {
    setWelcomeText(WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)]);

    const handleSync = (event: MessageEvent) => {
      const { type, payload, senderId, targetCode } = event.data;
      
      // Filter out messages not meant for our "Sync Room"
      if (senderId === userId) return;
      if (pairingCode !== targetCode) return;

      switch (type) {
        case 'PEER_STATUS_UPDATE':
          setPartnerState(payload);
          break;
        case 'PEER_MESSAGE':
          setMessages(prev => [...prev, payload]);
          break;
        case 'PEER_TYPING':
          setIsPartnerTyping(payload);
          break;
        case 'PEER_CLEAR_CHAT':
          setMessages([]);
          break;
        case 'PEER_HANDSHAKE_INIT':
          // EXTREMELY IMPORTANT: Someone entered our code!
          // 1. Send them our current status so they see us immediately
          syncChannel.postMessage({ type: 'PEER_STATUS_UPDATE', payload: myState, senderId: userId, targetCode: pairingCode });
          // 2. We now have a partner session active
          console.log("Handshake received! Connection established.");
          break;
      }
    };

    syncChannel.addEventListener('message', handleSync);
    return () => syncChannel.removeEventListener('message', handleSync);
  }, [userId, pairingCode, myState]);

  useEffect(() => {
    if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, isPartnerTyping]);

  // --- Handlers ---
  const handleUpdate = async (type: ActivityType, customText?: string) => {
    setIsSyncing(true);
    let lat, lon;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 })
      );
      lat = pos.coords.latitude; lon = pos.coords.longitude;
    } catch {}

    const weather = getSimulatedWeather(lat, lon);
    const caption = getHumorousCaption(type, customText || 'Active', myState.activity.mood);

    setTimeout(() => {
      const updatedState = {
        ...myState,
        name: userName || 'Me',
        gender: userGender,
        activity: { 
          ...myState.activity, 
          type, 
          customText, 
          timestamp: Date.now(), 
          weather,
          statusText: customText ? 'Live' : 'Synced' 
        }
      };
      setMyState(updatedState);
      setHumorCaption(caption);
      setIsSyncing(false); setShowCustomModal(false); setCustomInputValue('');
      
      // Broadcast state update
      syncChannel.postMessage({ type: 'PEER_STATUS_UPDATE', payload: updatedState, senderId: userId, targetCode: pairingCode });
    }, 400);
  };

  const handleMoodSelect = (moodStr: string) => {
    const updatedState = { ...myState, activity: { ...myState.activity, mood: moodStr, timestamp: Date.now() } };
    setMyState(updatedState);
    setShowMoodDropdown(false);
    syncChannel.postMessage({ type: 'PEER_STATUS_UPDATE', payload: updatedState, senderId: userId, targetCode: pairingCode });
  };

  const broadcastTyping = (isTyping: boolean) => {
    syncChannel.postMessage({ type: 'PEER_TYPING', payload: isTyping, senderId: userId, targetCode: pairingCode });
  };

  const sendMessage = () => {
    if (!chatText.trim()) return;
    const msg: Message = { id: Math.random().toString(36), senderId: userId, text: chatText, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    setChatText('');
    broadcastTyping(false);
    syncChannel.postMessage({ type: 'PEER_MESSAGE', payload: msg, senderId: userId, targetCode: pairingCode });
  };

  const clearChat = () => {
    if (confirm("Delete conversation for both of you?")) {
      setMessages([]);
      syncChannel.postMessage({ type: 'PEER_CLEAR_CHAT', senderId: userId, targetCode: pairingCode });
    }
  };

  const performOneWaySync = () => {
    if (!partnerCodeInput) return;
    setIsSyncing(true);
    
    setTimeout(() => {
      // Switch our room to the partner's code
      setPairingCode(partnerCodeInput);
      setIsSyncing(false);
      setShowAddPartnerModal(false);
      
      // Shout into the room to see if anyone is there
      syncChannel.postMessage({ type: 'PEER_HANDSHAKE_INIT', senderId: userId, targetCode: partnerCodeInput });
      
      // Also send our status immediately so they see us if they are already listening
      syncChannel.postMessage({ type: 'PEER_STATUS_UPDATE', payload: myState, senderId: userId, targetCode: partnerCodeInput });
    }, 800);
  };

  if (!isOnboarded) {
    return (
      <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-8">
        <div className="bg-white rounded-[3.5rem] w-full max-w-sm p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2.2rem] flex items-center justify-center text-5xl mx-auto mb-4">🛸</div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-none">PartnerSync</h1>
            <p className="text-slate-400 font-bold mt-2 text-xs uppercase tracking-widest">Connect with your human</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Screen Name</label>
              <input type="text" placeholder="Name" value={userName} onChange={e => setUserName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none font-bold text-lg" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Gender Style</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setUserGender('male')} className={`py-4 rounded-2xl border-2 font-bold transition-all ${userGender === 'male' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>👨 Male</button>
                <button onClick={() => setUserGender('female')} className={`py-4 rounded-2xl border-2 font-bold transition-all ${userGender === 'female' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>👩 Female</button>
              </div>
            </div>
            <button onClick={() => { if(userName) setIsOnboarded(true); }} className="w-full py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black text-xl shadow-xl active:scale-95 transition-all mt-4">Start Linking</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 overflow-x-hidden">
      {/* Desktop Navigation */}
      <nav className="hidden md:flex flex-col w-24 bg-white border-r border-slate-100 py-10 items-center space-y-8 sticky top-0 h-screen">
        <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl shadow-lg">P</div>
        <div className="flex-1 flex flex-col space-y-6">
          <button onClick={() => setActiveTab('status')} className={`p-4 rounded-2xl transition-all ${activeTab === 'status' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-300 hover:bg-slate-50'}`}>
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
          <button onClick={() => setActiveTab('widget')} className={`p-4 rounded-2xl transition-all ${activeTab === 'widget' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-300 hover:bg-slate-50'}`}>
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>
          </button>
          <button onClick={() => setActiveTab('chat')} className={`p-4 rounded-2xl transition-all relative ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-300 hover:bg-slate-50'}`}>
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             {partnerState && <div className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></div>}
          </button>
          <button onClick={() => setActiveTab('settings')} className={`p-4 rounded-2xl transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-300 hover:bg-slate-50'}`}>
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl mx-auto p-6 md:p-12 pb-32 overflow-y-auto">
        {activeTab === 'status' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">Hey {userName}, {welcomeText}</h2>
                <div className="flex items-center space-x-3 mt-1 relative">
                  <p className="text-slate-500 font-medium">Currently feeling:</p>
                  <button onClick={() => setShowMoodDropdown(!showMoodDropdown)} className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm font-bold text-slate-700">
                    <span>{myState.activity.mood}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showMoodDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] p-2 animate-in zoom-in-95 duration-200">
                      {MOODS.map(m => (
                        <button key={m.label} onClick={() => handleMoodSelect(`${m.emoji} ${m.label}`)} className="flex items-center space-x-3 w-full p-3 hover:bg-indigo-50 rounded-xl transition-colors">
                          <span className="text-xl">{m.emoji}</span>
                          <span className="font-bold text-slate-700 text-sm">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </header>
            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group transition-all hover:scale-[1.01]">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-3 block">Daily Sync Vibe</span>
              <p className="text-2xl font-bold italic leading-snug">"{humorCaption}"</p>
            </div>
            <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {ACTIVITIES.map(act => (
                  <ActivityCard key={act.type} {...act} isSelected={myState.activity.type === act.type} onClick={() => act.type === ActivityType.CUSTOM ? setShowCustomModal(true) : handleUpdate(act.type)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'widget' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-12 animate-in zoom-in-95 duration-500">
            <div className="relative p-12 bg-slate-200/40 rounded-[5rem] shadow-inner border-2 border-slate-200/50">
                <WidgetView 
                  userA={myState} 
                  userB={partnerState || { id: 'none', name: 'Wait...', gender: 'male', activity: { ...INITIAL_ACTIVITY, statusText: 'Not linked', mood: '😴 Waiting' } }} 
                  onActivityChange={handleUpdate} 
                  onMoodChange={handleMoodSelect} 
                />
            </div>
            <div className="text-center space-y-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] max-w-xs leading-loose">
                  Your code: <span className="text-indigo-600 font-black px-1">{pairingCode}</span>
                </p>
                <p className="text-[10px] text-slate-300 font-medium italic">Open this app in another tab to link both sessions instantly.</p>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[75vh] animate-in slide-in-from-bottom-5 duration-500">
             {partnerState ? (
               <div className="flex-1 bg-white rounded-[3rem] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-white">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xl shadow-inner border-2 border-white">
                      {partnerState.gender === 'female' ? '👩' : '👨'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">{partnerState.name}</h4>
                      <div className="flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Linked</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={clearChat} className="p-2 text-slate-200 hover:text-rose-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 p-8 chat-scrollbar bg-slate-50/20">
                   {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                        <div className="text-4xl opacity-20">💬</div>
                        <p className="italic font-medium">Say hello to {partnerState.name}!</p>
                      </div>
                   ) : (
                      messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[80%] px-5 py-3 rounded-[1.8rem] text-sm font-semibold shadow-sm ${msg.senderId === userId ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'}`}>
                              {msg.text}
                              <div className="text-[8px] mt-1 opacity-50 block uppercase tracking-widest">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                           </div>
                        </div>
                      ))
                   )}
                   {isPartnerTyping && (
                     <div className="flex justify-start">
                        <div className="bg-white border border-slate-100 px-4 py-2 rounded-2xl rounded-tl-none flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                     </div>
                   )}
                   <div ref={chatEndRef} />
                </div>
                <div className="p-6 bg-white border-t border-slate-50">
                  <div className="flex space-x-3">
                    <input 
                      type="text" 
                      placeholder="Type a message..." 
                      value={chatText} 
                      onFocus={() => broadcastTyping(true)}
                      onBlur={() => broadcastTyping(false)}
                      onChange={e => { setChatText(e.target.value); if(!e.target.value) broadcastTyping(false); }} 
                      onKeyDown={e => e.key === 'Enter' && sendMessage()} 
                      className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold" 
                    />
                    <button onClick={sendMessage} className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black active:scale-95 transition-all shadow-lg shadow-indigo-100">Send</button>
                  </div>
                </div>
               </div>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[3rem] p-12 border border-slate-100 shadow-sm text-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-5xl mb-6">🔒</div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2">Connect to Chat</h3>
                  <p className="text-slate-500 max-w-xs mb-8">Share your code or enter your partner's to enable real-time messaging.</p>
                  <button onClick={() => setActiveTab('settings')} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl">Link Session</button>
               </div>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
             <h2 className="text-4xl font-black text-slate-900">Hub</h2>
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="space-y-4">
                   <h3 className="text-lg font-black text-slate-800 ml-1">My Identity</h3>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Display Name</label>
                      <input type="text" placeholder="Name" value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gender Style</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setUserGender('male')} className={`py-3 rounded-2xl border-2 font-bold transition-all ${userGender === 'male' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-50 bg-slate-50 text-slate-400'}`}>👨 Male</button>
                        <button onClick={() => setUserGender('female')} className={`py-3 rounded-2xl border-2 font-bold transition-all ${userGender === 'female' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-400'}`}>👩 Female</button>
                      </div>
                   </div>
                   <div className="bg-slate-50 p-6 rounded-3xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">My Current Code</p>
                    <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-200">
                       <code className="text-xl font-black text-indigo-600 tracking-widest font-mono">{pairingCode}</code>
                       <button onClick={() => { navigator.clipboard.writeText(pairingCode); alert('Code copied!'); }} className="text-indigo-500 font-bold text-sm hover:underline">Copy</button>
                    </div>
                  </div>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 ml-1">Partner Status</h3>
                    <button onClick={() => setShowAddPartnerModal(true)} className="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-sm">Sync Code</button>
                </div>
                
                {partnerState ? (
                    <div className="flex items-center justify-between p-5 rounded-[1.8rem] border-2 border-indigo-500 bg-indigo-50/30 transition-all">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-indigo-500 text-white shadow-lg">
                                {partnerState.gender === 'female' ? '👩' : '👨'}
                            </div>
                            <div>
                                <p className="font-black text-slate-800 text-lg">{partnerState.name}</p>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Active Connection</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                              if(confirm("Break link?")) {
                                setPartnerState(null);
                                setPairingCode(Math.random().toString(36).substring(2, 5).toUpperCase() + "99");
                              }
                            }}
                            className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                            Unlink
                        </button>
                    </div>
                ) : (
                    <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-[2rem]">
                        <p className="text-slate-400 font-medium">Waiting for your partner on code {pairingCode}...</p>
                    </div>
                )}
             </div>

             <div className="pt-4 flex justify-between items-center px-4">
               <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-rose-400 text-xs font-bold hover:underline">Reset Data</button>
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] opacity-80 uppercase">v2.1 Realtime Sync</span>
             </div>
          </div>
        )}
      </main>

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-3xl border-t border-slate-100 px-6 py-4 flex items-center justify-around z-50 md:hidden safe-bottom">
        <button onClick={() => setActiveTab('status')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'status' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setActiveTab('widget')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'widget' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>
          <span className="text-[9px] font-black uppercase tracking-widest">Widget</span>
        </button>
        <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center space-y-1 transition-all relative ${activeTab === 'chat' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          <span className="text-[9px] font-black uppercase tracking-widest">Chat</span>
          {partnerState && <div className="absolute top-0 right-1 w-1.5 h-1.5 bg-rose-500 rounded-full border border-white"></div>}
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center space-y-1 transition-all ${activeTab === 'settings' ? 'text-indigo-600 scale-110' : 'text-slate-300'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-[9px] font-black uppercase tracking-widest">More</span>
        </button>
      </nav>

      {showAddPartnerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-sm rounded-[3rem] p-10 shadow-2xl scale-in duration-300">
              <div className="text-center mb-6"><div className="w-20 h-20 bg-indigo-50 rounded-[1.8rem] flex items-center justify-center text-4xl mx-auto mb-4">🤝</div><h3 className="text-2xl font-black text-slate-900 leading-tight">Sync Partner</h3></div>
              <div className="space-y-4 mb-6">
                <input autoFocus type="text" maxLength={6} placeholder="Enter Code" value={partnerCodeInput} onChange={e => setPartnerCodeInput(e.target.value.toUpperCase())} className="w-full p-5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none rounded-2xl font-black text-center text-xl tracking-widest" />
              </div>
              <div className="flex space-x-3"><button onClick={() => setShowAddPartnerModal(false)} className="flex-1 py-4 font-bold text-gray-400">Cancel</button><button onClick={performOneWaySync} disabled={!partnerCodeInput} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">Link</button></div>
           </div>
        </div>
      )}

      {showCustomModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl scale-in duration-300">
              <div className="text-center mb-8"><div className="w-20 h-20 bg-indigo-50 rounded-[1.8rem] flex items-center justify-center text-4xl mx-auto mb-4">✨</div><h3 className="text-2xl font-black text-slate-900 leading-tight">Custom Status</h3></div>
              <input autoFocus type="text" maxLength={20} placeholder="What's up?" value={customInputValue} onChange={e => setCustomInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && customInputValue && handleUpdate(ActivityType.CUSTOM, customInputValue)} className="w-full p-5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none rounded-2xl font-bold text-center text-lg mb-6" />
              <div className="flex space-x-3"><button onClick={() => setShowCustomModal(false)} className="flex-1 py-4 font-bold text-gray-400">Cancel</button><button onClick={() => handleUpdate(ActivityType.CUSTOM, customInputValue)} disabled={!customInputValue.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black">Post</button></div>
           </div>
        </div>
      )}

      {isSyncing && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border border-indigo-100 flex items-center space-x-3 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-black text-indigo-600 uppercase tracking-widest uppercase tracking-widest">Handshaking...</span>
        </div>
      )}
    </div>
  );
};

export default App;
