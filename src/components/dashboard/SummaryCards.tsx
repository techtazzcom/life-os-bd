import type { DayData } from "@/lib/dataStore";

interface Props {
  data: DayData;
  accounts: Record<string, { trans: { type: 'pawa' | 'dena'; amount: number; note: string }[] }>;
}

const SummaryCards = ({ data, accounts }: Props) => {
  const tasksDone = data.tasks.filter(t => t.done).length;
  const todayExp = data.expenses.reduce((s, e) => s + e.amt, 0);
  const routinePerc = data.habits.length > 0 ? Math.round((data.habits.filter(h => h.checked).length / data.habits.length) * 100) : 0;

  const totalPawa = Object.values(accounts).reduce((sum, person) =>
    sum + person.trans.filter(t => t.type === 'pawa').reduce((s, t) => s + t.amount, 0), 0);
  const totalDena = Object.values(accounts).reduce((sum, person) =>
    sum + person.trans.filter(t => t.type === 'dena').reduce((s, t) => s + t.amount, 0), 0);

  const cards = [
    { icon: "✅", label: "কাজ সম্পন্ন", value: `${tasksDone} টি`, color: "border-b-life-emerald bg-life-emerald-light" },
    { icon: "💰", label: "আজকের খরচ", value: `৳${todayExp}`, color: "border-b-primary bg-life-blue-light" },
    { icon: "📊", label: "রুটিন পালন", value: `${routinePerc}%`, color: "border-b-life-orange bg-life-orange-light" },
    { icon: "🛌", label: "মোট ঘুম", value: `${data.sleepHours || 0} ঘণ্টা`, color: "border-b-life-indigo bg-life-indigo-light" },
    { icon: "📗", label: "মোট পাওনা", value: `৳${totalPawa}`, color: "border-b-life-emerald bg-life-emerald-light" },
    { icon: "📕", label: "মোট দেনা", value: `৳${totalDena}`, color: "border-b-destructive bg-life-red-light" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
      {cards.map((c, i) => (
        <div key={i} className={`bg-card rounded-2xl p-4 text-center border border-border border-b-4 ${c.color} shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>
          <div className="text-2xl mb-2">{c.icon}</div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
          <p className="text-xl font-black text-foreground">{c.value}</p>
        </div>
      ))}
    </div>
  );
};

export default SummaryCards;
