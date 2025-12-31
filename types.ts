
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
  customText?: string | null;
  statusText: string;
  mood: string;
  timestamp: number;
  weather?: WeatherInfo | null;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface UserState {
  id: string;
  name: string;
  avatar?: string;
  gender: Gender;
  activity: UserActivity;
  messages?: Message[];
  partners?: string[]; // Array of User IDs synced to the cloud
}

export interface PartnerRecord {
  id: string;
  roomCode: string;
  state: UserState;
  lastSeen: number;
}
