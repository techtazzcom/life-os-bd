import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, UserPlus, MessageCircle, UserCheck, Clock, ShieldBan, Flag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

interface Profile {
  user_id: string;
  name: string;
  email: string;
  mobile?: string | null;
  blood_group?: string | null;
  institution?: string | null;
  hobby?: string | null;
  dob?: string | null;
  address?: string | null;
  intro?: string | null;
  work?: string | null;
  website?: string | null;
  social_link?: string | null;
  hide_email?: boolean;
  hide_mobile?: boolean;
  is_online?: boolean;
  is_verified?: boolean;
  last_seen?: string | null;
  avatar_url?: string | null;
}

type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface Props {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOnline?: boolean; // রিয়েল-টাইম অনলাইন স্ট্যাটাস রিসিভ করার জন্য নতুন prop
}

const InfoRow = ({
  icon,
  label,
  value,
  showWhenEmpty = false,
}: {
  icon: string;
  label: string;
  value?: string | null;
  showWhenEmpty?: boolean;
}) => {
  const hasValue = !!value && value.trim() !== "";
  if (!hasValue && !showWhenEmpty) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
      <span className="text-lg shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-sm break-words ${hasValue ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
          {hasValue ? value : "তথ্য যোগ করা হয়নি"}
        </p>
      </div>
    </div>
  );
};

