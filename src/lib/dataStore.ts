import { supabase } from "@/integrations/supabase/client";
import type { DayData, Goal, PermNote, NamazTimes, ExtraSettings } from "./types";
import type { Json } from "@/integrations/supabase/types";

export type { DayData, Goal, PermNote, NamazTimes, ExtraSettings };
export type { Task, Expense, Notebook, Habit, Transaction } from "./types";

export interface UserProfile {
  name: string;
  email: string;
  mobile: string;
  dob: string;
  address: string;
  blood_group?: string;
  institution?: string;
  hobby?: string;
  intro?: string;
  work?: string;
  website?: string;
  social_link?: string;
  hide_email?: boolean;
  hide_mobile?: boolean;
  avatar_url?: string;
}

export async function signUp(email: string, password: string, name: string, extra?: { mobile?: string; dob?: string; address?: string }) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name, mobile: extra?.mobile || '', dob: extra?.dob || '', address: extra?.address || '' }, emailRedirectTo: window.location.origin }
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
  return data ? { name: data.name, email: data.email, mobile: data.mobile || '', dob: data.dob || '', address: data.address || '', blood_group: data.blood_group || '', institution: data.institution || '', hobby: data.hobby || '', intro: (data as any).intro || '', work: (data as any).work || '', website: (data as any).website || '', social_link: (data as any).social_link || '', hide_email: !!(data as any).hide_email, hide_mobile: !!(data as any).hide_mobile, avatar_url: (data as any).avatar_url || '' } : null;
}

export async function updateProfile(profile: UserProfile) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({
    name: profile.name, mobile: profile.mobile, dob: profile.dob,
    address: profile.address, blood_group: profile.blood_group,
    institution: profile.institution, hobby: profile.hobby,
    intro: profile.intro, work: profile.work, website: profile.website,
    social_link: profile.social_link, hide_email: profile.hide_email, hide_mobile: profile.hide_mobile,
  } as any).eq('user_id', user.id);
}

export async function saveDayData(date: string, data: DayData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_data').upsert({
    user_id: user.id,
    date_key: date,
    data_content: data as unknown as Json,
  }, { onConflict: 'user_id,date_key' });
}

export async function loadDayData(date: string): Promise<DayData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('user_data').select('data_content').eq('user_id', user.id).eq('date_key', date).single();
  return data ? (data.data_content as unknown as DayData) : null;
}

async function getSettings() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
  return data;
}

export async function getGoals(): Promise<Goal[]> {
  const s = await getSettings();
  return s ? (s.goals as unknown as Goal[]) : [];
}

export async function saveGoals(goals: Goal[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_settings').update({ goals: goals as unknown as Json }).eq('user_id', user.id);
}

export async function getPermNotes(): Promise<PermNote[]> {
  const s = await getSettings();
  return s ? (s.perm_notes as unknown as PermNote[]) : [];
}

export async function savePermNotes(notes: PermNote[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_settings').update({ perm_notes: notes as unknown as Json }).eq('user_id', user.id);
}

export async function getNamazTimes(): Promise<NamazTimes> {
  const s = await getSettings();
  return s ? (s.namaz_times as unknown as NamazTimes) : { fajr: "05:30", dhuhr: "13:30", asr: "16:45", maghrib: "18:20", isha: "20:00" };
}

export async function saveNamazTimes(times: NamazTimes) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_settings').update({ namaz_times: times as unknown as Json }).eq('user_id', user.id);
}

export async function getExtraSettings(): Promise<ExtraSettings> {
  const s = await getSettings();
  return s ? (s.extra_settings as unknown as ExtraSettings) : { dailyLimit: 500, monthlyLimit: 15000, sleepTime: "22:00" };
}

export async function saveExtraSettings(settings: ExtraSettings) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_settings').update({ extra_settings: settings as unknown as Json }).eq('user_id', user.id);
}

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}
