import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  last_seen?: string | null;
  avatar_url?: string | null;
}

interface Props {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50">
      <span className="text-lg shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-foreground break-words">{value}</p>
      </div>
    </div>
  );
};

const UserProfileDialog = ({ userId, open, onOpenChange }: Props) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);

    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsOwnProfile(user?.id === userId);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (data) setProfile(data as unknown as Profile);
      setLoading(false);
    };
    load();
  }, [userId, open]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" });
    } catch { return dateStr; }
  };

  const formatLastSeen = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
      if (diffMin < 1) return "এইমাত্র";
      if (diffMin < 60) return `${diffMin} মিনিট আগে`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} ঘন্টা আগে`;
      return d.toLocaleDateString("bn-BD", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return null; }
  };

  const showEmail = isOwnProfile || !profile?.hide_email;
  const showMobile = isOwnProfile || !profile?.hide_mobile;

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
            <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent pt-8 pb-6 px-6 text-center relative">
              <div className="w-20 h-20 mx-auto mb-3 rounded-full border-4 border-background shadow-lg overflow-hidden relative">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-black">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {profile.is_online && (
                <span className="absolute top-[88px] left-1/2 translate-x-[18px] w-4 h-4 bg-green-500 border-2 border-background rounded-full animate-pulse" />
              )}
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-foreground flex items-center justify-center gap-2">
                  {profile.name}
                  {profile.is_online && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-500">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      অনলাইন
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              {!profile.is_online && (
                <p className="text-xs font-bold mt-1 text-muted-foreground">
                  ⚫ {formatLastSeen(profile.last_seen) || 'অফলাইন'}
                </p>
              )}
              {profile.intro && (
                <p className="text-xs text-muted-foreground font-semibold mt-2 italic">"{profile.intro}"</p>
              )}
            </div>

            {/* Info */}
            <div className="px-5 pb-6 space-y-2">
              {showEmail && <InfoRow icon="✉️" label="ইমেইল" value={profile.email} />}
              {showMobile && <InfoRow icon="📱" label="মোবাইল" value={profile.mobile} />}
              <InfoRow icon="💼" label="কর্মস্থল / পেশা" value={profile.work} />
              <InfoRow icon="🩸" label="রক্তের গ্রুপ" value={profile.blood_group} />
              <InfoRow icon="🎓" label="শিক্ষা প্রতিষ্ঠান" value={profile.institution} />
              <InfoRow icon="🎯" label="শখ" value={profile.hobby} />
              <InfoRow icon="🎂" label="জন্ম তারিখ" value={formatDate(profile.dob)} />
              <InfoRow icon="🌐" label="ওয়েবসাইট" value={profile.website} />
              <InfoRow icon="🔗" label="সোশ্যাল লিংক" value={profile.social_link} />
              <InfoRow icon="📍" label="ঠিকানা" value={profile.address} />

              {(() => {
                const hasAny = (showEmail && profile.email) || (showMobile && profile.mobile) || profile.work || profile.blood_group || profile.institution || profile.hobby || profile.dob || profile.website || profile.social_link || profile.address;
                if (hasAny) return null;
                return (
                  <p className="text-center text-muted-foreground text-sm py-4 font-semibold">
                    কোনো অতিরিক্ত তথ্য যুক্ত করা হয়নি
                  </p>
                );
              })()}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileDialog;
