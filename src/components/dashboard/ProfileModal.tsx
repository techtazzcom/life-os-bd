import { useState } from "react";
import { updateProfile, type UserProfile } from "@/lib/dataStore";
import { toast } from "sonner";

interface Props {
  user: UserProfile;
  onClose: () => void;
  onLogout: () => void;
}

const ProfileModal = ({ user, onClose, onLogout }: Props) => {
  const [form, setForm] = useState(user);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(form);
    toast.success("প্রোফাইল আপডেট হয়েছে!");
    onClose();
  };

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
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="text-xs font-bold text-muted-foreground ml-1">পূর্ণ নাম</label><input type="text" name="name" value={form.name} onChange={handleChange} required className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground focus:border-primary transition" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-muted-foreground ml-1">মোবাইল</label><input type="text" name="mobile" value={form.mobile} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground" /></div>
            <div><label className="text-xs font-bold text-muted-foreground ml-1">রক্তের গ্রুপ</label>
              <select name="blood_group" value={form.blood_group || ''} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground">
                <option value="">নির্বাচন</option>
                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div><label className="text-xs font-bold text-muted-foreground ml-1">শিক্ষা প্রতিষ্ঠান</label><input type="text" name="institution" value={form.institution || ''} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground" placeholder="স্কুল/কলেজ/বিশ্ববিদ্যালয়" /></div>
          <div><label className="text-xs font-bold text-muted-foreground ml-1">শখ</label><input type="text" name="hobby" value={form.hobby || ''} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground" placeholder="কোডিং, বাগান করা" /></div>
          <div><label className="text-xs font-bold text-muted-foreground ml-1">জন্ম তারিখ</label><input type="date" name="dob" value={form.dob} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground" /></div>
          <div><label className="text-xs font-bold text-muted-foreground ml-1">ঠিকানা</label><textarea name="address" value={form.address} onChange={handleChange} className="w-full p-3 bg-secondary border border-border rounded-2xl outline-none text-foreground h-20" /></div>
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
