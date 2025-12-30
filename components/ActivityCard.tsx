
import React from 'react';
import { ActivityType } from '../types';

interface ActivityCardProps {
  type: ActivityType;
  icon: string;
  color: string;
  border: string;
  isSelected: boolean;
  onClick: () => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  type, icon, color, border, isSelected, onClick
}) => {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 hover:scale-105 active:scale-95 ${
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-200 ring-offset-2' : border
      } ${color}`}
    >
      <span className="text-3xl mb-2">{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-wider">{type}</span>
      {isSelected && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
};
