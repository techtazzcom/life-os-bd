import { useState, useEffect } from "react";
import type { Goal } from "@/lib/dataStore";

interface Props {
  goals: Goal[];
  onGoalsChange: (goals: Goal[]) => void;
}

const GoalCard = ({ goals, onGoalsChange }: Props) => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const addGoal = () => {
    if (!title || !date) return;
    onGoalsChange([{ id: Date.now(), title, target: date }, ...goals]);
    setTitle(""); setDate("");
  };

  const getTimeLeft = (target: string) => {
    const diff = new Date(target).getTime() - Date.now();
    if (diff < 0) return "সময় শেষ!";
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${d} দিন ${h} ঘণ্টা ${m} মি.`;
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-primary shadow-sm">
      <h3 className="font-bold text-lg text-primary mb-4">🎯 আমার লক্ষ্য</h3>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="লক্ষ্যের নাম..." className="flex-1 p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground" />
        <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-muted-foreground" />
        <button onClick={addGoal} className="bg-primary text-primary-foreground px-5 py-3 rounded-xl font-bold hover:opacity-90 transition active:scale-95">সেট</button>
      </div>
      <div className="space-y-3">
        {goals.map(g => (
          <div key={g.id} className="flex justify-between items-center p-4 bg-secondary rounded-2xl border border-border">
            <div>
              <h4 className="font-bold text-sm text-foreground">{g.title}</h4>
              <p className="text-xs font-bold text-primary mt-1">{getTimeLeft(g.target)}</p>
            </div>
            <button onClick={() => onGoalsChange(goals.filter(x => x.id !== g.id))} className="text-destructive/40 hover:text-destructive transition">🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GoalCard;
