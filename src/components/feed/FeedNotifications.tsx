import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, UserCheck, Heart, MessageCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";

interface Profile {
  name: string;
  avatar_url?: string | null;
}

interface FeedNotification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  post_id?: string | null;
  comment_id?: string | null;
  friendship_id?: string | null;
  is_read: boolean;
  created_at: string;
  actor_profile?: Profile;
}

interface Props {
  currentUserId: string;
  profiles: Record<string, Profile>;
}

const FeedNotifications = ({ currentUserId, profiles }: Props) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    if (!currentUserId) return;
    setLoading(true);
    const { data } = await supabase
      .from("feed_notifications")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      const enriched = data.map(n => ({
        ...n,
        actor_profile: profiles[n.actor_id] || { name: "Unknown" }
      }));
      setNotifications(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, currentUserId, profiles]);

  // Realtime
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel("feed-notifs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_notifications", filter: `user_id=eq.${currentUserId}` }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from("feed_notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const acceptFriendRequest = async (notification: FeedNotification) => {
    if (!notification.friendship_id) return;
    try {
      await supabase.from("friendships").update({ status: 'accepted' }).eq("id", notification.friendship_id);
      // Notify actor
      await supabase.from("feed_notifications").insert({
        user_id: notification.actor_id,
        actor_id: currentUserId,
        type: 'friend_accepted',
        friendship_id: notification.friendship_id
      });
      await markAsRead(notification.id);
      toast.success("ফ্রেন্ড রিকোয়েস্ট গ্রহণ করা হয়েছে!");
    } catch {
      toast.error("কিছু সমস্যা হয়েছে!");
    }
  };

  const rejectFriendRequest = async (notification: FeedNotification) => {
    if (!notification.friendship_id) return;
    try {
      await supabase.from("friendships").delete().eq("id", notification.friendship_id);
      await supabase.from("feed_notifications").delete().eq("id", notification.id);
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      toast.success("রিকোয়েস্ট বাতিল করা হয়েছে");
    } catch {
      toast.error("কিছু সমস্যা হয়েছে!");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={16} className="text-rose-500" />;
      case 'comment': return <MessageCircle size={16} className="text-blue-500" />;
      case 'friend_request': return <UserPlus size={16} className="text-primary" />;
      case 'friend_accepted': return <UserCheck size={16} className="text-emerald-500" />;
      default: return <Bell size={16} />;
    }
  };

  const getMessage = (n: FeedNotification) => {
    const name = n.actor_profile?.name || "কেউ";
    switch (n.type) {
      case 'like': return `${name} আপনার পোস্টে রিয়েক্ট করেছে`;
      case 'comment': return `${name} আপনার পোস্টে কমেন্ট করেছে`;
      case 'friend_request': return `${name} আপনাকে ফ্রেন্ড রিকোয়েস্ট পাঠিয়েছে`;
      case 'friend_accepted': return `${name} আপনার ফ্রেন্ড রিকোয়েস্ট গ্রহণ করেছে`;
      default: return `${name} এর থেকে নোটিফিকেশন`;
    }
  };

  const timeAgo = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: bn });
    } catch { return ""; }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:border-primary transition shrink-0"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 left-2 sm:left-auto sm:right-0 top-14 sm:top-full sm:mt-2 w-auto sm:w-80 max-h-[70vh] sm:max-h-[400px] overflow-y-auto bg-card border border-border rounded-2xl shadow-xl z-50 animate-fade-in-up">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h4 className="font-black text-sm text-foreground">🔔 নোটিফিকেশন</h4>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin text-2xl">⏳</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              কোনো নোটিফিকেশন নেই
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition cursor-pointer ${!n.is_read ? 'bg-primary/5' : ''}`}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                    {n.actor_profile?.avatar_url ? (
                      <img src={n.actor_profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      getIcon(n.type)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {getMessage(n)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>

                    {n.type === 'friend_request' && !n.is_read && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); acceptFriendRequest(n); }} className="h-7 text-xs rounded-lg font-bold bg-primary">
                          গ্রহণ
                        </Button>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); rejectFriendRequest(n); }} className="h-7 text-xs rounded-lg font-bold">
                          বাতিল
                        </Button>
                      </div>
                    )}
                  </div>
                  {!n.is_read && (
                    <span className="w-2.5 h-2.5 bg-primary rounded-full shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedNotifications;
