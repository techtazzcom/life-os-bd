import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "@/lib/dataStore";
import { toast } from "sonner";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("ভুল ইমেইল বা পাসওয়ার্ড!");
    } else {
      toast.success("সফলভাবে লগইন হয়েছে!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="bg-card p-8 rounded-3xl shadow-xl w-full max-w-sm border border-border animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg text-xl">⚡</div>
          <h2 className="text-3xl font-black text-primary">Life OS</h2>
        </div>
        <p className="text-center text-muted-foreground text-sm mb-6">আপনার জীবন পরিচালনার সহচর</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="আপনার ইমেইল" required className="w-full p-4 bg-secondary rounded-2xl outline-none border border-border focus:border-primary transition text-foreground" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="পাসওয়ার্ড" required className="w-full p-4 bg-secondary rounded-2xl outline-none border border-border focus:border-primary transition text-foreground" />
          <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold shadow-lg hover:opacity-90 transition active:scale-95 disabled:opacity-50">
            {loading ? "লোড হচ্ছে..." : "লগইন করুন"}
          </button>
        </form>
        <div className="mt-6 text-center">
          <Link to="/register" className="text-sm font-bold text-muted-foreground hover:text-primary transition">নতুন অ্যাকাউন্ট তৈরি করুন</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
