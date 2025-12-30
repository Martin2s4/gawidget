
import React, { useState, useEffect } from 'react';
import { ActivityType, UserState } from './types';
import { ACTIVITIES, MOODS, INITIAL_ACTIVITY } from './constants';
import { ActivityCard } from './components/ActivityCard';
import { WidgetView } from './components/WidgetView';
import { getHumorousCaption, getSimulatedWeather } from './services/localSync';

const App: React.FC = () => {
  const [isPaired, setIsPaired] = useState(() => localStorage.getItem('is_paired') === 'true');
  const [userName, setUserName] = useState(() => localStorage.getItem('user_name') || '');
  const [partnerName, setPartnerName] = useState(() => localStorage.getItem('partner_name') || 'Partner');
  const [pairingCode, setPairingCode] = useState('');
  
  const [myState, setMyState] = useState<UserState>(() => {
    const saved = localStorage.getItem('my_state');
    return saved ? JSON.parse(saved) : { id: 'me', name: 'Me', activity: INITIAL_ACTIVITY };
  });

  const [partnerState, setPartnerState] = useState<UserState>(() => {
    const saved = localStorage.getItem('partner_state');
    return saved ? JSON.parse(saved) : { 
      id: 'partner', 
      name: 'Partner', 
      activity: { ...INITIAL_ACTIVITY, type: ActivityType.SLEEPING } 
    };
  });

  const [activeTab, setActiveTab] = useState<'status' | 'widget' | 'settings'>('status');
  const [isUpdating, setIsUpdating] = useState(false);
  const [humorCaption, setHumorCaption] = useState('Welcome back to PartnerSync!');
  
  // Custom activity input state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInputValue, setCustomInputValue] = useState('');

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('my_state', JSON.stringify(myState));
    localStorage.setItem('partner_state', JSON.stringify(partnerState));
    localStorage.setItem('user_name', userName);
    localStorage.setItem('partner_name', partnerName);
    localStorage.setItem('is_paired', isPaired.toString());
  }, [myState, partnerState, userName, partnerName, isPaired]);

  // Mock real-time partner sync
  useEffect(() => {
    if (!isPaired) return;
    const timer = setInterval(() => {
      const randAct = ACTIVITIES[Math.floor(Math.random() * (ACTIVITIES.length - 1))];
      const randMood = MOODS[Math.floor(Math.random() * MOODS.length)];
      setPartnerState(prev => ({
        ...prev,
        activity: {
          ...prev.activity,
          type: randAct.type,
          statusText: 'Living life',
          mood: `${randMood.emoji} ${randMood.label}`,
          timestamp: Date.now()
        }
      }));
    }, 45000);
    return () => clearInterval(timer);
  }, [isPaired]);

  const handleUpdate = async (type: ActivityType, customText?: string) => {
    setIsUpdating(true);
    let lat, lon;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => 
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      );
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {}

    // Get vibe and weather locally
    const weather = getSimulatedWeather(lat, lon);
    const caption = getHumorousCaption(type, customText || 'Active', MOODS[0].label);

    // Small delay to simulate sync
    setTimeout(() => {
      setHumorCaption(caption);
      setMyState(prev => ({
        ...prev,
        name: userName || 'Me',
        activity: {
          type,
          customText: customText,
          statusText: customText ? 'Custom Status' : 'Automatic Sync',
          mood: MOODS[Math.floor(Math.random() * MOODS.length)].emoji + ' Feeling good',
          timestamp: Date.now(),
          weather
        }
      }));
      
      setIsUpdating(false);
      setShowCustomModal(false);
      setCustomInputValue('');
    }, 600);
  };

  if (!isPaired) {
    return (
      <div className="min-h-screen bg-indigo-600 flex items-center justify-center p-8">
        <div className="bg-white rounded-[3.5rem] w-full max-w-sm p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-700">
          <div className="text-center mb-10">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2.2rem] flex items-center justify-center text-5xl mx-auto mb-6">🛰️</div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Sync Up</h1>
            <p className="text-gray-500 mt-2 font-medium">Link with your partner.</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" 
              placeholder="Your Name"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none font-bold"
            />
            <input 
              type="text" 
              placeholder="Pairing Code"
              value={pairingCode}
              onChange={e => setPairingCode(e.target.value.toUpperCase())}
              className="w-full px-6 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none text-center font-mono tracking-widest text-xl"
            />
            <button 
              onClick={() => { if(userName && pairingCode) setIsPaired(true); }}
              className="w-full py-5 bg-indigo-600 text-white rounded-[1.8rem] font-black text-xl shadow-xl shadow-indigo-100 active:scale-95 transition-all"
            >
              Start Syncing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 overflow-x-hidden">
      {/* Sidebar Nav */}
      <nav className="hidden md:flex flex-col w-24 bg-white border-r border-slate-100 py-10 items-center space-y-10 sticky top-0 h-screen">
        <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl">P</div>
        <div className="flex-1 flex flex-col space-y-8">
          <button onClick={() => setActiveTab('status')} className={`p-4 rounded-2xl transition-colors ${activeTab === 'status' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300'}`}>
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
          <button onClick={() => setActiveTab('widget')} className={`p-4 rounded-2xl transition-colors ${activeTab === 'widget' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300'}`}>
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`p-4 rounded-2xl transition-colors ${activeTab === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300'}`}>
             <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto p-6 md:p-12 pb-32 overflow-y-auto">
        {activeTab === 'status' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Hey, {userName}</h2>
                <p className="text-slate-500 font-medium">Keep {partnerName} in the loop.</p>
              </div>
              <div className="flex items-center space-x-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                <span className="text-[10px] font-black text-emerald-600 tracking-widest uppercase">Live Sync</span>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
            </header>

            {/* Current Activity Highlight */}
            {myState.activity.type === ActivityType.CUSTOM && myState.activity.customText && (
               <div className="bg-white p-6 rounded-[2.5rem] border border-indigo-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl">✨</div>
                    <div>
                      <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Current Custom Status</p>
                      <p className="text-lg font-black text-slate-800 leading-none mt-1">{myState.activity.customText}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCustomModal(true)} className="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
               </div>
            )}

            {/* Predefined Vibe Card */}
            <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-3 block">Status Vibe</span>
              <p className="text-2xl font-bold italic leading-snug">"{humorCaption}"</p>
            </div>

            {/* Activity Grid */}
            <div className="bg-white rounded-[3rem] p-8 border border-slate-100 shadow-sm">
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {ACTIVITIES.map(act => (
                  <ActivityCard 
                    key={act.type} 
                    {...act} 
                    isSelected={myState.activity.type === act.type} 
                    onClick={() => {
                      if (act.type === ActivityType.CUSTOM) {
                        setShowCustomModal(true);
                      } else {
                        handleUpdate(act.type);
                      }
                    }} 
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'widget' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-12 animate-in zoom-in-95 duration-500">
            <div className="text-center">
              <h2 className="text-4xl font-black text-slate-900 mb-3">Widget Preview</h2>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">This is exactly how {partnerName} sees you on their home screen.</p>
            </div>
            
            <WidgetView userA={myState} userB={partnerState} />

            <div className="bg-white p-6 rounded-[2.2rem] border border-slate-100 w-full max-w-sm flex items-center justify-between shadow-sm group hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-xl">💡</div>
                <div className="text-xs">
                  <p className="font-black text-slate-900">Add to Home Screen</p>
                  <p className="text-slate-400">Use this app as a native widget via PWA.</p>
                </div>
              </div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
             <h2 className="text-4xl font-black text-slate-900">Settings</h2>
             
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center space-x-5 p-5 bg-slate-50 rounded-3xl">
                   <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl">🧑‍🤝‍🧑</div>
                   <div className="flex-1">
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Paired Partner</p>
                      <p className="text-xl font-black text-slate-800">{partnerName}</p>
                   </div>
                   <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="text-red-500 text-sm font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-red-50 hover:bg-red-50 transition-colors">Unpair</button>
                </div>

                <div className="space-y-4">
                   <h3 className="text-lg font-black text-slate-800 ml-1">Profile</h3>
                   <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Your Name</label>
                      <input 
                        type="text" 
                        value={userName} 
                        onChange={e => setUserName(e.target.value)}
                        className="w-full p-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-indigo-500 outline-none font-bold"
                      />
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                   <span className="text-sm font-bold text-slate-500">Offline Cache Storage</span>
                   <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Active</span>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-3xl border-t border-slate-100 px-10 py-5 flex items-center justify-around z-50 md:hidden safe-bottom">
        <button onClick={() => setActiveTab('status')} className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'status' ? 'text-indigo-600' : 'text-slate-300'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Update</span>
        </button>
        <button onClick={() => setActiveTab('widget')} className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'widget' ? 'text-indigo-600' : 'text-slate-300'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Widget</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-300'}`}>
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Set</span>
        </button>
      </nav>

      {/* Syncing Overlay Indicator */}
      {isUpdating && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-2xl border border-indigo-100 flex items-center space-x-3 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-black text-indigo-600 uppercase tracking-widest">Syncing Vibes...</span>
        </div>
      )}

      {/* Custom Activity Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="text-center mb-8">
                 <div className="w-20 h-20 bg-indigo-50 rounded-[1.8rem] flex items-center justify-center text-4xl mx-auto mb-4">✨</div>
                 <h3 className="text-2xl font-black text-slate-900">Custom Status</h3>
                 <p className="text-gray-500 font-medium">What exactly are you doing?</p>
              </div>
              
              <input 
                autoFocus
                type="text" 
                maxLength={20}
                placeholder="E.g. Coffee run ☕"
                value={customInputValue}
                onChange={e => setCustomInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && customInputValue && handleUpdate(ActivityType.CUSTOM, customInputValue)}
                className="w-full p-5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white outline-none rounded-2xl font-bold text-center text-lg mb-6 transition-all"
              />

              <div className="flex space-x-3">
                 <button onClick={() => setShowCustomModal(false)} className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancel</button>
                 <button 
                  disabled={!customInputValue.trim()}
                  onClick={() => handleUpdate(ActivityType.CUSTOM, customInputValue)}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-40 transition-all"
                 >
                   Update
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
