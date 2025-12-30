
export enum ActivityType {
  WORK = 'Work',
  CODING = 'Coding',
  GAMING = 'Gaming',
  COMMUTING = 'Commuting',
  SLEEPING = 'Sleeping',
  STUDYING = 'Studying',
  COOKING = 'Cooking',
  EXERCISING = 'Exercising',
  RELAXING = 'Relaxing',
  TRAVELING = 'Traveling',
  EATING = 'Eating',
  CUSTOM = 'Custom'
}

export type Gender = 'male' | 'female';

export interface WeatherInfo {
  temp: number;
  condition: string;
  icon: string;
}

export interface UserActivity {
  type: ActivityType;
  customText?: string;
  statusText: string;
  mood: string;
  timestamp: number;
  weather?: WeatherInfo;
}

export interface UserState {
  id: string;
  name: string;
  gender: Gender;
  activity: UserActivity;
}
