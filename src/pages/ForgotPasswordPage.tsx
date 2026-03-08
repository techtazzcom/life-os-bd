import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success("পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে!");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="bg-card p-8 rounded-3xl shadow-xl w-full max-w-sm border border-border animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg text-xl">🔑</div>
          <h2 className="text-2xl font-black text-foreground">পাসওয়ার্ড রিসেট</h2>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-5xl">📧</div>
            <p className="text-foreground font-bold">ইমেইল পাঠানো হয়েছে!</p>
            <p className="text-muted-foreground text-sm">
              <strong>{email}</strong> এ একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। আপনার ইমেইল চেক করুন।
            </p>
            <Link to="/login" className="inline-block mt-4 text-primary font-bold text-sm hover:underline">
              ← লগইনে ফিরে যান
            </Link>
          </div>
        ) : (
          <>
            <p className="text-center text-muted-foreground text-sm mb-6">
              আপনার ইমেইল দিন, আমরা পাসওয়ার্ড রিসেট লিংক পাঠাবো।
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="আপনার ইমেইল"
                required
                className="w-full p-4 bg-secondary rounded-2xl outline-none border border-border focus:border-primary transition text-foreground"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold shadow-lg hover:opacity-90 transition active:scale-95 disabled:opacity-50"
              >
                {loading ? "পাঠানো হচ্ছে..." : "রিসেট লিংক পাঠান"}
              </button>
            </form>
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm font-bold text-muted-foreground hover:text-primary transition">
                ← লগইনে ফিরে যান
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
