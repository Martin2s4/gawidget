
import { ActivityType } from './types';

export const ACTIVITIES = [
  { type: ActivityType.WORK, icon: '💼', char: '🧑‍💼', color: 'bg-blue-50 text-blue-700', border: 'border-blue-100' },
  { type: ActivityType.CODING, icon: '💻', char: '🧑‍💻', color: 'bg-indigo-50 text-indigo-700', border: 'border-indigo-100' },
  { type: ActivityType.GAMING, icon: '🎮', char: '🎮', color: 'bg-purple-50 text-purple-700', border: 'border-purple-100' },
  { type: ActivityType.COMMUTING, icon: '🚌', char: '🚶', color: 'bg-slate-50 text-slate-700', border: 'border-slate-100' },
  { type: ActivityType.SLEEPING, icon: '😴', char: '🛌', color: 'bg-gray-800 text-white', border: 'border-gray-700' },
  { type: ActivityType.STUDYING, icon: '📚', char: '🧑‍🎓', color: 'bg-amber-50 text-amber-700', border: 'border-amber-100' },
  { type: ActivityType.COOKING, icon: '👨‍🍳', char: '🍳', color: 'bg-orange-50 text-orange-700', border: 'border-orange-100' },
  { type: ActivityType.EXERCISING, icon: '🏋️‍♂️', char: '💪', color: 'bg-rose-50 text-rose-700', border: 'border-rose-100' },
  { type: ActivityType.RELAXING, icon: '🛋️', char: '🧘', color: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-100' },
  { type: ActivityType.TRAVELING, icon: '✈️', char: '🧳', color: 'bg-cyan-50 text-cyan-700', border: 'border-cyan-100' },
  { type: ActivityType.EATING, icon: '🍕', char: '🍽️', color: 'bg-pink-50 text-pink-700', border: 'border-pink-100' },
  { type: ActivityType.CUSTOM, icon: '✨', char: '👤', color: 'bg-white text-gray-700', border: 'border-gray-200' },
];

export const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '😤', label: 'Focused' },
  { emoji: '🧘', label: 'Calm' },
  { emoji: '🤩', label: 'Excited' },
  { emoji: '🫠', label: 'Exhausted' },
];

export const INITIAL_ACTIVITY = {
  type: ActivityType.RELAXING,
  statusText: 'Active now',
  mood: '😊 Happy',
  timestamp: Date.now(),
  weather: { temp: 24, condition: 'Clear', icon: '☀️' }
};
