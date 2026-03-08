import { useState, useEffect } from "react";
import { getMyAdminNotifications, markNotificationRead, type AdminNotification } from "@/lib/adminStore";
import { Bell, X } from "lucide-react";

const AdminNotifBanner = () => {
  const [notifs, setNotifs] = useState<AdminNotification[]>([]);

  useEffect(() => {
    getMyAdminNotifications().then(setNotifs);
  }, []);

  const dismiss = async (id: string) => {
    await markNotificationRead(id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  if (notifs.length === 0) return null;

  const typeColors: Record<string, string> = {
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-700",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-700",
  };

  return (
    <div className="space-y-2 mb-4">
      {notifs.map(n => (
        <div key={n.id} className={`flex items-start gap-3 p-4 rounded-2xl border ${typeColors[n.type] || typeColors.info}`}>
          <Bell size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{n.title}</p>
            <p className="text-xs mt-0.5 opacity-80">{n.message}</p>
          </div>
          <button onClick={() => dismiss(n.id)} className="shrink-0 p-1 rounded-lg hover:bg-foreground/10 transition">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AdminNotifBanner;