const UserProfileDialog = ({ userId, open, onOpenChange, isOnline }: Props) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<FriendshipStatus>('none');
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showFriendMenu, setShowFriendMenu] = useState(false);
  const [showReportInput, setShowReportInput] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const friendMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);
    setShowFriendMenu(false);
    setShowReportInput(false);
    setReportReason("");

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      setIsOwnProfile(user?.id === userId);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (data) setProfile(data as unknown as Profile);

      // Check friendship status
      if (user && user.id !== userId) {
        const { data: friendships } = await supabase
          .from("friendships")
          .select("*")
          .or(`and(requester_id.eq.${user.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${user.id})`);

        if (friendships && friendships.length > 0) {
          const f = friendships[0];
          setFriendshipId(f.id);
          if (f.status === 'accepted') {
            setFriendshipStatus('accepted');
          } else if (f.requester_id === user.id) {
            setFriendshipStatus('pending_sent');
          } else {
            setFriendshipStatus('pending_received');
          }
        } else {
          setFriendshipStatus('none');
          setFriendshipId(null);
        }
      }

      setLoading(false);
    };
    load();
  }, [userId, open]);

  // Click outside friend menu
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (friendMenuRef.current && !friendMenuRef.current.contains(e.target as Node)) {
        setShowFriendMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
    } catch { return dateStr; }
  };

  // আপডেট করা Last Seen ফরমেট
  const formatLastSeen = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMin < 1) return "এইমাত্র সক্রিয়";
      if (diffMin < 60) return `${diffMin} মিনিট আগে সক্রিয়`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} ঘন্টা আগে সক্রিয়`;
      return d.toLocaleDateString("bn-BD", { month: "short", day: "numeric" }) + " সক্রিয়";
    } catch { return null; }
  };

  const sendFriendRequest = async () => {
    if (!currentUserId || !userId) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.from("friendships").insert({
        requester_id: currentUserId,
        receiver_id: userId,
        status: 'pending'
      }).select().single();

      if (error) throw error;

      await supabase.from("feed_notifications").insert({
        user_id: userId,
        actor_id: currentUserId,
        type: 'friend_request',
        friendship_id: data.id
      });

      setFriendshipStatus('pending_sent');
      setFriendshipId(data.id);
      toast.success("ফ্রেন্ড রিকোয়েস্ট পাঠানো হয়েছে!");
    } catch {
      toast.error("কিছু সমস্যা হয়েছে!");
    }
    setActionLoading(false);
  };

  const acceptFriendRequest = async () => {
    if (!friendshipId || !currentUserId || !userId) return;
    setActionLoading(true);
    try {
      await supabase.from("friendships").update({ status: 'accepted' }).eq("id", friendshipId);

      const { data: friendship } = await supabase.from("friendships").select("*").eq("id", friendshipId).single();
      if (friendship) {
        await supabase.from("feed_notifications").insert({
          user_id: friendship.requester_id,
          actor_id: currentUserId,
          type: 'friend_accepted',
          friendship_id: friendshipId
        });
      }

      setFriendshipStatus('accepted');
      toast.success("ফ্রেন্ড রিকোয়েস্ট গ্রহণ করা হয়েছে!");
    } catch {
      toast.error("কিছু সমস্যা হয়েছে!");
    }
    setActionLoading(false);
  };

  const cancelOrUnfriend = async () => {
    if (!friendshipId) return;
    setActionLoading(true);
    try {
      await supabase.from("friendships").delete().eq("id", friendshipId);
      setFriendshipStatus('none');
      setFriendshipId(null);
      setShowFriendMenu(false);
      toast.success(friendshipStatus === 'accepted' ? "আনফ্রেন্ড করা হয়েছে" : "রিকোয়েস্ট বাতিল করা হয়েছে");
    } catch {
      toast.error("কিছু সমস্যা হয়েছে!");
    }
    setActionLoading(false);
  };

  const blockUser = async () => {
    if (!currentUserId || !userId) return;
    setActionLoading(true);
    try {
      await supabase.from("user_blocks").insert({ blocker_id: currentUserId, blocked_id: userId });
      // Also unfriend if friends
      if (friendshipId) {
        await supabase.from("friendships").delete().eq("id", friendshipId);
        setFriendshipStatus('none');
        setFriendshipId(null);
      }
      setShowFriendMenu(false);
      toast.success("ব্লক করা হয়েছে");
      onOpenChange(false);
    } catch {
      toast.error("কিছু সমস্যা হয়েছে!");
    }
    setActionLoading(false);
  };

  const reportUser = async () => {
    if (!currentUserId || !userId || !reportReason.trim()) return;
    setActionLoading(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_id: userId,
        reason: reportReason.trim()
      });
      setShowReportInput(false);
      setReportReason("");
      setShowFriendMenu(false);
      toast.success("রিপোর্ট পাঠানো হয়েছে। এডমিন পর্যালোচনা করবেন।");
    } catch {
      toast.error("কিছু সমস্যা হয়েছে!");
    }
    setActionLoading(false);
  };

  const goToChat = () => {
    onOpenChange(false);
    navigate(`/chat?user=${userId}`);
  };

  const showEmail = isOwnProfile || !profile?.hide_email;
  const showMobile = isOwnProfile || !profile?.hide_mobile;

  // ChatPage থেকে আসা রিয়েল-টাইম অনলাইন স্ট্যাটাসকে অগ্রাধিকার দেওয়া হচ্ছে
  const isUserActuallyOnline = isOnline !== undefined ? isOnline : profile?.is_online;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden border-0">
        {loading || !profile ? (
          <div className="p-8 text-center">
            <div className="animate-spin text-3xl mb-2">⏳</div>
            <p className="text-muted-foreground text-sm font-bold">লোড হচ্ছে...</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent pt-8 pb-4 px-6 text-center relative">
              <div className="w-20 h-20 mx-auto mb-3 rounded-full border-4 border-background shadow-lg overflow-hidden relative">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-black">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* সবুজ বাতি (Green Dot) */}
              {isUserActuallyOnline && (
                <span className="absolute top-[88px] left-1/2 translate-x-[18px] w-4 h-4 bg-green-500 border-2 border-background rounded-full animate-pulse z-10" />
              )}
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-foreground flex items-center justify-center gap-2">
                  {profile.name}
                  {profile.is_verified && <BadgeCheck size={20} className="text-blue-500 shrink-0" />}
                  
                  {/* অনলাইন থাকলে শুধু সবুজ ডট, অফলাইন থাকলে সময় */}
                  {isUserActuallyOnline ? (
                    <span className="w-3 h-3 bg-green-500 rounded-full shadow-sm animate-pulse" title="অনলাইন"></span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground ml-1">
                      {formatLastSeen(profile.last_seen) || 'অফলাইন'}
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* Action buttons */}
              {!isOwnProfile && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  {friendshipStatus === 'none' && (
                    <Button
                      size="sm"
                      onClick={sendFriendRequest}
                      disabled={actionLoading}
                      className="gap-2 rounded-xl font-bold"
                    >
                      <UserPlus size={16} />
                      Add Friend
                    </Button>
                  )}
                  {friendshipStatus === 'pending_sent' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={cancelOrUnfriend}
                      disabled={actionLoading}
                      className="gap-2 rounded-xl font-bold"
                    >
                      <Clock size={16} />
                      রিকোয়েস্ট পাঠানো হয়েছে
                    </Button>
                  )}
                  {friendshipStatus === 'pending_received' && (
                    <Button
                      size="sm"
                      onClick={acceptFriendRequest}
                      disabled={actionLoading}
                      className="gap-2 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600"
                    >
                      <UserCheck size={16} />
                      গ্রহণ করুন
                    </Button>
                  )}
                  {friendshipStatus === 'accepted' && (
                    <div className="relative" ref={friendMenuRef}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowFriendMenu(!showFriendMenu)}
                        disabled={actionLoading}
                        className="gap-2 rounded-xl font-bold border border-primary/30"
                      >
                        <UserCheck size={16} className="text-primary" />
                        ফ্রেন্ড
                        <ChevronDown size={14} />
                      </Button>
                      {showFriendMenu && (
                        <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                          <button
                            onClick={cancelOrUnfriend}
                            className="w-full px-4 py-2.5 text-sm font-bold text-foreground hover:bg-secondary/80 flex items-center gap-2 transition"
                          >
                            <UserPlus size={14} /> আনফ্রেন্ড
                          </button>
                          <button
                            onClick={blockUser}
                            className="w-full px-4 py-2.5 text-sm font-bold text-foreground hover:bg-secondary/80 flex items-center gap-2 transition"
                          >
                            <ShieldBan size={14} /> ব্লক
                          </button>
                          <button
                            onClick={() => { setShowReportInput(true); setShowFriendMenu(false); }}
                            className="w-full px-4 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/10 flex items-center gap-2 transition"
                          >
                            <Flag size={14} /> রিপোর্ট
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={goToChat}
                    className="gap-2 rounded-xl font-bold"
                  >
                    <MessageCircle size={16} />
                    Message
                  </Button>
                </div>
              )}

              {/* Report input */}
              {showReportInput && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    placeholder="রিপোর্টের কারণ লিখুন..."
                    className="w-full p-2.5 bg-secondary rounded-xl border border-border text-sm text-foreground outline-none focus:border-primary transition resize-none h-16"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setShowReportInput(false)} className="h-7 text-xs rounded-lg">
                      বাতিল
                    </Button>
                    <Button size="sm" onClick={reportUser} disabled={!reportReason.trim() || actionLoading} className="h-7 text-xs rounded-lg bg-destructive hover:bg-destructive/90">
                      রিপোর্ট করুন
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="px-5 pb-6 space-y-2">
              {showEmail && <InfoRow icon="✉️" label="ইমেইল" value={profile.email} />}
              {showMobile && <InfoRow icon="📱" label="মোবাইল" value={profile.mobile} showWhenEmpty />}
              <InfoRow icon="🎂" label="জন্ম তারিখ" value={formatDate(profile.dob)} showWhenEmpty />
              <InfoRow icon="📍" label="ঠিকানা" value={profile.address} showWhenEmpty />
              <InfoRow icon="💼" label="কর্মস্থল / পেশা" value={profile.work} />
              <InfoRow icon="🩸" label="রক্তের গ্রুপ" value={profile.blood_group} />
              <InfoRow icon="🎓" label="শিক্ষা প্রতিষ্ঠান" value={profile.institution} />
              <InfoRow icon="🎯" label="শখ" value={profile.hobby} />
              <InfoRow icon="🌐" label="ওয়েবসাইট" value={profile.website} />
              <InfoRow icon="🔗" label="সোশ্যাল লিংক" value={profile.social_link} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileDialog;
