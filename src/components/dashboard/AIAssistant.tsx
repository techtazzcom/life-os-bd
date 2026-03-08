import { useState, useEffect } from "react";
import type { DayData, Goal } from "@/lib/dataStore";
import { getNamazTimes, getExtraSettings } from "@/lib/dataStore";

interface Props {
  data: DayData;
  goals: Goal[];
  accounts: Record<string, { trans: { type: 'pawa' | 'dena'; amount: number; note: string }[] }>;
}

const AIAssistant = ({ data, goals, accounts }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [insights, setInsights] = useState<string[]>([]);

  // Calculate পাওনা ও দেনা totals
  const totalPawa = Object.values(accounts).reduce((sum, person) =>
    sum + person.trans.filter(t => t.type === 'pawa').reduce((s, t) => s + t.amount, 0), 0);
  const totalDena = Object.values(accounts).reduce((sum, person) =>
    sum + person.trans.filter(t => t.type === 'dena').reduce((s, t) => s + t.amount, 0), 0);

  useEffect(() => {
    const buildInsights = async () => {
      const msgs: string[] = [];
      const now = new Date();
      const namazTimes = await getNamazTimes();
      const settings = await getExtraSettings();

      const prayerNames: Record<string, string> = { fajr: "ফজর", dhuhr: "যোহর", asr: "আসর", maghrib: "মাগরিব", isha: "এশা" };
      const missed: string[] = [];
      for (const k in namazTimes) {
        const [h, m] = (namazTimes as unknown as Record<string, string>)[k].split(':').map(Number);
        if ((now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m)) && !data.namaz[k]) {
          missed.push(prayerNames[k]);
        }
      }
      if (missed.length > 0) msgs.push(`🕌 আজকে ${missed.join(", ")} নামাজ এখনো আদায় হয়নি।`);
      if (data.water < 8) msgs.push(`💧 পানি কম পান হচ্ছে। এখন পর্যন্ত ${data.water} গ্লাস।`);

      const overdue = data.tasks.filter(t => !t.done && t.time).filter(t => {
        const [h, m] = t.time.split(':').map(Number);
        return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
      });
      if (overdue.length > 0) msgs.push(`⚠️ "${overdue[0].text}" কাজটি সময়সীমা পেরিয়ে গেছে!`);

      const todayExp = data.expenses.reduce((s, e) => s + e.amt, 0);
      if (todayExp > settings.dailyLimit) msgs.push(`💸 আজকের খরচ বাজেট (৳${settings.dailyLimit}) ছাড়িয়ে গেছে!`);

      const habitsDone = data.habits.filter(h => h.checked).length;
      if (data.habits.length > 0 && habitsDone < data.habits.length) msgs.push(`📋 রুটিনের ${data.habits.length - habitsDone}টি কাজ বাকি আছে।`);
      if (goals.length > 0) msgs.push(`🎯 "${goals[0].title}" লক্ষ্যে আজ কোন পদক্ষেপ নিয়েছেন?`);
      if (data.mood === 'sad') msgs.push(`💛 মন খারাপ? একটু বাইরে ঘুরে আসুন বা পছন্দের কিছু করুন।`);
      if (data.mood === 'amazing') msgs.push(`🔥 মাশাআল্লাহ! আপনি দারুণ করছেন, এভাবে চালিয়ে যান!`);
      if (now.getHours() >= 22) msgs.push(`🌙 ঘুমানোর সময় হয়ে গেছে! মোবাইল রেখে ঘুমিয়ে পড়ুন।`);
      if (msgs.length === 0) msgs.push(`👍 আপনি দারুণভাবে সবকিছু ম্যানেজ করছেন! এভাবে চালিয়ে যান।`);
      setInsights(msgs);
    };

    buildInsights();
    const interval = setInterval(buildInsights, 60000);
    return () => clearInterval(interval);
  }, [data, goals]);

  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => setCurrentIndex(i => (i + 1) % insights.length), 5000);
    return () => clearInterval(interval);
  }, [insights.length]);

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-2xl md:rounded-3xl p-4 md:p-5 shadow-sm border border-border flex items-center gap-3 md:gap-4 relative overflow-hidden min-h-[80px] md:min-h-[100px]">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl md:text-2xl shadow-lg shrink-0 animate-bounce">🤖</div>
        <div className="z-10 w-full min-w-0">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">AI Assistant</p>
          <div className="text-sm md:text-base font-bold text-foreground transition-all duration-500 truncate">{insights[currentIndex] || "আপনার ডেটা বিশ্লেষণ করা হচ্ছে..."}</div>
        </div>
      </div>

      {/* পাওনা ও দেনা রিপোর্ট */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-life-emerald-light rounded-xl p-3 md:p-4 border border-life-emerald/20 text-center">
          <p className="text-[10px] font-bold text-life-emerald uppercase tracking-wider mb-1">মোট পাওনা</p>
          <p className="text-lg md:text-xl font-black text-life-emerald">৳{totalPawa}</p>
        </div>
        <div className="bg-life-red-light rounded-xl p-3 md:p-4 border border-destructive/20 text-center">
          <p className="text-[10px] font-bold text-destructive uppercase tracking-wider mb-1">মোট দেনা</p>
          <p className="text-lg md:text-xl font-black text-destructive">৳{totalDena}</p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
