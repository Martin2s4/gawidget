
import { ActivityType, WeatherInfo } from "../types";

const CAPTIONS: Record<string, string[]> = {
  [ActivityType.WORK]: [
    "Productivity mode: ON. 🚀",
    "Making moves, not excuses. 💼",
    "In the zone. Do not disturb. 🛑",
    "Chasing that bread. 🥖",
    "Meeting marathon in progress. 🏃‍♂️",
    "Adulting is hard, but I'm doing it. 👔"
  ],
  [ActivityType.CODING]: [
    "Debugging the universe. 💻",
    "It works on my machine! 🤷‍♂️",
    "Turning coffee into code. ☕",
    "Console.log('Help'). 🐛",
    "Compiling... please wait. ⏳",
    "Stack Overflow is my co-pilot. 👩‍✈️"
  ],
  [ActivityType.GAMING]: [
    "One more level, I promise! 🎮",
    "Lag is my only enemy. 📶",
    "Saving the world (virtually). ⚔️",
    "Ranked match. Serious business. 🏆",
    "Just paused life for this. ⏸️",
    "Respawning in 3... 2... 1... 🧟"
  ],
  [ActivityType.COMMUTING]: [
    "On the move! 🚌",
    "Traffic jam jamming. 🚗",
    "Podcasting and traveling. 🎧",
    "Subway surfer IRL. 🚇",
    "Teleportation when? 🛸",
    "Cruising through the chaos. 🚦"
  ],
  [ActivityType.SLEEPING]: [
    "Dreaming... 😴",
    "Recharging batteries. 🔋",
    "Do not wake unless pizza. 🍕",
    "Entering REM cycle. 💤",
    "Snooze button champion. 🏆",
    "Offline for maintenance. 🛌"
  ],
  [ActivityType.STUDYING]: [
    "Knowledge is power! 📚",
    "Brain expanding... 🧠",
    "Cramming session active. 📝",
    "Highlighting everything. 🖍️",
    "Library mode engaged. 🤫",
    "Fueled by caffeine and panic. ☕"
  ],
  [ActivityType.COOKING]: [
    "Chef in the kitchen! 🍳",
    "MasterChef audition tape. 🎥",
    "Don't burn the house down. 🔥",
    "Taste testing in progress. 🥄",
    "Adding a pinch of love. ❤️",
    "Whisk taking risks. 🥣"
  ],
  [ActivityType.EXERCISING]: [
    "Getting those gains! 💪",
    "Sweat is just fat crying. 💧",
    "Beast mode activated. 🦍",
    "Running away from problems. 🏃",
    "Leg day... pray for me. 🙏",
    "Endorphins loading... 🔋"
  ],
  [ActivityType.RELAXING]: [
    "Inner peace found. 🧘",
    "Doing absolutely nothing. 🍃",
    "Netflix and chill. 🍿",
    "Horizontal life. 🛋️",
    "Zen mode: 100%. 🎋",
    "Recharging the social battery. 🔋"
  ],
  [ActivityType.TRAVELING]: [
    "Adventure awaits! ✈️",
    "Catch flights, not feelings. 🛫",
    "Wanderlust enabled. 🗺️",
    "Passport stamps incoming. 🛂",
    "Out of office. Forever? 🌴",
    "Tourist mode: ON. 📸"
  ],
  [ActivityType.EATING]: [
    "Yum! 🍕",
    "Food coma imminent. 😋",
    "Calories don't count today. 🍔",
    "Feast mode. 🍖",
    "Just here for the snacks. 🥨",
    "Taste bud party! 🎉"
  ],
  [ActivityType.CUSTOM]: [
    "Living my best life! ✨",
    "Main character energy. 🌟",
    "Vibing at a frequency of cool. 🌊",
    "Plotting world domination. 😈",
    "Just being iconic. 💅",
    "Mystery mode activated. 🕵️"
  ]
};

export const WELCOME_PHRASES = [
  "Back for more syncing? 🛰️",
  "The better half is here! 🌟",
  "Partner in crime, back online. 🕵️‍♂️",
  "Ready to sync up? 🚀",
  "Welcome back, legend. 👑"
];

export const HUMAN_PARTNER_REPLIES = [
  "Love that status! ❤️",
  "Miss you! ✨",
  "Thinking about you too! 🔥"
];

export const getHumorousCaption = (activity: ActivityType, status: string, mood: string): string => {
  const options = CAPTIONS[activity] || CAPTIONS[ActivityType.CUSTOM];
  // Ensure randomness by picking a random index based on array length
  return options[Math.floor(Math.random() * options.length)];
};

export const getSimulatedWeather = (lat?: number, lon?: number): WeatherInfo => {
  const conditions = [
    { condition: "Sunny", icon: "☀️", tempRange: [20, 35] },
    { condition: "Partly Cloudy", icon: "⛅", tempRange: [15, 25] },
    { condition: "Clear Night", icon: "🌙", tempRange: [10, 18] },
    { condition: "Rainy", icon: "🌧️", tempRange: [12, 20] },
    { condition: "Windy", icon: "💨", tempRange: [10, 22] }
  ];
  // Simple "hash" based on time to keep weather somewhat consistent for short periods if needed, 
  // but for simulation, random is fine.
  const selected = conditions[Math.floor(Math.random() * conditions.length)];
  const temp = Math.floor(Math.random() * (selected.tempRange[1] - selected.tempRange[0])) + selected.tempRange[0];

  return { temp, condition: selected.condition, icon: selected.icon };
};
