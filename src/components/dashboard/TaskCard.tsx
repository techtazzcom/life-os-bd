import { useState, useEffect } from "react";
import type { Task } from "@/lib/dataStore";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import TimeInput from "@/components/ui/time-input";

interface Props {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

const TaskCard = ({ tasks, onTasksChange }: Props) => {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const addTask = () => {
    if (!text.trim()) return;
    onTasksChange([{ id: Date.now(), text, time, done: false }, ...tasks]);
    setText(""); setTime("");
  };

  const toggleTask = (id: number) => {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const getTimeLeft = (taskTime: string) => {
    if (!taskTime) return null;
    const now = new Date();
    const [h, m] = taskTime.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const diff = target.getTime() - now.getTime();
    if (diff < 0) return "সময় শেষ!";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}ঘ ${mins}মি বাকি`;
    return `${mins}মি বাকি`;
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-green shadow-sm">
      <h3 className="font-bold text-lg text-life-green mb-4">📅 আজকের কাজ</h3>
      <div className="flex flex-wrap gap-2 mb-4">
        <input type="text" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="কি কি করবেন?" className="flex-1 min-w-0 p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground focus:border-primary transition" />
        <div className="flex gap-2 shrink-0">
          <input type="time" value={time} onChange={e => setTime(e.target.value)} placeholder="সময়" className="p-3 w-28 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground" />
          <button onClick={addTask} className="bg-life-green text-primary-foreground px-4 rounded-xl font-bold hover:opacity-90 transition active:scale-95 whitespace-nowrap">যোগ</button>
        </div>
      </div>
      <ul className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
        {tasks.map(t => {
          const timeLeft = !t.done ? getTimeLeft(t.time) : null;
          return (
            <li key={t.id} className="flex justify-between items-center p-3 bg-secondary rounded-xl border border-border group transition">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="w-5 h-5 accent-life-green rounded shrink-0" />
                <span className={`text-sm font-bold text-foreground truncate ${t.done ? 'completed' : ''}`}>{t.text}</span>
                {t.time && (
                  <span className="text-[10px] text-muted-foreground font-bold bg-card px-2 py-0.5 rounded shrink-0">{t.time}</span>
                )}
                {timeLeft && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${timeLeft === 'সময় শেষ!' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                    ⏳ {timeLeft}
                  </span>
                )}
              </div>
              <button onClick={() => setDeleteId(t.id)} className="text-destructive/40 hover:text-destructive transition opacity-0 group-hover:opacity-100 sm:opacity-0 max-sm:opacity-100 ml-2">🗑️</button>
            </li>
          );
        })}
      </ul>
      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId !== null) { onTasksChange(tasks.filter(t => t.id !== deleteId)); setDeleteId(null); } }}
        title="কাজটি ডিলেট করবেন?"
        description="এই কাজটি স্থায়ীভাবে মুছে ফেলা হবে।"
      />
    </div>
  );
};

export default TaskCard;
