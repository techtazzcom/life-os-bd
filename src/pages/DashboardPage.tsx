import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getProfile, loadDayData, saveDayData, getGoals, saveGoals, getPermNotes, savePermNotes, getNamazTimes, getExtraSettings, saveExtraSettings, getAccounts, saveAccounts, getQuickNotes, saveQuickNotes, getHabitDefinitions, saveHabitDefinitions, getMonthlyExpenses, getTodayStr, getProfileForUser, loadDayDataForUser, getGoalsForUser, getPermNotesForUser, getNamazTimesForUser, getExtraSettingsForUser, getAccountsForUser, getQuickNotesForUser, getHabitDefinitionsForUser, getMonthlyExpensesForUser, type DayData, type Goal, type PermNote, type UserProfile, type NamazTimes, type ExtraSettings } from "@/lib/dataStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import type { Medicine, Habit, Transaction } from "@/lib/types";
import NavBar from "@/components/dashboard/NavBar";
import NotificationBell from "@/components/dashboard/NotificationBell";
import SummaryCards from "@/components/dashboard/SummaryCards";
import MoodTracker from "@/components/dashboard/MoodTracker";
import WaterTracker from "@/components/dashboard/WaterTracker";
import ProgressCard from "@/components/dashboard/ProgressCard";
import NewDayDialog from "@/components/dashboard/NewDayDialog";

// Lazy load heavier components
const TaskCard = lazy(() => import("@/components/dashboard/TaskCard"));
const GoalCard = lazy(() => import("@/components/dashboard/GoalCard"));
const ExpenseCard = lazy(() => import("@/components/dashboard/ExpenseCard"));
const NamazTracker = lazy(() => import("@/components/dashboard/NamazTracker"));
const HabitCard = lazy(() => import("@/components/dashboard/HabitCard"));
const DiaryCard = lazy(() => import("@/components/dashboard/DiaryCard"));
const QuickNoteCard = lazy(() => import("@/components/dashboard/QuickNoteCard"));
const SleepTracker = lazy(() => import("@/components/dashboard/SleepTracker"));
const PermNoteCard = lazy(() => import("@/components/dashboard/PermNoteCard"));
const AccountCard = lazy(() => import("@/components/dashboard/AccountCard"));
const AIAssistant = lazy(() => import("@/components/dashboard/AIAssistant"));
const MedicineCard = lazy(() => import("@/components/dashboard/MedicineCard"));
const WeeklyAnalytics = lazy(() => import("@/components/dashboard/WeeklyAnalytics"));
const SettingsModal = lazy(() => import("@/components/dashboard/SettingsModal"));
const DailySummary = lazy(() => import("@/components/dashboard/DailySummary"));
const ProfileModal = lazy(() => import("@/components/dashboard/ProfileModal"));
const NoDataDialog = lazy(() => import("@/components/dashboard/NoDataDialog"));
const SoundAlertManager = lazy(() => import("@/components/dashboard/SoundAlertManager"));
const AdminNotifBanner = lazy(() => import("@/components/dashboard/AdminNotifBanner"));

const CardSkeleton = () => (
  <div className="bg-card border border-border rounded-2xl p-4 animate-pulse">
    <div className="h-4 bg-secondary rounded w-1/3 mb-3"></div>
    <div className="h-3 bg-secondary rounded w-2/3"></div>
  </div>
);

const defaultDayData: DayData = {
  mood: '', water: 0, tasks: [], expenses: [],
  habits: [], notebooks: [{ id: 1, title: 'নোট ১', content: '' }],
  activeNoteId: 1, namaz: {},
  sleepStart: '', sleepEnd: '', sleepHours: 0,
};

