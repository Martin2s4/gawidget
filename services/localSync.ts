
import { ActivityType, WeatherInfo } from "../types";

const CAPTIONS: Record<string, string[]> = {
  [ActivityType.WORK]: ["Productivity mode: ON. 🚀"],
  [ActivityType.CODING]: ["Debugging the universe. 💻"],
  [ActivityType.GAMING]: ["One more level, I promise! 🎮"],
  [ActivityType.COMMUTING]: ["On the move! 🚌"],
  [ActivityType.SLEEPING]: ["Dreaming... 😴"],
  [ActivityType.STUDYING]: ["Knowledge is power! 📚"],
  [ActivityType.COOKING]: ["Chef in the kitchen! 🍳"],
  [ActivityType.EXERCISING]: ["Getting those gains! 💪"],
  [ActivityType.RELAXING]: ["Inner peace found. 🧘"],
  [ActivityType.TRAVELING]: ["Adventure awaits! ✈️"],
  [ActivityType.EATING]: ["Yum! 🍕"],
  [ActivityType.CUSTOM]: ["Living my best life! ✨"]
};

export const WELCOME_PHRASES = [
  "Back for more syncing? 🛰️",
  "The better half is here! 🌟",
  "Partner in crime, back online. 🕵️‍♂️"
];

export const HUMAN_PARTNER_REPLIES = [
  "Love that status! ❤️",
  "Miss you! ✨",
  "Thinking about you too! 🔥"
];

export const getHumorousCaption = (activity: ActivityType, status: string, mood: string): string => {
  const options = CAPTIONS[activity] || CAPTIONS[ActivityType.CUSTOM];
  return options[Math.floor(Math.random() * options.length)];
};

export const getSimulatedWeather = (lat?: number, lon?: number): WeatherInfo => {
  const conditions = [
    { condition: "Sunny", icon: "☀️", tempRange: [20, 35] },
    { condition: "Partly Cloudy", icon: "⛅", tempRange: [15, 25] },
    { condition: "Clear Night", icon: "🌙", tempRange: [10, 18] }
  ];
  const hour = new Date().getHours();
  const selected = conditions[Math.floor(Math.random() * 3)] || conditions[0];
  const temp = Math.floor(Math.random() * (selected.tempRange[1] - selected.tempRange[0])) + selected.tempRange[0];

  return { temp, condition: selected.condition, icon: selected.icon };
};
