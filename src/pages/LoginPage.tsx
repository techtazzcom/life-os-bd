import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "@/lib/dataStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [blockInfo, setBlockInfo] = useState<{ type: string; reason?: string; lockUntil?: string; userId?: string } | null>(null);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealSent, setAppealSent] = useState(false);
  const [appealLoading, setAppealLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setBlockInfo(null);
    const { data, error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      toast.error("ভুল ইমেইল বা পাসওয়ার্ড!");
      return;
    }

    const userId = data?.user?.id;
    if (userId) {
      const { data: profile } = await supabase.from('profiles').select('status, lock_until, suspend_reason').eq('user_id', userId).single();
      if (profile) {
        const status = (profile as any).status;
        const lockUntil = (profile as any).lock_until;
        const suspendReason = (profile as any).suspend_reason;

        if (status === 'blocked') {
          await supabase.auth.signOut();
          setLoading(false);
          setBlockInfo({ type: 'blocked', reason: suspendReason, userId });
          return;
        }
        if (status === 'locked' && lockUntil) {
          const lockDate = new Date(lockUntil);
          if (lockDate > new Date()) {
            await supabase.auth.signOut();
            setLoading(false);
            setBlockInfo({ type: 'locked', reason: suspendReason, lockUntil, userId });
            return;
          } else {
            await supabase.from('profiles').update({ status: 'active', lock_until: null, suspend_reason: null } as any).eq('user_id', userId);
          }
        }
        // Suspended users CAN login but with restrictions (handled in feed)
      }
    }

    setLoading(false);
    toast.success("সফলভাবে লগইন হয়েছে!");
    navigate("/dashboard");
  };

  const handleAppeal = async () => {
    if (!appealMessage.trim() || !blockInfo?.userId) return;
    setAppealLoading(true);
    // Need to sign in briefly to submit appeal
    const { data, error } = await signIn(email, password);
    if (error) {
      setAppealLoading(false);
      toast.error("আবেদন পাঠাতে ব্যর্থ!");
      return;
    }
    await supabase.from('appeals' as any).insert({
      user_id: blockInfo.userId,
      appeal_type: blockInfo.type === 'blocked' ? 'unblock' : 'unlock',
      message: appealMessage.trim(),
    });
    await supabase.auth.signOut();
    setAppealLoading(false);
    setAppealSent(true);
    toast.success("আবেদন সফলভাবে পাঠানো হয়েছে!");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      {blockInfo ? (
        <div className="bg-card p-8 rounded-3xl shadow-xl w-full max-w-sm border border-border animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">{blockInfo.type === 'blocked' ? '🚫' : '🔒'}</div>
            <h2 className="text-xl font-black text-destructive">
              {blockInfo.type === 'blocked' ? 'অ্যাকাউন্ট ব্লক করা হয়েছে' : 'অ্যাকাউন্ট লক করা আছে'}
            </h2>
            {blockInfo.reason && (
              <p className="text-sm text-muted-foreground mt-2 bg-destructive/10 rounded-xl p-3">
                <span className="font-bold">কারণ:</span> {blockInfo.reason}
              </p>
            )}
            {blockInfo.lockUntil && (
              <p className="text-sm text-muted-foreground mt-2">
                লক পর্যন্ত: <span className="font-bold text-foreground">{new Date(blockInfo.lockUntil).toLocaleDateString('bn-BD')}</span>
              </p>
            )}
          </div>

          {!appealSent ? (
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground">আনব্লক/আনলকের জন্য আবেদন করুন:</p>
              <textarea
                value={appealMessage}
                onChange={e => setAppealMessage(e.target.value)}
                placeholder="আপনার আবেদনের কারণ লিখুন..."
                className="w-full p-3 bg-secondary rounded-2xl outline-none border border-border focus:border-primary transition text-foreground text-sm resize-none h-24"
              />
              <button
                onClick={handleAppeal}
                disabled={!appealMessage.trim() || appealLoading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-bold shadow-lg hover:opacity-90 transition active:scale-95 disabled:opacity-50"
              >
                {appealLoading ? "পাঠানো হচ্ছে..." : "📩 আবেদন পাঠান"}
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-bold text-emerald-600">আবেদন পাঠানো হয়েছে! এডমিন শীঘ্রই রিভিউ করবেন।</p>
            </div>
          )}

          <button
            onClick={() => { setBlockInfo(null); setAppealSent(false); setAppealMessage(""); }}
            className="w-full mt-3 py-3 rounded-2xl font-bold text-muted-foreground hover:text-foreground transition bg-secondary"
          >
            ← লগইনে ফিরে যান
          </button>
        </div>
      ) : (
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
          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm font-bold text-primary hover:underline transition">পাসওয়ার্ড ভুলে গেছেন?</Link>
          </div>
          <div className="mt-3 text-center">
            <Link to="/register" className="text-sm font-bold text-muted-foreground hover:text-primary transition">নতুন অ্যাকাউন্ট তৈরি করুন</Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
