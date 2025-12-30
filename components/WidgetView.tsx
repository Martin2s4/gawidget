
import React from 'react';
import { UserState } from '../types';
import { ACTIVITIES } from '../constants';

const UserPanel: React.FC<{ user: UserState; isRight?: boolean }> = ({ user, isRight }) => {
  const activityDef = ACTIVITIES.find(a => a.type === user.activity.type) || ACTIVITIES[0];
  const char = user.gender === 'female' ? activityDef.charF : activityDef.charM;
  
  return (
    <div className={`flex flex-col h-full w-full p-6 transition-all duration-700 ${isRight ? 'bg-indigo-50/60' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {user.name}
        </h4>
        <div className="flex items-center space-x-1 opacity-70">
          <span className="text-[10px] font-bold">{user.activity.weather?.temp}°</span>
          <span className="text-xs">{user.activity.weather?.icon}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className={`w-28 h-28 rounded-[2rem] flex items-center justify-center text-6xl shadow-sm border ${activityDef.border} ${activityDef.color}`}>
          {char}
        </div>
        <div className="mt-5 text-center">
          <div className="text-lg font-black text-gray-900 leading-none truncate max-w-[120px]">
            {user.activity.type === 'Custom' ? (user.activity.customText || 'Other') : user.activity.type}
          </div>
          <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-2 opacity-80">
            {user.activity.statusText}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full border border-gray-100 shadow-sm text-xs font-medium">
          {user.activity.mood}
        </div>
      </div>
    </div>
  );
};

export const WidgetView: React.FC<{ userA: UserState; userB: UserState }> = ({ userA, userB }) => {
  return (
    <div className="widget-container w-full max-w-sm mx-auto">
      <div className="widget-inner relative flex aspect-[4/3] rounded-[3.5rem] overflow-hidden border-8 border-gray-900 bg-gray-900">
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gray-900/10 z-10" />
        <UserPanel user={userA} />
        <UserPanel user={userB} isRight />
      </div>
    </div>
  );
};
