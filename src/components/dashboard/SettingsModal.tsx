import { useState, useEffect } from "react";
import { getNamazTimes, saveNamazTimes, getExtraSettings, saveExtraSettings, type Habit, type NamazTimes, type ExtraSettings } from "@/lib/dataStore";

interface Props {
  habits: Habit[];
  onHabitsChange: (habits: Habit[]) => void;
  onClose: () => void;
}

const SettingsModal = ({ habits, onHabitsChange, onClose }: Props) => {
  const [namazTimes, setNamazTimes] = useState<NamazTimes>({ fajr: "05:30", dhuhr: "13:30", asr: "16:45", maghrib: "18:20", isha: "20:00" });
  const [settings, setSettings] = useState<ExtraSettings>({ dailyLimit: 500, monthlyLimit: 15000, sleepTime: "22:00" });
  const [newHabit, setNewHabit] = useState("");

  useEffect(() => {
    getNamazTimes().then(setNamazTimes);
    getExtraSettings().then(setSettings);
  }, []);

  const addHabit = () => {
    if (!newHabit.trim()) return;
    onHabitsChange([...habits, { id: Date.now(), title: newHabit, checked: false }]);
    setNewHabit("");
  };

  const saveAll = async () => {
    await saveNamazTimes(namazTimes);
    await saveExtraSettings(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-foreground/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-3xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-foreground">⚙️ সেটিংস</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-destructive text-2xl">✕</button>
        </div>
        <div className="space-y-6">
          <section>
            <h4 className="font-bold text-life-emerald border-b border-border pb-2 mb-4 text-xs uppercase tracking-widest">নামাজের সময়</h4>
            <div className="grid grid-cols-2 gap-3">
              {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map(k => (
                <div key={k}>
                  <label className="text-xs font-bold text-muted-foreground">{k === 'fajr' ? 'ফজর' : k === 'dhuhr' ? 'যোহর' : k === 'asr' ? 'আসর' : k === 'maghrib' ? 'মাগরিব' : 'এশা'}</label>
                  <input type="time" value={namazTimes[k]} onChange={e => setNamazTimes({ ...namazTimes, [k]: e.target.value })} className="w-full p-2 border border-border rounded-xl font-bold bg-secondary text-foreground outline-none" />
                </div>
              ))}
            </div>
          </section>
          <section>
            <h4 className="font-bold text-primary border-b border-border pb-2 mb-4 text-xs uppercase tracking-widest">বাজেট ও ঘুম</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-bold text-muted-foreground">ডেইলি বাজেট</label><input type="number" value={settings.dailyLimit} onChange={e => setSettings({ ...settings, dailyLimit: parseInt(e.target.value) || 0 })} className="w-full p-2 border border-border rounded-xl font-bold bg-secondary text-foreground outline-none" /></div>
              <div><label className="text-xs font-bold text-muted-foreground">মাসিক বাজেট</label><input type="number" value={settings.monthlyLimit} onChange={e => setSettings({ ...settings, monthlyLimit: parseInt(e.target.value) || 0 })} className="w-full p-2 border border-border rounded-xl font-bold bg-secondary text-foreground outline-none" /></div>
              <div className="col-span-2"><label className="text-xs font-bold text-muted-foreground">ঘুমানোর সময়</label><input type="time" value={settings.sleepTime} onChange={e => setSettings({ ...settings, sleepTime: e.target.value })} className="w-full p-2 border border-border rounded-xl font-bold bg-secondary text-foreground outline-none" /></div>
            </div>
          </section>
          <section>
            <h4 className="font-bold text-life-orange border-b border-border pb-2 mb-4 text-xs uppercase tracking-widest">রুটিন ম্যানেজমেন্ট</h4>
            <div className="flex gap-2 mb-4">
              <input type="text" value={newHabit} onChange={e => setNewHabit(e.target.value)} onKeyDown={e => e.key === 'Enter' && addHabit()} placeholder="নতুন রুটিন..." className="flex-1 p-3 rounded-xl bg-secondary border border-border outline-none font-bold text-sm text-foreground" />
              <button onClick={addHabit} className="bg-life-orange text-primary-foreground px-6 rounded-xl font-bold hover:opacity-90 transition">যোগ</button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
              {habits.map((h, i) => (
                <div key={h.id} className="flex items-center justify-between bg-secondary p-2 rounded-lg">
                  <span className="text-sm font-bold text-foreground">{h.title}</span>
                  <button onClick={() => onHabitsChange(habits.filter((_, idx) => idx !== i))} className="text-destructive/40 hover:text-destructive transition">🗑️</button>
                </div>
              ))}
            </div>
          </section>
          <button onClick={saveAll} className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black shadow-lg hover:opacity-90 transition active:scale-95">সংরক্ষণ করুন</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
