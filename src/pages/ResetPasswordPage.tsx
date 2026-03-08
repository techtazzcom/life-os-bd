import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    } else {
      // Also check if user has an active session from the recovery link
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        } else {
          toast.error("অবৈধ বা মেয়াদোত্তীর্ণ রিসেট লিংক!");
          navigate("/login");
        }
      });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!");
      return;
    }
    if (password !== confirm) {
      toast.error("পাসওয়ার্ড মিলছে না!");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!");
      navigate("/dashboard");
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-primary text-xl font-bold animate-pulse">যাচাই করা হচ্ছে...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="bg-card p-8 rounded-3xl shadow-xl w-full max-w-sm border border-border animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg text-xl">🔒</div>
          <h2 className="text-2xl font-black text-foreground">নতুন পাসওয়ার্ড</h2>
        </div>
        <p className="text-center text-muted-foreground text-sm mb-6">আপনার নতুন পাসওয়ার্ড সেট করুন</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="নতুন পাসওয়ার্ড (৬+ অক্ষর)"
            required
            minLength={6}
            className="w-full p-4 bg-secondary rounded-2xl outline-none border border-border focus:border-primary transition text-foreground"
          />
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="পাসওয়ার্ড নিশ্চিত করুন"
            required
            minLength={6}
            className="w-full p-4 bg-secondary rounded-2xl outline-none border border-border focus:border-primary transition text-foreground"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold shadow-lg hover:opacity-90 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? "আপডেট হচ্ছে..." : "পাসওয়ার্ড আপডেট করুন"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
