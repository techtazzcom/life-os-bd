import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Settings, ShieldBan, Trash2, Bell, BellOff, Eye, EyeOff, Sparkles, Lock, Globe, UserX } from "lucide-react";
import { toast } from "sonner";

interface BlockedUser {
  id: string;
  blocked_id: string;
  name: string;
  avatar_url?: string | null;
}

interface FeedSettings {
  notif_likes: boolean;
  notif_comments: boolean;
  notif_friends: boolean;
  feed_algorithm: boolean;
  privacy_hide_online: boolean;
  privacy_hide_last_seen: boolean;
  privacy_profile_public: boolean;
  privacy_allow_friend_requests: boolean;
}

const DEFAULT_SETTINGS: FeedSettings = {
  notif_likes: true,
  notif_comments: true,
  notif_friends: true,
  feed_algorithm: true,
  privacy_hide_online: false,
  privacy_hide_last_seen: false,
  privacy_profile_public: true,
  privacy_allow_friend_requests: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  profiles: Record<string, { name: string; avatar_url?: string | null }>;
}

const FeedSettingsModal = ({ open, onOpenChange, currentUserId, profiles }: Props) => {
  const [tab, setTab] = useState<"general" | "blocked">("general");
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<FeedSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("user_settings")
      .select("extra_settings")
      .eq("user_id", currentUserId)
      .single();
    if (data?.extra_settings) {
      const es = data.extra_settings as any;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(es.feed_settings || {}),
      });
    }
  };

  const saveSettings = async (newSettings: FeedSettings) => {
    setSaving(true);
    // Get current extra_settings first
    const { data: current } = await supabase
      .from("user_settings")
      .select("extra_settings")
      .eq("user_id", currentUserId)
      .single();

    const existingExtra = (current?.extra_settings as any) || {};
    const updated = { ...existingExtra, feed_settings: newSettings };

    await supabase
      .from("user_settings")
      .update({ extra_settings: updated })
      .eq("user_id", currentUserId);

    // Apply privacy changes to profile
    await supabase
      .from("profiles")
      .update({
        hide_email: !newSettings.privacy_profile_public,
      } as any)
      .eq("user_id", currentUserId);

    setSaving(false);
    toast.success("সেটিংস সেভ হয়েছে");
  };

  const toggle = (key: keyof FeedSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const loadBlocked = async () => {
    if (!currentUserId) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_blocks")
      .select("id, blocked_id")
      .eq("blocker_id", currentUserId);

    if (data) {
      const enriched: BlockedUser[] = data.map((b: any) => ({
        id: b.id,
        blocked_id: b.blocked_id,
        name: profiles[b.blocked_id]?.name || "অজানা",
        avatar_url: profiles[b.blocked_id]?.avatar_url,
      }));
      setBlockedUsers(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      loadSettings();
      if (tab === "blocked") loadBlocked();
    }
  }, [open, tab, currentUserId]);

  const unblock = async (blockId: string) => {
    await supabase.from("user_blocks").delete().eq("id", blockId);
    setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
    toast.success("আনব্লক করা হয়েছে");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Settings size={20} /> নিউজফিড সেটিংস
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => setTab("general")}
            className={`flex-1 py-2.5 text-sm font-bold transition ${tab === "general" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            সাধারণ
          </button>
          <button
            onClick={() => setTab("blocked")}
            className={`flex-1 py-2.5 text-sm font-bold transition ${tab === "blocked" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            <ShieldBan size={14} className="inline mr-1" />
            ব্লক লিস্ট
          </button>
        </div>

        <div className="px-5 pb-5 min-h-[200px] overflow-y-auto">
          {tab === "general" && (
            <div className="space-y-5 pt-3">
              {/* Notification Section */}
              <div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-2 mb-3">
                  <Bell size={16} className="text-amber-500" /> নোটিফিকেশন
                </h3>
                <div className="space-y-2.5">
                  <SettingRow
                    icon={<span className="text-base">👍</span>}
                    label="লাইক নোটিফিকেশন"
                    desc="কেউ আপনার পোস্টে লাইক দিলে জানাবে"
                    checked={settings.notif_likes}
                    onChange={() => toggle("notif_likes")}
                  />
                  <SettingRow
                    icon={<span className="text-base">💬</span>}
                    label="কমেন্ট নোটিফিকেশন"
                    desc="কেউ আপনার পোস্টে কমেন্ট করলে জানাবে"
                    checked={settings.notif_comments}
                    onChange={() => toggle("notif_comments")}
                  />
                  <SettingRow
                    icon={<span className="text-base">🤝</span>}
                    label="ফ্রেন্ড রিকোয়েস্ট"
                    desc="ফ্রেন্ড রিকোয়েস্ট পেলে জানাবে"
                    checked={settings.notif_friends}
                    onChange={() => toggle("notif_friends")}
                  />
                </div>
              </div>

              {/* Feed Algorithm */}
              <div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-blue-500" /> ফিড অ্যালগরিদম
                </h3>
                <SettingRow
                  icon={<Sparkles size={16} className="text-blue-500" />}
                  label="স্মার্ট ফিড"
                  desc="ইন্টারেস্ট অনুযায়ী পোস্ট দেখাবে, বন্ধ করলে সাম্প্রতিক পোস্ট আগে দেখাবে"
                  checked={settings.feed_algorithm}
                  onChange={() => toggle("feed_algorithm")}
                />
              </div>

              {/* Privacy Section */}
              <div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-2 mb-3">
                  <Lock size={16} className="text-emerald-500" /> প্রাইভেসি
                </h3>
                <div className="space-y-2.5">
                  <SettingRow
                    icon={<EyeOff size={16} className="text-muted-foreground" />}
                    label="অনলাইন স্ট্যাটাস লুকান"
                    desc="অন্যরা দেখতে পাবে না আপনি অনলাইনে আছেন কিনা"
                    checked={settings.privacy_hide_online}
                    onChange={() => toggle("privacy_hide_online")}
                  />
                  <SettingRow
                    icon={<Eye size={16} className="text-muted-foreground" />}
                    label="লাস্ট সিন লুকান"
                    desc="সর্বশেষ অনলাইনের সময় অন্যদের কাছে দেখাবে না"
                    checked={settings.privacy_hide_last_seen}
                    onChange={() => toggle("privacy_hide_last_seen")}
                  />
                  <SettingRow
                    icon={<Globe size={16} className="text-muted-foreground" />}
                    label="পাবলিক প্রোফাইল"
                    desc="বন্ধ করলে শুধু ফ্রেন্ডরা আপনার প্রোফাইল দেখতে পারবে"
                    checked={settings.privacy_profile_public}
                    onChange={() => toggle("privacy_profile_public")}
                  />
                  <SettingRow
                    icon={<UserX size={16} className="text-muted-foreground" />}
                    label="ফ্রেন্ড রিকোয়েস্ট অনুমতি"
                    desc="বন্ধ করলে কেউ আপনাকে ফ্রেন্ড রিকোয়েস্ট পাঠাতে পারবে না"
                    checked={settings.privacy_allow_friend_requests}
                    onChange={() => toggle("privacy_allow_friend_requests")}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "blocked" && (
            <div className="pt-3">
              {loading ? (
                <div className="text-center py-8"><div className="animate-spin text-2xl">⏳</div></div>
              ) : blockedUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <ShieldBan size={32} className="mx-auto mb-2 opacity-30" />
                  কেউ ব্লক করা হয়নি
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-2.5 bg-secondary/50 rounded-xl border border-border">
                      <Avatar className="w-9 h-9">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                            {u.name.charAt(0)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="flex-1 text-sm font-bold text-foreground truncate">{u.name}</span>
                      <Button size="sm" variant="outline" onClick={() => unblock(u.id)} className="h-7 text-xs rounded-lg gap-1">
                        <Trash2 size={12} /> আনব্লক
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

function SettingRow({ icon, label, desc, checked, onChange }: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl border border-border cursor-pointer hover:bg-secondary/80 transition"
      onClick={onChange}
    >
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

export default FeedSettingsModal;
