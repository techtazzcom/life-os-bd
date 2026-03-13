import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Profile {
  user_id: string;
  name: string;
  is_online?: boolean;
  is_verified?: boolean;
  avatar_url?: string | null;
}

interface Friendship {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
}

interface Props {
  currentUserId: string;
  profiles: Record<string, Profile>;
  onSelectUser?: (userId: string) => void;
}

const FriendList = ({ currentUserId, profiles, onSelectUser }: Props) => {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const loadFriends = async () => {
    if (!currentUserId) return;
    setLoading(true);

    const { data: friendships } = await supabase
      .from("friendships")
      .select("*")
      .eq("status", "accepted")
      .or(`requester_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`);

    if (friendships) {
      const friendIds = friendships.map((f: Friendship) =>
        f.requester_id === currentUserId ? f.receiver_id : f.requester_id
      );

      const friendProfiles = friendIds
        .map(id => profiles[id])
        .filter(Boolean) as Profile[];

      setFriends(friendProfiles);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadFriends();
  }, [open, currentUserId, profiles]);

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:border-primary transition shrink-0"
      >
        <Users size={18} />
      </button>

      {open && (
        <div className="fixed sm:absolute right-2 left-2 sm:left-auto sm:right-0 top-14 sm:top-full sm:mt-2 w-auto sm:w-72 max-h-[70vh] sm:max-h-[400px] overflow-y-auto bg-card border border-border rounded-2xl shadow-xl z-50 animate-fade-in-up">
          <div className="px-4 py-3 border-b border-border">
            <h4 className="font-black text-sm text-foreground">👥 ফ্রেন্ড লিস্ট ({friends.length})</h4>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin text-2xl">⏳</div>
            </div>
          ) : friends.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              কোনো ফ্রেন্ড নেই
            </div>
          ) : (
            <div className="divide-y divide-border">
              {friends.map(friend => (
                <div
                  key={friend.user_id}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/50 transition cursor-pointer"
                  onClick={() => {
                    onSelectUser?.(friend.user_id);
                    setOpen(false);
                  }}
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      {friend.avatar_url ? (
                        <img src={friend.avatar_url} alt={friend.name} className="w-full h-full object-cover" />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary font-black">
                          {friend.name.charAt(0)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {friend.is_online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate flex items-center gap-1">
                      {friend.name}
                      {friend.is_verified && <BadgeCheck size={14} className="text-blue-500 shrink-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {friend.is_online ? (
                        <span className="text-emerald-500 font-semibold">অনলাইন</span>
                      ) : (
                        "অফলাইন"
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FriendList;
