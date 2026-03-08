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

export interface Medicine {
  id: number;
  name: string;
  dose: string;
  times: string[]; // e.g. ["08:00", "20:00"]
}

export interface MedicineDose {
  medId: number;
  time: string;
  taken: boolean;
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
  medicineDoses?: MedicineDose[];
}

export interface ExtraSettings {
  dailyLimit: number;
  monthlyLimit: number;
  sleepTime: string;
  medicines?: Medicine[];
}

export interface NamazTimes {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}
