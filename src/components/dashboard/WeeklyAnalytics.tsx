import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell } from "recharts";
import type { DayData } from "@/lib/types";

const MOOD_MAP: Record<string, number> = { '😢': 1, '😟': 2, '😐': 3, '🙂': 4, '😄': 5 };
const MOOD_LABELS: Record<number, string> = { 1: '😢', 2: '😟', 3: '😐', 4: '🙂', 5: '😄' };

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(142 71% 45%)', 'hsl(38 92% 50%)', 'hsl(0 84% 60%)'];

interface WeekDay {
  date: string;
  label: string;
  mood: number;
  water: number;
  tasksDone: number;
  tasksTotal: number;
  sleep: number;
  expense: number;
  namazDone: number;
  habitsDone: number;
}

const WeeklyAnalytics = () => {
  const [weekData, setWeekData] = useState<WeekDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'mood' | 'productivity' | 'health'>('overview');

  useEffect(() => {
    loadWeekData();
  }, []);

  const loadWeekData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dates: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }

    const { data } = await supabase
      .from('user_data')
      .select('date_key, data_content')
      .eq('user_id', user.id)
      .in('date_key', dates);

    const dayMap: Record<string, DayData> = {};
    data?.forEach(r => { dayMap[r.date_key] = r.data_content as unknown as DayData; });

    const banglaDay = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

    const week = dates.map(date => {
      const d = dayMap[date];
      const dayOfWeek = new Date(date).getDay();
      return {
        date,
        label: banglaDay[dayOfWeek],
        mood: d ? (MOOD_MAP[d.mood] || 0) : 0,
        water: d?.water || 0,
        tasksDone: d?.tasks?.filter(t => t.done).length || 0,
        tasksTotal: d?.tasks?.length || 0,
        sleep: d?.sleepHours || 0,
        expense: d?.expenses?.reduce((s, e) => s + e.amt, 0) || 0,
        namazDone: d ? Object.values(d.namaz || {}).filter(Boolean).length : 0,
        habitsDone: d?.habits?.filter(h => h.checked).length || 0,
      };
    });

    setWeekData(week);
    setLoading(false);
  };

  if (loading) return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm animate-pulse">
      <div className="h-6 bg-muted rounded w-1/3 mb-4" />
      <div className="h-48 bg-muted rounded" />
    </div>
  );

  const avgMood = weekData.filter(d => d.mood > 0).reduce((s, d) => s + d.mood, 0) / Math.max(weekData.filter(d => d.mood > 0).length, 1);
  const totalWater = weekData.reduce((s, d) => s + d.water, 0);
  const totalTasksDone = weekData.reduce((s, d) => s + d.tasksDone, 0);
  const totalTasksAll = weekData.reduce((s, d) => s + d.tasksTotal, 0);
  const avgSleep = weekData.reduce((s, d) => s + d.sleep, 0) / 7;
  const totalExpense = weekData.reduce((s, d) => s + d.expense, 0);
  const totalNamaz = weekData.reduce((s, d) => s + d.namazDone, 0);
  const taskRate = totalTasksAll > 0 ? Math.round((totalTasksDone / totalTasksAll) * 100) : 0;

  const tabs = [
    { key: 'overview' as const, label: '📊 সারাংশ' },
    { key: 'mood' as const, label: '🧠 মুড' },
    { key: 'productivity' as const, label: '⚡ প্রোডাক্টিভিটি' },
    { key: 'health' as const, label: '💚 স্বাস্থ্য' },
  ];

  const pieData = [
    { name: 'নামায', value: totalNamaz, max: 35 },
    { name: 'টাস্ক', value: totalTasksDone, max: Math.max(totalTasksAll, 1) },
    { name: 'পানি', value: totalWater, max: 56 },
  ];

  return (
    <div className="bg-gradient-to-br from-card to-card/80 rounded-2xl border border-border shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            📈 সাপ্তাহিক বিশ্লেষণ
          </h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">গত ৭ দিন</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox emoji={MOOD_LABELS[Math.round(avgMood)] || '😐'} label="গড় মুড" value={MOOD_LABELS[Math.round(avgMood)] || '—'} color="from-purple-500/20 to-purple-500/5" />
              <StatBox emoji="💧" label="মোট পানি" value={`${totalWater} গ্লাস`} color="from-blue-500/20 to-blue-500/5" />
              <StatBox emoji="✅" label="টাস্ক সম্পন্ন" value={`${taskRate}%`} color="from-green-500/20 to-green-500/5" />
              <StatBox emoji="💰" label="মোট খরচ" value={`৳${totalExpense}`} color="from-amber-500/20 to-amber-500/5" />
            </div>

            {/* Mini Chart */}
            <div className="bg-secondary/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">দৈনিক কার্যকলাপ</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weekData} barGap={2}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="tasksDone" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="টাস্ক" />
                  <Bar dataKey="namazDone" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} name="নামায" />
                  <Bar dataKey="water" fill="hsl(210 100% 56%)" radius={[4, 4, 0, 0]} name="পানি" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'mood' && (
          <div className="space-y-4">
            <div className="bg-secondary/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">মুড ট্রেন্ড</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={weekData}>
                  <defs>
                    <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => MOOD_LABELS[v] || ''} />
                  <Tooltip content={<MoodTooltip />} />
                  <Area type="monotone" dataKey="mood" stroke="hsl(var(--primary))" fill="url(#moodGrad)" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm">
              <span className="text-muted-foreground">সবচেয়ে ভালো দিন: <strong>{getBestMoodDay(weekData)}</strong></span>
            </div>
          </div>
        )}

        {activeTab === 'productivity' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="মোট টাস্ক" value={totalTasksAll} icon="📋" />
              <MiniStat label="সম্পন্ন" value={totalTasksDone} icon="✅" />
              <MiniStat label="নামায" value={`${totalNamaz}/35`} icon="🕌" />
            </div>
            <div className="bg-secondary/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">টাস্ক সম্পন্নের হার</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={weekData}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<TaskTooltip />} />
                  <Line type="monotone" dataKey="tasksDone" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4 }} name="সম্পন্ন" />
                  <Line type="monotone" dataKey="tasksTotal" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="মোট" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatBox emoji="😴" label="গড় ঘুম" value={`${avgSleep.toFixed(1)} ঘণ্টা`} color="from-indigo-500/20 to-indigo-500/5" />
              <StatBox emoji="💧" label="দৈনিক গড় পানি" value={`${(totalWater / 7).toFixed(1)} গ্লাস`} color="from-blue-500/20 to-blue-500/5" />
            </div>
            <div className="bg-secondary/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">ঘুম ও পানি</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weekData}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<HealthTooltip />} />
                  <Bar dataKey="sleep" fill="hsl(245 58% 51%)" radius={[4, 4, 0, 0]} name="ঘুম" />
                  <Bar dataKey="water" fill="hsl(210 100% 56%)" radius={[4, 4, 0, 0]} name="পানি" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatBox = ({ emoji, label, value, color }: { emoji: string; label: string; value: string; color: string }) => (
  <div className={`bg-gradient-to-br ${color} rounded-xl p-3 text-center border border-border/30`}>
    <div className="text-2xl mb-1">{emoji}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-sm font-bold text-foreground mt-0.5">{value}</div>
  </div>
);

const MiniStat = ({ label, value, icon }: { label: string; value: string | number; icon: string }) => (
  <div className="bg-secondary/50 rounded-xl p-3 text-center">
    <div className="text-xl">{icon}</div>
    <div className="text-lg font-bold text-foreground">{value}</div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">{p.name}: <strong className="text-foreground">{p.value}</strong></p>
      ))}
    </div>
  );
};

const MoodTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-semibold">{label}: {MOOD_LABELS[payload[0].value] || '—'}</p>
    </div>
  );
};

const TaskTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

const HealthTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

const getBestMoodDay = (data: WeekDay[]) => {
  const best = data.reduce((a, b) => a.mood > b.mood ? a : b, data[0]);
  return best?.mood > 0 ? `${best.label} ${MOOD_LABELS[best.mood]}` : '—';
};

const MOOD_LABELS_EXPORT = MOOD_LABELS;

export default WeeklyAnalytics;
