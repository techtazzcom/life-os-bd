import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signUp } from "@/lib/dataStore";
import { toast } from "sonner";

const RegisterPage = () => {
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "", dob: "", address: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signUp(form.email, form.password, form.name, { mobile: form.mobile, dob: form.dob, address: form.address });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("রেজিস্ট্রেশন সফল! ইমেইল চেক করুন।");
      navigate("/login");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="bg-card p-8 rounded-3xl shadow-xl w-full max-w-md border border-border animate-fade-in-up">
        <h2 className="text-2xl font-bold text-center mb-6 text-foreground">নতুন অ্যাকাউন্ট তৈরি করুন</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="পূর্ণ নাম" required className="w-full p-3 border border-border rounded-xl outline-none bg-secondary text-foreground focus:border-primary transition" />
          <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="ইমেইল" required className="w-full p-3 border border-border rounded-xl outline-none bg-secondary text-foreground focus:border-primary transition" />
          <input type="text" name="mobile" value={form.mobile} onChange={handleChange} placeholder="মোবাইল নাম্বার" className="w-full p-3 border border-border rounded-xl outline-none bg-secondary text-foreground focus:border-primary transition" />
          <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="পাসওয়ার্ড (৬+ অক্ষর)" required minLength={6} className="w-full p-3 border border-border rounded-xl outline-none bg-secondary text-foreground focus:border-primary transition" />
          <div>
            <label className="text-xs font-bold text-muted-foreground ml-1">জন্ম তারিখ</label>
            <input type="date" name="dob" value={form.dob} onChange={handleChange} className="w-full p-3 border border-border rounded-xl outline-none bg-secondary text-foreground focus:border-primary transition" />
          </div>
          <textarea name="address" value={form.address} onChange={handleChange} placeholder="ঠিকানা" className="w-full p-3 border border-border rounded-xl outline-none bg-secondary text-foreground h-24 focus:border-primary transition" />
          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition active:scale-95 disabled:opacity-50">
            {loading ? "অপেক্ষা করুন..." : "রেজিস্ট্রেশন করুন"}
          </button>
        </form>
        <p className="text-center mt-4 text-sm text-muted-foreground">
          আগে থেকে অ্যাকাউন্ট আছে? <Link to="/login" className="text-primary font-bold">লগইন</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
