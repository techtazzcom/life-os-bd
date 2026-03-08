import { useState, useRef, useEffect } from "react";
import type { DayData, NamazTimes, ExtraSettings } from "@/lib/types";

interface Notification {
  id: string;
  icon: string;
  message: string;
  type: 'warning' | 'info';
}

interface Props {
  data: DayData;
  namazTimes: NamazTimes;
  extraSettings: ExtraSettings;
}

const prayerNames: Record<string, string> = {
  fajr: 'ফজর', dhuhr: 'যোহর', asr: 'আসর', maghrib: 'মাগরিব', isha: 'এশা'
};

function generateNotifications(data: DayData, namazTimes: NamazTimes, extraSettings: ExtraSettings): Notification[] {
  const notifs: Notification[] = [];
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Missed namaz
  const prayerOrder = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
  for (const key of prayerOrder) {
    const time = namazTimes[key];
    if (time && currentTime > time && !data.namaz[key]) {
      notifs.push({ id: `namaz-${key}`, icon: '🕌', message: `${prayerNames[key]} নামাজ এখনো পড়া হয়নি`, type: 'warning' });
    }
  }

  // No mood set
  if (!data.mood) {
    notifs.push({ id: 'mood', icon: '😶', message: 'আজকের অনুভূতি সেট করা হয়নি', type: 'info' });
  }

  // Low water
  if (data.water < 4) {
    notifs.push({ id: 'water', icon: '💧', message: `পানি পান মাত্র ${data.water}/৮ গ্লাস হয়েছে`, type: 'warning' });
  }

  // No tasks done
  if (data.tasks.length > 0) {
    const pending = data.tasks.filter(t => !t.done).length;
    if (pending > 0) {
      notifs.push({ id: 'tasks', icon: '📋', message: `${pending}টি কাজ বাকি আছে`, type: 'warning' });
    }
  }

  // Habits unchecked
  if (data.habits.length > 0) {
    const unchecked = data.habits.filter(h => !h.checked).length;
    if (unchecked > 0) {
      notifs.push({ id: 'habits', icon: '🔄', message: `${unchecked}টি রুটিন বাকি আছে`, type: 'info' });
    }
  }

  // Sleep time check
  if (extraSettings.sleepTime && currentTime > extraSettings.sleepTime && !data.sleepStart) {
    notifs.push({ id: 'sleep', icon: '🛌', message: `ঘুমের সময় পার হয়ে গেছে (${extraSettings.sleepTime})`, type: 'warning' });
  }

  // No diary written
  if (data.notebooks.every(n => !n.content.trim())) {
    notifs.push({ id: 'diary', icon: '📝', message: 'আজ ডায়েরিতে কিছু লেখা হয়নি', type: 'info' });
  }

  return notifs;
}

const NotificationBell = ({ data, namazTimes, extraSettings }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const notifications = generateNotifications(data, namazTimes, extraSettings);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:border-primary transition text-foreground"
      >
        🔔
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
            {notifications.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-2xl shadow-xl z-50 animate-fade-in-up">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="font-black text-sm text-foreground">🔔 নোটিফিকেশন</h4>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              ✅ সব কিছু ঠিক আছে!
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(n => (
                <div key={n.id} className={`px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition ${n.type === 'warning' ? 'bg-destructive/5' : ''}`}>
                  <span className="text-xl mt-0.5">{n.icon}</span>
                  <p className="text-sm font-semibold text-foreground leading-snug">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
