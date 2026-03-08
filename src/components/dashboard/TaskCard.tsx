import { useState } from "react";
import type { Task } from "@/lib/dataStore";

interface Props {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

const TaskCard = ({ tasks, onTasksChange }: Props) => {
  const [text, setText] = useState("");
  const [time, setTime] = useState("");

  const addTask = () => {
    if (!text.trim()) return;
    onTasksChange([{ id: Date.now(), text, time, done: false }, ...tasks]);
    setText(""); setTime("");
  };

  const toggleTask = (id: number) => {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const deleteTask = (id: number) => {
    onTasksChange(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-green shadow-sm">
      <h3 className="font-bold text-lg text-life-green mb-4">📅 আজকের কাজ</h3>
      <div className="flex gap-2 mb-4">
        <input type="text" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="কি কি করবেন?" className="flex-1 p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground focus:border-primary transition" />
        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="p-3 w-28 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-muted-foreground" />
        <button onClick={addTask} className="bg-life-green text-primary-foreground px-4 rounded-xl font-bold hover:opacity-90 transition active:scale-95">যোগ</button>
      </div>
      <ul className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
        {tasks.map(t => (
          <li key={t.id} className="flex justify-between items-center p-3 bg-secondary rounded-xl border border-border group transition">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} className="w-5 h-5 accent-life-green rounded" />
              <span className={`text-sm font-bold text-foreground ${t.done ? 'completed' : ''}`}>{t.text}</span>
              <span className="text-[10px] text-muted-foreground font-bold bg-card px-2 py-0.5 rounded">{t.time || 'সময় নাই'}</span>
            </div>
            <button onClick={() => deleteTask(t.id)} className="text-destructive/40 hover:text-destructive transition opacity-0 group-hover:opacity-100">🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TaskCard;