const DashboardPage = () => {
  const navigate = useNavigate();
  useOnlineStatus();
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<DayData>(defaultDayData);
  const [goals, setGoalsState] = useState<Goal[]>([]);
  const [permNotes, setPermNotesState] = useState<PermNote[]>([]);
  const [accounts, setAccountsState] = useState<Record<string, { trans: Transaction[] }>>({});
  const [quickNotes, setQuickNotesState] = useState<string[]>(['']);
  const [habitDefs, setHabitDefs] = useState<Habit[]>([]);
  const [monthlyExpense, setMonthlyExpense] = useState(0);
  const [namazTimes, setNamazTimes] = useState<NamazTimes>({ fajr: "05:30", dhuhr: "13:30", asr: "16:45", maghrib: "18:20", isha: "20:00" });
  const [extraSettings, setExtraSettings] = useState<ExtraSettings>({ dailyLimit: 500, monthlyLimit: 15000, sleepTime: "22:00" });
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNoData, setShowNoData] = useState(false);
  const [showNewDay, setShowNewDay] = useState(false);
  const [loading, setLoading] = useState(true);

  // Impersonation
  const impersonateUserId = localStorage.getItem("impersonate_user_id");
  const impersonateUserName = localStorage.getItem("impersonate_user_name");
  const isImpersonating = !!impersonateUserId;

  const isToday = selectedDate === getTodayStr();
  const prevDateRef = useRef(getTodayStr());

  // Auto-switch to new day at midnight with greeting
  useEffect(() => {
    if (isImpersonating) return;
    const checkDateChange = () => {
      const today = getTodayStr();
      if (today !== prevDateRef.current) {
        prevDateRef.current = today;
        setSelectedDate(today);
        setShowNewDay(true);
      }
    };
    const interval = setInterval(checkDateChange, 5000);
    return () => clearInterval(interval);
  }, [isImpersonating]);

  // Load date-specific data
  useEffect(() => {
    const load = async () => {
      if (isImpersonating) {
        const saved = await loadDayDataForUser(impersonateUserId, selectedDate);
        if (!saved && selectedDate !== getTodayStr()) setShowNoData(true);
        setData(saved || defaultDayData);
      } else {
        const saved = await loadDayData(selectedDate);
        if (!saved && selectedDate !== getTodayStr()) setShowNoData(true);
        if (!saved && isToday) {
          const defs = await getHabitDefinitions();
          const freshHabits = defs.map(h => ({ ...h, checked: false }));
          setData({ ...defaultDayData, habits: freshHabits });
        } else if (saved) {
          setData(saved);
        } else {
          setData(defaultDayData);
        }
      }
    };
    load();
  }, [selectedDate, isToday, isImpersonating, impersonateUserId]);

  // Load persistent data (once)
  useEffect(() => {
    const load = async () => {
      if (isImpersonating) {
        const p = await getProfileForUser(impersonateUserId);
        setProfile(p);
        setGoalsState(await getGoalsForUser(impersonateUserId));
        setPermNotesState(await getPermNotesForUser(impersonateUserId));
        setAccountsState(await getAccountsForUser(impersonateUserId));
        setQuickNotesState(await getQuickNotesForUser(impersonateUserId));
        setHabitDefs(await getHabitDefinitionsForUser(impersonateUserId));
        setNamazTimes(await getNamazTimesForUser(impersonateUserId));
        setExtraSettings(await getExtraSettingsForUser(impersonateUserId));
        setMonthlyExpense(await getMonthlyExpensesForUser(impersonateUserId));
      } else {
        const p = await getProfile();
        setProfile(p);
        setGoalsState(await getGoals());
        setPermNotesState(await getPermNotes());
        setAccountsState(await getAccounts());
        setQuickNotesState(await getQuickNotes());
        setHabitDefs(await getHabitDefinitions());
        setNamazTimes(await getNamazTimes());
        setExtraSettings(await getExtraSettings());
        setMonthlyExpense(await getMonthlyExpenses());
      }
      setLoading(false);
    };
    load();
  }, [isImpersonating, impersonateUserId]);

  // Refresh monthly expense when date/expenses change
  useEffect(() => {
    getMonthlyExpenses().then(setMonthlyExpense);
  }, [data.expenses]);

  const updateData = useCallback((partial: Partial<DayData>) => {
    if (isImpersonating) return; // Read-only in impersonation mode
    setData(prev => {
      const next = { ...prev, ...partial };
      saveDayData(selectedDate, next);
      return next;
    });
  }, [selectedDate, isImpersonating]);

  const updateGoals = useCallback(async (newGoals: Goal[]) => {
    if (isImpersonating) return;
    setGoalsState(newGoals);
    await saveGoals(newGoals);
  }, [isImpersonating]);

  const updatePermNotes = useCallback(async (notes: PermNote[]) => {
    if (isImpersonating) return;
    setPermNotesState(notes);
    await savePermNotes(notes);
  }, [isImpersonating]);

  const updateAccounts = useCallback(async (accs: Record<string, { trans: Transaction[] }>) => {
    if (isImpersonating) return;
    setAccountsState(accs);
    await saveAccounts(accs);
  }, [isImpersonating]);

  const updateQuickNotes = useCallback(async (notes: string[]) => {
    if (isImpersonating) return;
    setQuickNotesState(notes);
    await saveQuickNotes(notes);
  }, [isImpersonating]);

  const handleHabitDefChange = useCallback(async (habits: Habit[]) => {
    if (isImpersonating) return;
    setHabitDefs(habits);
    await saveHabitDefinitions(habits);
    const currentCheckedMap = new Map(data.habits.map(h => [h.id, h.checked]));
    const merged = habits.map(h => ({ ...h, checked: currentCheckedMap.get(h.id) || false }));
    updateData({ habits: merged });
  }, [data.habits, updateData, isImpersonating]);

  const exitImpersonation = () => {
    localStorage.removeItem("impersonate_user_id");
    localStorage.removeItem("impersonate_user_name");
    navigate("/admin");
  };

  const handleLogout = async () => {
    if (isImpersonating) {
      exitImpersonation();
      return;
    }
    await signOut();
    navigate("/login");
  };

  const progress = (() => {
    const namazP = Object.values(data.namaz).filter(Boolean).length * 5;
    const waterP = Math.min(data.water * 2, 16);
    const total = data.tasks.length + data.habits.length;
    const done = data.tasks.filter(t => t.done).length + data.habits.filter(h => h.checked).length;
    const workP = total > 0 ? (done / total) * 59 : 0;
    return Math.min(100, Math.round(namazP + waterP + workP));
  })();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-primary text-xl font-bold animate-pulse">ড্যাশবোর্ড লোড হচ্ছে...</div></div>;

  return (
    <div className="bg-background min-h-screen pb-10">
      <NavBar userName={profile?.name || 'User'} selectedDate={selectedDate} onDateChange={setSelectedDate} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onProfile={() => setShowProfile(true)} notificationSlot={<NotificationBell data={data} namazTimes={namazTimes} extraSettings={extraSettings} />} />
      <main className="max-w-6xl mx-auto p-3 md:p-8 space-y-4 md:space-y-6">
        <Suspense fallback={null}>
          <AdminNotifBanner />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <AIAssistant data={data} goals={goals} />
        </Suspense>
        <SummaryCards data={data} accounts={accounts} monthlyExpense={monthlyExpense} extraSettings={extraSettings} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <MoodTracker mood={data.mood} onMoodChange={m => updateData({ mood: m })} />
          <WaterTracker water={data.water} onWaterChange={w => updateData({ water: w })} />
          <ProgressCard progress={progress} />
        </div>
        <Suspense fallback={<div className="space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
            <div className="md:col-span-8 space-y-4 md:space-y-6">
              <TaskCard tasks={data.tasks} onTasksChange={tasks => updateData({ tasks })} />
              <GoalCard goals={goals} onGoalsChange={updateGoals} />
              <AccountCard accounts={accounts} onAccountsChange={updateAccounts} />
              <PermNoteCard notes={permNotes} onNotesChange={updatePermNotes} />
              <DiaryCard notebooks={data.notebooks} activeNoteId={data.activeNoteId} onUpdate={(notebooks, activeNoteId) => updateData({ notebooks, activeNoteId })} />
              <DailySummary data={data} goals={goals} namazTimes={namazTimes} extraSettings={extraSettings} />
              <WeeklyAnalytics />
            </div>
            <div className="md:col-span-4 space-y-4 md:space-y-6">
              <NamazTracker namaz={data.namaz} onNamazChange={namaz => updateData({ namaz })} />
              <MedicineCard
                medicines={extraSettings.medicines || []}
                doses={data.medicineDoses || []}
                onMedicinesChange={(medicines: Medicine[]) => {
                  const newSettings = { ...extraSettings, medicines };
                  setExtraSettings(newSettings);
                  saveExtraSettings(newSettings);
                }}
                onDosesChange={medicineDoses => updateData({ medicineDoses })}
              />
              <ExpenseCard expenses={data.expenses} onExpensesChange={expenses => updateData({ expenses })} />
              <HabitCard habits={data.habits} onHabitsChange={habits => updateData({ habits })} />
              <QuickNoteCard notes={quickNotes} onNotesChange={updateQuickNotes} />
              <SleepTracker sleepStart={data.sleepStart} sleepEnd={data.sleepEnd} sleepHours={data.sleepHours} onUpdate={(sleepStart, sleepEnd, sleepHours) => updateData({ sleepStart, sleepEnd, sleepHours })} />
            </div>
          </div>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        {showSettings && <SettingsModal habitDefs={habitDefs} onHabitDefsChange={handleHabitDefChange} onClose={() => setShowSettings(false)} />}
        {showProfile && profile && <ProfileModal user={profile} onClose={() => { setShowProfile(false); getProfile().then(setProfile); }} onLogout={handleLogout} />}
        <NoDataDialog open={showNoData} onOpenChange={setShowNoData} date={selectedDate} />
        <SoundAlertManager data={data} namazTimes={namazTimes} extraSettings={extraSettings} />
      </Suspense>
      <NewDayDialog open={showNewDay} onClose={() => setShowNewDay(false)} userName={profile?.name || 'User'} />
    </div>
  );
};

export default DashboardPage;
