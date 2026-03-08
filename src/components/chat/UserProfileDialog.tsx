import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
        setLoading(false);
      });
  }, [userId, open]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("bn-BD", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

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
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent pt-8 pb-6 px-6 text-center">
              <Avatar className="w-20 h-20 mx-auto mb-3 border-4 border-background shadow-lg">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-black">
                  {profile.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-foreground">
                  {profile.name}
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground font-semibold mt-1">{profile.email}</p>
            </div>

            {/* Info section */}
            <div className="px-5 pb-6 space-y-2">
              <InfoRow icon="📱" label="মোবাইল" value={profile.mobile} />
              <InfoRow icon="🩸" label="রক্তের গ্রুপ" value={profile.blood_group} />
              <InfoRow icon="🎓" label="শিক্ষা প্রতিষ্ঠান" value={profile.institution} />
              <InfoRow icon="🎯" label="শখ" value={profile.hobby} />
              <InfoRow icon="🎂" label="জন্ম তারিখ" value={formatDate(profile.dob)} />
              <InfoRow icon="📍" label="ঠিকানা" value={profile.address} />

              {!profile.mobile && !profile.blood_group && !profile.institution && !profile.hobby && !profile.dob && !profile.address && (
                <p className="text-center text-muted-foreground text-sm py-4 font-semibold">
                  কোনো অতিরিক্ত তথ্য যুক্ত করা হয়নি
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileDialog;
