import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, ShieldBan, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface BlockedUser {
  id: string;
  blocked_id: string;
  name: string;
  avatar_url?: string | null;
}

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
    if (open && tab === "blocked") loadBlocked();
  }, [open, tab, currentUserId]);

  const unblock = async (blockId: string) => {
    await supabase.from("user_blocks").delete().eq("id", blockId);
    setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
    toast.success("আনব্লক করা হয়েছে");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <Settings size={20} /> নিউজফিড সেটিংস
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border">
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

        <div className="px-5 pb-5 min-h-[200px]">
          {tab === "general" && (
            <div className="space-y-3 pt-3">
              <div className="p-3 bg-secondary/50 rounded-xl border border-border">
                <p className="text-sm font-bold text-foreground">🔔 নোটিফিকেশন</p>
                <p className="text-xs text-muted-foreground mt-1">লাইক, কমেন্ট এবং ফ্রেন্ড রিকোয়েস্টের নোটিফিকেশন চালু আছে</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-xl border border-border">
                <p className="text-sm font-bold text-foreground">📰 ফিড অ্যালগরিদম</p>
                <p className="text-xs text-muted-foreground mt-1">আপনার ইন্টারেস্ট অনুযায়ী পোস্ট দেখানো হয়</p>
              </div>
              <div className="p-3 bg-secondary/50 rounded-xl border border-border">
                <p className="text-sm font-bold text-foreground">🔒 প্রাইভেসি</p>
                <p className="text-xs text-muted-foreground mt-1">প্রোফাইল সেটিংস থেকে ইমেইল/মোবাইল লুকাতে পারবেন</p>
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

export default FeedSettingsModal;
