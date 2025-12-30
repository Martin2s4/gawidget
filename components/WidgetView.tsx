
import React, { useState } from 'react';
import { UserState, ActivityType } from '../types';
import { ACTIVITIES, MOODS } from '../constants';

interface WidgetViewProps {
  userA: UserState;
  userB: UserState;
  onActivityChange?: (type: ActivityType) => void;
  onMoodChange?: (mood: string) => void;
}

const UserPanel: React.FC<{ 
  user: UserState; 
  isRight?: boolean; 
  isMe?: boolean;
  onActivityChange?: (type: ActivityType) => void;
  onMoodChange?: (mood: string) => void;
}> = ({ user, isRight, isMe, onActivityChange, onMoodChange }) => {
  const [showPicker, setShowPicker] = useState(false);
  const activityDef = ACTIVITIES.find(a => a.type === user.activity.type) || ACTIVITIES[0];
  
  // Custom Avatar logic: prioritize user.avatar, then fallback to activity/gender character
  const char = user.avatar || (user.gender === 'female' ? activityDef.charF : activityDef.charM);
  
  return (
    <div className={`flex flex-col h-full w-full p-4 transition-all duration-700 relative ${isRight ? 'bg-indigo-50/60 dark:bg-indigo-900/40' : 'bg-white dark:bg-slate-900'}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
          {user.name} {isMe && "📍"}
        </h4>
        <div className="flex items-center space-x-1 opacity-70 text-gray-900 dark:text-slate-300">
          <span className="text-[9px] font-bold">{user.activity.weather?.temp}°</span>
          <span className="text-xs">{user.activity.weather?.icon}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <button 
          disabled={!isMe}
          onClick={() => isMe && setShowPicker(!showPicker)}
          className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center text-4xl shadow-sm border transition-all active:scale-90 ${activityDef.border} ${activityDef.color} ${isMe ? 'cursor-pointer hover:shadow-indigo-100 dark:hover:shadow-none hover:shadow-lg' : 'cursor-default'}`}
        >
          {char}
        </button>
        <div className="mt-3 text-center">
          <div className="text-sm font-black text-gray-900 dark:text-white leading-none truncate max-w-[100px]">
            {user.activity.type === 'Custom' ? (user.activity.customText || 'Other') : user.activity.type}
          </div>
          <div className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-1 opacity-80">
            {user.activity.statusText}
          </div>
        </div>
      </div>

      <div className="mt-2 flex justify-center">
        <button 
          disabled={!isMe}
          onClick={() => isMe && setShowPicker(!showPicker)}
          className={`bg-white/90 dark:bg-slate-800/90 backdrop-blur px-2 py-0.5 rounded-full border border-gray-100 dark:border-slate-700 shadow-sm text-[9px] font-bold dark:text-slate-300 ${isMe ? 'hover:bg-indigo-50 dark:hover:bg-indigo-900/50' : ''}`}
        >
          {user.activity.mood}
        </button>
      </div>

      {isMe && showPicker && (
        <div className="absolute inset-0 bg-white/98 dark:bg-slate-900/98 backdrop-blur-md z-40 p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200 rounded-3xl shadow-xl">
          <div className="flex justify-between items-center mb-3">
             <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Switch Vibe</span>
             <button onClick={() => setShowPicker(false)} className="text-gray-400 dark:text-slate-600 p-1 text-xs">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-2 flex-1 overflow-y-auto pr-1 scrollbar-hide">
            {ACTIVITIES.map(act => (
              <button 
                key={act.type}
                onClick={() => { onActivityChange?.(act.type); setShowPicker(false); }}
                className={`p-1.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-90 ${user.activity.type === act.type ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-50 dark:border-slate-800 bg-gray-50 dark:bg-slate-800'}`}
              >
                <span className="text-xl mb-0.5">{act.icon}</span>
                <span className="text-[7px] font-black uppercase truncate w-full text-center text-gray-800 dark:text-slate-300">{act.type}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1 border-t dark:border-slate-800 pt-2">
             {MOODS.map(m => (
               <button 
                key={m.label} 
                onClick={() => { onMoodChange?.(`${m.emoji} ${m.label}`); setShowPicker(false); }}
                className="text-base p-0.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
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

export const WidgetView: React.FC<WidgetViewProps> = ({ userA, userB, onActivityChange, onMoodChange }) => {
  return (
    <div className="widget-container w-full max-w-sm mx-auto relative transition-all">
      <div className="widget-inner relative flex aspect-[4/3.5] rounded-[3.5rem] overflow-hidden border-8 border-gray-900 dark:border-slate-800 bg-gray-900 dark:bg-slate-800 shadow-2xl">
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gray-900/10 dark:bg-slate-800/20 z-10" />
        <UserPanel user={userA} isMe onActivityChange={onActivityChange} onMoodChange={onMoodChange} />
        <UserPanel user={userB} isRight />
      </div>
    </div>
  );
};
