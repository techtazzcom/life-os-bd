import { useState, useRef } from "react";
import { updateProfile, type UserProfile } from "@/lib/dataStore";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompress";

interface Props {
  user: UserProfile;
  onClose: () => void;
  onLogout: () => void;
}

const ProfileModal = ({ user, onClose, onLogout }: Props) => {
  const [form, setForm] = useState(user);
  const [avatarUrl, setAvatarUrl] = useState((user as any).avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("শুধুমাত্র ছবি আপলোড করতে পারবেন!");
      return;
    }

    setUploading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      // Compress to under 50KB
      const compressed = await compressImage(file);
      const filePath = `${authUser.id}/avatar.jpg`;

      // Upload (upsert)
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, { 
          contentType: "image/jpeg", 
          upsert: true 
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const url = urlData.publicUrl + "?t=" + Date.now(); // cache bust

      // Update profile
      await supabase.from("profiles").update({ avatar_url: url } as any).eq("user_id", authUser.id);
      setAvatarUrl(url);
      toast.success(`প্রোফাইল পিকচার আপডেট হয়েছে! (${(compressed.size / 1024).toFixed(1)}KB)`);
    } catch (err: any) {
      console.error(err);
      toast.error("আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(form);
    toast.success("প্রোফাইল আপডেট হয়েছে!");
    onClose();
  };

  const Field = ({ label, name, type = "text", placeholder = "" }: { label: string; name: string; type?: string; placeholder?: string }) => (
    <div>
      <label className="text-xs font-bold text-muted-foreground ml-1">{label}</label>
      <input type={type} name={name} value={(form as any)[name] || ''} onChange={handleChange} placeholder={placeholder} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground focus:border-primary transition" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-foreground/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card w-full max-w-lg rounded-3xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar animate-fade-in-up shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-foreground">প্রোফাইল আপডেট</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase">আপনার তথ্য পরিবর্তন করুন</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-destructive text-2xl">✕</button>
        </div>

        {/* Avatar Upload */}
        <div className="flex flex-col items-center mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group"
            disabled={uploading}
          >
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 shadow-lg transition-transform group-hover:scale-105">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl font-black text-primary">
                  {form.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-2xl">{uploading ? "⏳" : "📷"}</span>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          <p className="text-[11px] text-muted-foreground mt-2 font-medium">
            {uploading ? "কম্প্রেস ও আপলোড হচ্ছে..." : "ছবি পরিবর্তন করতে ক্লিক করুন (সর্বোচ্চ 50KB)"}
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Field label="পূর্ণ নাম" name="name" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Field label="মোবাইল" name="mobile" />
              <label className="flex items-center gap-2 mt-1.5 ml-1 cursor-pointer">
                <Switch checked={!!(form as any).hide_mobile} onCheckedChange={v => setForm(p => ({ ...p, hide_mobile: v }))} />
                <span className="text-[11px] font-bold text-muted-foreground">শুধু আমি দেখব</span>
              </label>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground ml-1">রক্তের গ্রুপ</label>
              <select name="blood_group" value={form.blood_group || ''} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground">
                <option value="">নির্বাচন</option>
                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground ml-1">ইমেইল</label>
            <input type="email" value={form.email} disabled className="w-full p-3 bg-secondary/50 border border-border rounded-2xl outline-none text-muted-foreground cursor-not-allowed" />
            <label className="flex items-center gap-2 mt-1.5 ml-1 cursor-pointer">
              <Switch checked={!!(form as any).hide_email} onCheckedChange={v => setForm(p => ({ ...p, hide_email: v }))} />
              <span className="text-[11px] font-bold text-muted-foreground">শুধু আমি দেখব</span>
            </label>
          </div>

          <Field label="ইন্ট্রো / বায়ো" name="intro" placeholder="নিজের সম্পর্কে কিছু লিখুন..." />
          <Field label="কর্মস্থল / পেশা" name="work" placeholder="যেমন: সফটওয়্যার ইঞ্জিনিয়ার" />
          <Field label="শিক্ষা প্রতিষ্ঠান" name="institution" placeholder="স্কুল/কলেজ/বিশ্ববিদ্যালয়" />
          <Field label="শখ" name="hobby" placeholder="কোডিং, বাগান করা" />
          <Field label="জন্ম তারিখ" name="dob" type="date" />
          <Field label="ওয়েবসাইট" name="website" placeholder="https://example.com" />
          <Field label="সোশ্যাল লিংক" name="social_link" placeholder="ফেসবুক/টুইটার লিংক" />
          <div>
            <label className="text-xs font-bold text-muted-foreground ml-1">ঠিকানা</label>
            <textarea name="address" value={form.address} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground h-20" />
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button type="submit" className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black shadow-lg hover:opacity-90 transition active:scale-95">পরিবর্তন সেভ করুন</button>
            <button type="button" onClick={onLogout} className="text-center text-destructive font-bold py-2 hover:underline">লগআউট</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;
