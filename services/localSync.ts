
import { ActivityType, WeatherInfo } from "../types";

const CAPTIONS: Record<string, string[]> = {
  [ActivityType.WORK]: ["Grinding through the to-do list! 💼", "Productivity mode: ON. 🚀", "Making big moves! ✨", "Don't worry, I'm almost done. ⏳"],
  [ActivityType.CODING]: ["Debugging the universe. 💻", "Writing bugs... I mean code! 🐞", "In the zone! Do not disturb. 🔥", "01001100 01001111 01010110 01000101 ❤️"],
  [ActivityType.GAMING]: ["One more level, I promise! 🎮", "Saving the world, one boss at a time. ⚔️", "GG WP! 🏆", "Focused on the win! 🕹️"],
  [ActivityType.COMMUTING]: ["On the move! 🚌", "Thinking about you while traveling. ❤️", "Traffic is fun... said no one ever. 🚗", "Almost home! 🏠"],
  [ActivityType.SLEEPING]: ["Dreaming of us. 😴", "Recharging the batteries. 🔋", "Zzz... Do not disturb. 🛌", "Hibernation mode activated. 🌙"],
  [ActivityType.STUDYING]: ["Knowledge is power! 📚", "Cramming for the future. 🎓", "Brain is 99% full. 🧠", "Studying hard for us! 💪"],
  [ActivityType.COOKING]: ["Chef in the kitchen! 🍳", "Cooking up something delicious. 🍕", "Seasoned with love! ❤️", "Hope I don't burn it! 🔥"],
  [ActivityType.EXERCISING]: ["Getting those gains! 💪", "Sweating for the goals. 🏋️‍♂️", "No pain, no gain! ⚡", "Endorphin rush! 🏃‍♂️"],
  [ActivityType.RELAXING]: ["Chilling like a villain. 🛋️", "Inner peace found. 🧘", "Decompressing... 🍃", "Quiet time is the best time. ✨"],
  [ActivityType.TRAVELING]: ["Adventure awaits! ✈️", "Exploring new horizons. 🗺️", "Postcard perfect! 🧳", "Collecting memories. 📸"],
  [ActivityType.EATING]: ["Yum! Best meal ever. 🍕", "Food is fuel. 🍽️", "Treating myself! 🍰", "Eating my heart out. 🌮"],
  [ActivityType.CUSTOM]: ["Living my best life! ✨", "Just doing my thing. ✌️", "Keeping it real. 🔥", "Vibe check: Passed. ✅"]
};

export const WELCOME_PHRASES = [
  "Back for more syncing? 🛰️",
  "The better half is here! 🌟",
  "Partner in crime, back online. 🕵️‍♂️",
  "Ready to show 'em how it's done? 💪",
  "Syncing the vibes... please wait (jk). 🔥",
  "The favorite person has entered the chat. ✨",
  "Is it snack time yet? 🍕",
  "Go get 'em, Tiger! 🐅",
  "You look great today, just sayin'. 😉",
  "Time to make some memories. 📸"
];

export const getHumorousCaption = (activity: ActivityType, status: string, mood: string): string => {
  const options = CAPTIONS[activity] || CAPTIONS[ActivityType.CUSTOM];
  return options[Math.floor(Math.random() * options.length)];
};

export const getSimulatedWeather = (lat?: number, lon?: number): WeatherInfo => {
  const conditions = [
    { condition: "Sunny", icon: "☀️", tempRange: [20, 35] },
    { condition: "Partly Cloudy", icon: "⛅", tempRange: [15, 25] },
    { condition: "Rainy", icon: "🌧️", tempRange: [10, 20] },
    { condition: "Cloudy", icon: "☁️", tempRange: [12, 22] },
    { condition: "Clear Night", icon: "🌙", tempRange: [10, 18] }
  ];

  const hour = new Date().getHours();
  let baseIndex = (hour >= 6 && hour <= 18) ? 0 : 4;
  
  let bias = 0;
  if (lat) bias = Math.floor(lat / 10);

  const selected = conditions[Math.floor(Math.random() * 3) + (hour > 18 ? 2 : 0)] || conditions[0];
  const temp = Math.floor(Math.random() * (selected.tempRange[1] - selected.tempRange[0])) + selected.tempRange[0] + bias;

  return {
    temp,
    condition: selected.condition,
    icon: selected.icon
  };
};
