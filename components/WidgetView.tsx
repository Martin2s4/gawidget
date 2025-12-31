
import React, { useState } from 'react';
import { UserState, ActivityType } from '../types';
import { ACTIVITIES, MOODS } from '../constants';

interface WidgetViewProps {
  userA: UserState;
  userB: UserState;
  onActivityChange?: (type: ActivityType) => void;
  onMoodChange?: (mood: string) => void;
  showInstall?: boolean;
  onInstall?: () => void;
  partnerOnline?: boolean;
}

const UserPanel: React.FC<{ 
  user: UserState; 
  isRight?: boolean; 
  isMe?: boolean;
  onActivityChange?: (type: ActivityType) => void;
  onMoodChange?: (mood: string) => void;
  isOnline?: boolean;
}> = ({ user, isRight, isMe, onActivityChange, onMoodChange, isOnline }) => {
  const [showPicker, setShowPicker] = useState(false);
  const activityDef = ACTIVITIES.find(a => a.type === user.activity.type) || ACTIVITIES[0];
  
  // Use the activity icon (e.g. 💼, 💻) instead of the user avatar/gendered char
  // to match the image shown on the selection card.
  const char = activityDef.icon;
  
  return (
    <div className={`flex flex-col h-full w-full p-5 transition-all duration-500 relative ${isRight ? 'bg-indigo-50/40 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            {isMe ? "YOU" : "PARTNER"}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate max-w-[80px]">
              {user.name}
            </span>
            {/* Online Indicator */}
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-900/50 dark:bg-stone-700'}`} title={isOnline ? "Online" : "Offline"} />
          </div>
        </div>
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
          <span className="text-[10px] font-black dark:text-slate-300">{user.activity.weather?.temp}°</span>
          <span className="text-xs ml-1">{user.activity.weather?.icon}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <button 
          disabled={!isMe}
          onClick={() => isMe && setShowPicker(!showPicker)}
          className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center text-5xl shadow-2xl border-4 transition-all ${isMe ? 'active:scale-90 hover:scale-105 cursor-pointer ring-4 ring-indigo-500/10' : 'cursor-default'} ${activityDef.border} ${activityDef.color} bg-white dark:bg-slate-800`}
        >
          {char}
        </button>
        <div className="mt-4 text-center">
          <div className="text-base font-black text-slate-900 dark:text-white leading-none">
            {user.activity.type === 'Custom' ? (user.activity.customText || 'Other') : user.activity.type}
          </div>
          <div className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.15em] mt-2 opacity-90 max-w-[120px] mx-auto leading-tight">
            {user.activity.caption || user.activity.statusText}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button 
          disabled={!isMe}
          onClick={() => isMe && setShowPicker(!showPicker)}
          className={`bg-white dark:bg-slate-800 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 shadow-md text-[10px] font-bold text-slate-700 dark:text-slate-200 ${isMe ? 'hover:bg-indigo-50 dark:hover:bg-indigo-900/50' : ''}`}
        >
          {user.activity.mood}
        </button>
      </div>

      {isMe && showPicker && (
        <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl z-50 p-6 flex flex-col animate-in fade-in zoom-in-95 duration-300 rounded-[3rem] shadow-2xl">
          <div className="flex justify-between items-center mb-4">
             <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Update Presence</span>
             <button onClick={() => setShowPicker(false)} className="bg-slate-100 dark:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-3 flex-1 overflow-y-auto pr-2 scrollbar-hide">
            {ACTIVITIES.map(act => (
              <button 
                key={act.type}
                onClick={() => { onActivityChange?.(act.type); setShowPicker(false); }}
                className={`p-2 rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-95 ${user.activity.type === act.type ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-50 dark:border-slate-800 bg-slate-50 dark:bg-slate-800'}`}
              >
                <span className="text-2xl mb-1">{act.icon}</span>
                <span className="text-[8px] font-black uppercase truncate w-full text-center text-slate-800 dark:text-slate-300">{act.type}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-6 gap-2 border-t dark:border-slate-800 pt-4">
             {MOODS.map(m => (
               <button 
                key={m.label} 
                onClick={() => { onMoodChange?.(`${m.emoji} ${m.label}`); setShowPicker(false); }}
                className="text-xl p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-all hover:scale-125"
               >
                 {m.emoji}
               </button>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const WidgetView: React.FC<WidgetViewProps> = ({ userA, userB, onActivityChange, onMoodChange, showInstall, onInstall, partnerOnline }) => {
  return (
    <div className="widget-container w-full max-w-sm mx-auto relative group">
      <div className="widget-inner relative flex aspect-[4/4.5] rounded-[4rem] overflow-hidden border-[12px] border-slate-900 dark:border-slate-800 bg-slate-900 dark:bg-slate-800 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] transform transition-transform duration-500 hover:scale-[1.02]">
        <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-slate-900/10 dark:bg-slate-800/20 z-10" />
        <UserPanel user={userA} isMe onActivityChange={onActivityChange} onMoodChange={onMoodChange} isOnline={true} />
        <UserPanel user={userB} isRight isOnline={partnerOnline} />
      </div>

      {/* Install Button directly on the Widget Card */}
      {showInstall && (
        <button
           onClick={onInstall}
           className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-2.5 rounded-full shadow-2xl border-4 border-slate-50 dark:border-slate-950 z-20 flex items-center gap-2 animate-bounce active:scale-95 transition-all"
        >
           <span className="text-lg">📲</span>
           <span className="text-[10px] font-black uppercase tracking-widest">Install App</span>
        </button>
      )}

      <div className="absolute inset-0 pointer-events-none rounded-[4rem] bg-gradient-to-tr from-white/10 to-transparent opacity-30 dark:opacity-5"></div>
    </div>
  );
};
