import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getProfile, loadDayData, saveDayData, getGoals, saveGoals, getPermNotes, savePermNotes, getNamazTimes, getExtraSettings, saveExtraSettings, getTodayStr, type DayData, type Goal, type PermNote, type UserProfile, type NamazTimes, type ExtraSettings } from "@/lib/dataStore";
import type { Medicine } from "@/lib/types";
import NavBar from "@/components/dashboard/NavBar";
import NotificationBell from "@/components/dashboard/NotificationBell";
import SummaryCards from "@/components/dashboard/SummaryCards";
import MoodTracker from "@/components/dashboard/MoodTracker";
import WaterTracker from "@/components/dashboard/WaterTracker";
import ProgressCard from "@/components/dashboard/ProgressCard";
import TaskCard from "@/components/dashboard/TaskCard";
import GoalCard from "@/components/dashboard/GoalCard";
import ExpenseCard from "@/components/dashboard/ExpenseCard";
import NamazTracker from "@/components/dashboard/NamazTracker";
import HabitCard from "@/components/dashboard/HabitCard";
import DiaryCard from "@/components/dashboard/DiaryCard";
import QuickNoteCard from "@/components/dashboard/QuickNoteCard";
import SleepTracker from "@/components/dashboard/SleepTracker";
import PermNoteCard from "@/components/dashboard/PermNoteCard";
import AccountCard from "@/components/dashboard/AccountCard";
import AIAssistant from "@/components/dashboard/AIAssistant";
import MedicineCard from "@/components/dashboard/MedicineCard";
import WeeklyAnalytics from "@/components/dashboard/WeeklyAnalytics";
import SettingsModal from "@/components/dashboard/SettingsModal";
import DailySummary from "@/components/dashboard/DailySummary";
import ProfileModal from "@/components/dashboard/ProfileModal";
import NoDataDialog from "@/components/dashboard/NoDataDialog";
import SoundAlertManager from "@/components/dashboard/SoundAlertManager";
import NewDayDialog from "@/components/dashboard/NewDayDialog";

const defaultDayData: DayData = {
  mood: '', water: 0, tasks: [], expenses: [],
  accounts: {}, habits: [], notebooks: [{ id: 1, title: 'নোট ১', content: '' }],
  activeNoteId: 1, namaz: {}, quickNotesArray: [''],
  sleepStart: '', sleepEnd: '', sleepHours: 0,
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<DayData>(defaultDayData);
  const [goals, setGoalsState] = useState<Goal[]>([]);
  const [permNotes, setPermNotesState] = useState<PermNote[]>([]);
  const [namazTimes, setNamazTimes] = useState<NamazTimes>({ fajr: "05:30", dhuhr: "13:30", asr: "16:45", maghrib: "18:20", isha: "20:00" });
  const [extraSettings, setExtraSettings] = useState<ExtraSettings>({ dailyLimit: 500, monthlyLimit: 15000, sleepTime: "22:00" });
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNoData, setShowNoData] = useState(false);
  const [showNewDay, setShowNewDay] = useState(false);
  const [loading, setLoading] = useState(true);

  const isToday = selectedDate === getTodayStr();

  // Auto-switch to new day at midnight with greeting
  useEffect(() => {
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
  }, []);

  const prevDateRef = useRef(getTodayStr());

  useEffect(() => {
    const load = async () => {
      const p = await getProfile();
      setProfile(p);
      const saved = await loadDayData(selectedDate);
      if (!saved && selectedDate !== getTodayStr()) {
        setShowNoData(true);
      }
      setData(saved || defaultDayData);
      setGoalsState(await getGoals());
      setPermNotesState(await getPermNotes());
      setNamazTimes(await getNamazTimes());
      setExtraSettings(await getExtraSettings());
      setLoading(false);
    };
    load();
  }, [selectedDate]);

  const updateData = useCallback((partial: Partial<DayData>) => {
    setData(prev => {
      const next = { ...prev, ...partial };
      saveDayData(selectedDate, next);
      return next;
    });
  }, [selectedDate]);

  const updateGoals = useCallback(async (newGoals: Goal[]) => {
    setGoalsState(newGoals);
    await saveGoals(newGoals);
  }, []);

  const updatePermNotes = useCallback(async (notes: PermNote[]) => {
    setPermNotesState(notes);
    await savePermNotes(notes);
  }, []);

  const handleLogout = async () => {
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
        <AIAssistant data={data} goals={goals} />
        <SummaryCards data={data} accounts={data.accounts} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <MoodTracker mood={data.mood} onMoodChange={m => updateData({ mood: m })} />
          <WaterTracker water={data.water} onWaterChange={w => updateData({ water: w })} />
          <ProgressCard progress={progress} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          <div className="md:col-span-8 space-y-4 md:space-y-6">
            <TaskCard tasks={data.tasks} onTasksChange={tasks => updateData({ tasks })} />
            <GoalCard goals={goals} onGoalsChange={updateGoals} />
            <AccountCard accounts={data.accounts} onAccountsChange={accounts => updateData({ accounts })} />
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
            <QuickNoteCard notes={data.quickNotesArray} onNotesChange={quickNotesArray => updateData({ quickNotesArray })} />
            <SleepTracker sleepStart={data.sleepStart} sleepEnd={data.sleepEnd} sleepHours={data.sleepHours} onUpdate={(sleepStart, sleepEnd, sleepHours) => updateData({ sleepStart, sleepEnd, sleepHours })} />
          </div>
        </div>
      </main>
      {showSettings && <SettingsModal habits={data.habits} onHabitsChange={habits => updateData({ habits })} onClose={() => setShowSettings(false)} />}
      {showProfile && profile && <ProfileModal user={profile} onClose={() => { setShowProfile(false); getProfile().then(setProfile); }} onLogout={handleLogout} />}
      <NoDataDialog open={showNoData} onOpenChange={setShowNoData} date={selectedDate} />
      <NewDayDialog open={showNewDay} onClose={() => setShowNewDay(false)} userName={profile?.name || 'User'} />
      <SoundAlertManager data={data} namazTimes={namazTimes} extraSettings={extraSettings} />
    </div>
  );
};

export default DashboardPage;
