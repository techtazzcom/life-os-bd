import type { Habit } from "@/lib/dataStore";

interface Props {
  habits: Habit[];
  onHabitsChange: (habits: Habit[]) => void;
}

const HabitCard = ({ habits, onHabitsChange }: Props) => {
  const toggle = (id: number) => {
    onHabitsChange(habits.map(h => h.id === id ? { ...h, checked: !h.checked } : h));
  };

  return (
    <div className="bg-card rounded-2xl p-5 border border-border border-t-4 border-t-life-orange shadow-sm">
      <h3 className="font-bold text-life-orange text-sm uppercase mb-4">📋 রুটিন</h3>
      <div className="space-y-2">
        {habits.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">সেটিংস থেকে রুটিন যোগ করুন</p>}
        {habits.map(h => (
          <div key={h.id} className="flex items-center gap-3 bg-secondary p-3 rounded-xl border border-border">
            <input type="checkbox" checked={h.checked} onChange={() => toggle(h.id)} className="w-4 h-4 accent-life-orange rounded" />
            <span className={`text-sm font-bold text-foreground ${h.checked ? 'completed' : ''}`}>{h.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HabitCard;
