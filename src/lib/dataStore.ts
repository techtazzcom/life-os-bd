// LocalStorage based data management for Life OS

export interface User {
  name: string;
  email: string;
  mobile: string;
  dob: string;
  address: string;
  password: string;
  blood_group?: string;
  institution?: string;
  hobby?: string;
}

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

export interface AccountPerson {
  trans: Transaction[];
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
  accounts: Record<string, AccountPerson>;
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

const getKey = (base: string, email: string) => `${base}_${email}`;

export function getCurrentUser(): User | null {
  const data = localStorage.getItem('life_os_current_user');
  return data ? JSON.parse(data) : null;
}

export function setCurrentUser(user: User) {
  localStorage.setItem('life_os_current_user', JSON.stringify(user));
}

export function logoutUser() {
  localStorage.removeItem('life_os_current_user');
}

export function registerUser(user: User): boolean {
  const users: User[] = JSON.parse(localStorage.getItem('life_os_users') || '[]');
  if (users.find(u => u.email === user.email)) return false;
  users.push(user);
  localStorage.setItem('life_os_users', JSON.stringify(users));
  return true;
}

export function loginUser(email: string, password: string): User | null {
  const users: User[] = JSON.parse(localStorage.getItem('life_os_users') || '[]');
  return users.find(u => u.email === email && u.password === password) || null;
}

export function updateUserProfile(updated: User) {
  const users: User[] = JSON.parse(localStorage.getItem('life_os_users') || '[]');
  const idx = users.findIndex(u => u.email === updated.email);
  if (idx >= 0) users[idx] = updated;
  localStorage.setItem('life_os_users', JSON.stringify(users));
  setCurrentUser(updated);
}

export function saveDayData(email: string, date: string, data: DayData) {
  localStorage.setItem(getKey(`day_${date}`, email), JSON.stringify(data));
}

export function loadDayData(email: string, date: string): DayData | null {
  const d = localStorage.getItem(getKey(`day_${date}`, email));
  return d ? JSON.parse(d) : null;
}

export function getGoals(email: string): Goal[] {
  return JSON.parse(localStorage.getItem(getKey('goals', email)) || '[]');
}

export function saveGoals(email: string, goals: Goal[]) {
  localStorage.setItem(getKey('goals', email), JSON.stringify(goals));
}

export function getPermNotes(email: string): PermNote[] {
  return JSON.parse(localStorage.getItem(getKey('perm_notes', email)) || '[]');
}

export function savePermNotes(email: string, notes: PermNote[]) {
  localStorage.setItem(getKey('perm_notes', email), JSON.stringify(notes));
}

export function getNamazTimes(email: string): NamazTimes {
  const d = localStorage.getItem(getKey('namaz_times', email));
  return d ? JSON.parse(d) : { fajr: "05:30", dhuhr: "13:30", asr: "16:45", maghrib: "18:20", isha: "20:00" };
}

export function saveNamazTimes(email: string, times: NamazTimes) {
  localStorage.setItem(getKey('namaz_times', email), JSON.stringify(times));
}

export function getExtraSettings(email: string): ExtraSettings {
  const d = localStorage.getItem(getKey('extra_settings', email));
  return d ? JSON.parse(d) : { dailyLimit: 500, monthlyLimit: 15000, sleepTime: "22:00" };
}

export function saveExtraSettings(email: string, settings: ExtraSettings) {
  localStorage.setItem(getKey('extra_settings', email), JSON.stringify(settings));
}

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}
