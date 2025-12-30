
import { ActivityType } from './types';

export const ACTIVITIES = [
  { type: ActivityType.WORK, icon: '💼', charM: '👨‍💼', charF: '👩‍💼', color: 'bg-blue-50 text-blue-700', border: 'border-blue-100' },
  { type: ActivityType.CODING, icon: '💻', charM: '👨‍💻', charF: '👩‍💻', color: 'bg-indigo-50 text-indigo-700', border: 'border-indigo-100' },
  { type: ActivityType.GAMING, icon: '🎮', charM: '🕹️', charF: '🕹️', color: 'bg-purple-50 text-purple-700', border: 'border-purple-100' },
  { type: ActivityType.STUDYING, icon: '📚', charM: '👨‍🎓', charF: '👩‍🎓', color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-100' },
  { type: ActivityType.COMMUTING, icon: '🚇', charM: '🏃‍♂️', charF: '🏃‍♀️', color: 'bg-orange-50 text-orange-700', border: 'border-orange-100' },
  { type: ActivityType.COOKING, icon: '🍳', charM: '👨‍🍳', charF: '👩‍🍳', color: 'bg-red-50 text-red-700', border: 'border-red-100' },
  { type: ActivityType.EATING, icon: '🍕', charM: '😋', charF: '😋', color: 'bg-green-50 text-green-700', border: 'border-green-100' },
  { type: ActivityType.EXERCISING, icon: '🏋️‍♂️', charM: '🏋️‍♂️', charF: '🏋️‍♀️', color: 'bg-rose-50 text-rose-700', border: 'border-rose-100' },
  { type: ActivityType.TRAVELING, icon: '✈️', charM: '🎒', charF: '🎒', color: 'bg-sky-50 text-sky-700', border: 'border-sky-100' },
  { type: ActivityType.RELAXING, icon: '🛋️', charM: '🧘‍♂️', charF: '🧘‍♀️', color: 'bg-emerald-50 text-emerald-700', border: 'border-emerald-100' },
  { type: ActivityType.SLEEPING, icon: '😴', charM: '🛌', charF: '🛌', color: 'bg-slate-800 text-white', border: 'border-slate-700' },
  { type: ActivityType.CUSTOM, icon: '✨', charM: '👨', charF: '👩', color: 'bg-white text-gray-700', border: 'border-gray-200' },
];

export const ACTIVITY_DEFAULT_MOODS: Record<ActivityType, string> = {
  [ActivityType.WORK]: '😤 Focused',
  [ActivityType.CODING]: '😤 Focused',
  [ActivityType.GAMING]: '😤 Focused',
  [ActivityType.STUDYING]: '🤔 Thinking',
  [ActivityType.COMMUTING]: '😐 Busy',
  [ActivityType.COOKING]: '😊 Happy',
  [ActivityType.EATING]: '😊 Happy',
  [ActivityType.EXERCISING]: '😤 Focused',
  [ActivityType.TRAVELING]: '🤩 Excited',
  [ActivityType.RELAXING]: '🧘 Calm',
  [ActivityType.SLEEPING]: '😴 Sleepy',
  [ActivityType.CUSTOM]: '😊 Happy',
};

export const MOODS = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '😤', label: 'Focused' },
  { emoji: '🧘', label: 'Calm' },
  { emoji: '🫠', label: 'Exhausted' },
  { emoji: '🤩', label: 'Excited' },
  { emoji: '🤔', label: 'Thinking' },
  { emoji: '😐', label: 'Busy' },
  { emoji: '😴', label: 'Sleepy' },
];

export const AVATARS = ['👨', '👩', '🧑', '🐱', '🐶', '🦊', '🤖', '👻', '👾', '👽', '🍕', '🌍', '🧛', '🧙', '🦸'];

export const INITIAL_ACTIVITY = {
  type: ActivityType.RELAXING,
  statusText: 'Active now',
  mood: '😊 Happy',
  timestamp: Date.now(),
  weather: { temp: 24, condition: 'Clear', icon: '☀️' }
};
