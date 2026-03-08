export interface Task {
  id: number;
  text: string;
  time: string;
  done: boolean;
}

export interface Expense {
  id: number;
  note: string;
  amt: number;
}

export interface Goal {
  id: number;
  title: string;
  target: string;
}

export interface Notebook {
  id: number;
  title: string;
  content: string;
}

export interface PermNote {
  id: number;
  title: string;
  desc: string;
}

export interface Transaction {
  type: 'pawa' | 'dena';
  amount: number;
  note: string;
}

export interface Habit {
  id: number;
  title: string;
  checked: boolean;
}

export interface DayData {
  mood: string;
  water: number;
  tasks: Task[];
  expenses: Expense[];
  accounts: Record<string, { trans: Transaction[] }>;
  habits: Habit[];
  notebooks: Notebook[];
  activeNoteId: number;
  namaz: Record<string, boolean>;
  quickNotesArray: string[];
  sleepStart: string;
  sleepEnd: string;
  sleepHours: number;
}

export interface ExtraSettings {
  dailyLimit: number;
  monthlyLimit: number;
  sleepTime: string;
}

export interface NamazTimes {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}
