import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BadgeCheck, UserPlus, MessageCircle, UserCheck, ShieldBan, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import UserAvatar from "./UserAvatar";

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

interface Props {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  if (!showWhenEmpty && !value) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
      <span className="text-xl">{icon}</span>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</span>
        <span className="text-sm font-medium text-foreground">{value || "তথ্য নেই"}</span>
      </div>
    </div>
  );
};

export default function UserProfileDialog({ userId, open, onOpenChange }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && userId) {
      fetchUserProfile();
    }
  }, [open, userId]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast.error("প্রোফাইল লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const startPrivateChat = () => {
    if (profile) {
      onOpenChange(false);
      navigate(`/chat?user=${profile.user_id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none bg-background gap-0">
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : profile ? (
          <>
            {/* Header/Cover Area */}
            <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5 border-b border-border/50" />
            
            <div className="px-5 pb-4 -mt-12 relative">
              <div className="flex justify-between items-end mb-4">
                <div className="relative inline-block rounded-full p-1 bg-background border-2 border-border shadow-xl">
                  <UserAvatar 
                    name={profile.name} 
                    avatarUrl={profile.avatar_url} 
                    size={90} 
                  />
                  {profile.is_online && (
                    <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-background rounded-full" />
                  )}
                </div>
                <div className="flex gap-2 mb-1">
                  <Button size="icon" variant="secondary" className="rounded-full h-10 w-10 shadow-sm" onClick={startPrivateChat}>
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xl font-bold tracking-tight">{profile.name}</h2>
                  {profile.is_verified && <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500/10" />}
                </div>
                {profile.intro && (
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    "{profile.intro}"
                  </p>
                )}
              </div>
            </div>

            {/* Info Sections */}
            <div className="px-5 pb-6 space-y-2 overflow-y-auto max-h-[350px] custom-scrollbar">
              <InfoRow icon="✉️" label="ইমেইল" value={profile.hide_email ? "গোপন রাখা হয়েছে" : profile.email} />
              <InfoRow icon="📱" label="মোবাইল" value={profile.hide_mobile ? "গোপন রাখা হয়েছে" : profile.mobile} />
              <InfoRow icon="📍" label="ঠিকানা" value={profile.address} />
              <InfoRow icon="💼" label="কর্মস্থল / পেশা" value={profile.work} />
              <InfoRow icon="🩸" label="রক্তের গ্রুপ" value={profile.blood_group} />
              <InfoRow icon="🎓" label="শিক্ষা প্রতিষ্ঠান" value={profile.institution} />
              <InfoRow icon="🎯" label="শখ" value={profile.hobby} />
              <InfoRow icon="🌐" label="ওয়েবসাইট" value={profile.website} />
              <InfoRow icon="🔗" label="সোশ্যাল লিংক" value={profile.social_link} />
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">ইউজার পাওয়া যায়নি।</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
