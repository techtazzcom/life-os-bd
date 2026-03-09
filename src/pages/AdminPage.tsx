import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { isAdmin, getAllUsers, getAdminStats, getActivityLogs, updateUserStatus, toggleVerified, sendAdminNotification, getAppeals, updateAppealStatus, deleteUserAccount, type AdminUser, type ActivityLog, type Appeal } from "@/lib/adminStore";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, UserCheck, UserX, Lock, Unlock, Eye, Bell, Activity, Search, ArrowLeft, BadgeCheck, Ban, Clock, Send, Trash2, LogIn, FileText, AlertTriangle, Plus, X, Flag, MessageSquare, ToggleLeft, ToggleRight, Settings, Upload, Image } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  blocked: "bg-red-500/15 text-red-600 border-red-500/30",
  suspended: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  locked: "bg-purple-500/15 text-purple-600 border-purple-500/30",
};

const statusLabels: Record<string, string> = {
  active: "সক্রিয়",
  blocked: "ব্লক",
  suspended: "সাসপেন্ড",
  locked: "লক",
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "users" | "appeals" | "logs" | "spam" | "reports" | "settings">("dashboard");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, blocked: 0, suspended: 0, locked: 0, verified: 0, online: 0 });
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [search, setSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 50;
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [actionModal, setActionModal] = useState<{ type: string; user: AdminUser } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; desc: string; onConfirm: () => void } | null>(null);
  const [reason, setReason] = useState("");
  const [lockDays, setLockDays] = useState(7);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [appealResponse, setAppealResponse] = useState("");
  const [spamWords, setSpamWords] = useState<any[]>([]);
  const [newSpamWord, setNewSpamWord] = useState("");
  const [spamViolations, setSpamViolations] = useState<any[]>([]);
  const [spamBans, setSpamBans] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [reportReplies, setReportReplies] = useState<Record<string, any[]>>({});
  const [reportReplyText, setReportReplyText] = useState("");
  const [replyingReportId, setReplyingReportId] = useState<string | null>(null);
  const [reportAdminNote, setReportAdminNote] = useState("");
  const [reportFilter, setReportFilter] = useState("");
  const [siteLogo, setSiteLogo] = useState("");
  const [siteFavicon, setSiteFavicon] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [featureToggles, setFeatureToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const check = async () => {
      const admin = await isAdmin();
      if (!admin) {
        toast.error("আপনার এডমিন অ্যাক্সেস নেই!");
        navigate("/dashboard");
        return;
      }
      setAuthorized(true);
      await refresh();
      setLoading(false);
    };
    check();
  }, [navigate]);

  const refresh = useCallback(async () => {
    const [u, s, l, a] = await Promise.all([getAllUsers(), getAdminStats(), getActivityLogs(), getAppeals()]);
    setUsers(u);
    setStats(s);
    setLogs(l);
    setAppeals(a);
    // Load spam data
    const { data: sw } = await supabase.from("spam_words" as any).select("*").order("created_at", { ascending: false });
    setSpamWords((sw as any[]) || []);
    const { data: sv } = await supabase.from("spam_violations" as any).select("*").order("created_at", { ascending: false }).limit(50);
    setSpamViolations((sv as any[]) || []);
    const { data: sb } = await supabase.from("spam_bans" as any).select("*").order("violation_count", { ascending: false });
    setSpamBans((sb as any[]) || []);
    // Load reports
    const { data: reps } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
    setReports((reps as any[]) || []);
    // Load all report replies
    if (reps && reps.length > 0) {
      const repIds = reps.map(r => r.id);
      const { data: repReplies } = await supabase.from("report_replies" as any).select("*").in("report_id", repIds).order("created_at", { ascending: true });
      const grouped: Record<string, any[]> = {};
      (repReplies as any[] || []).forEach((r: any) => {
        if (!grouped[r.report_id]) grouped[r.report_id] = [];
        grouped[r.report_id].push(r);
      });
      setReportReplies(grouped);
    }
    // Load site settings
    const { data: siteSettings } = await supabase.from("site_settings" as any).select("*");
    if (siteSettings) {
      (siteSettings as any[]).forEach((s: any) => {
        if (s.key === "site_logo") setSiteLogo(s.value || "");
        if (s.key === "site_favicon") setSiteFavicon(s.value || "");
      });
    }
  }, []);

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.mobile || "").includes(search) ||
    u.status === search
  );

  // Reset page when search changes
  useEffect(() => { setUserPage(1); }, [search]);

  const showConfirm = (title: string, desc: string, onConfirm: () => void) => {
    setConfirmModal({ title, desc, onConfirm });
  };

  const handleAction = async () => {
    if (!actionModal) return;
    const { type, user } = actionModal;

    const doAction = async () => {
      setActionLoading(true);
      try {
        if (type === "block") {
          await updateUserStatus(user.user_id, "blocked", reason);
          toast.success(`${user.name} ব্লক করা হয়েছে`);
        } else if (type === "suspend") {
          await updateUserStatus(user.user_id, "suspended", reason);
          toast.success(`${user.name} সাসপেন্ড করা হয়েছে`);
        } else if (type === "lock") {
          await updateUserStatus(user.user_id, "locked", reason, lockDays);
          toast.success(`${user.name} ${lockDays} দিনের জন্য লক করা হয়েছে`);
        } else if (type === "activate") {
          await updateUserStatus(user.user_id, "active");
          toast.success(`${user.name} সক্রিয় করা হয়েছে`);
        } else if (type === "verify") {
          await toggleVerified(user.user_id, !user.is_verified);
          toast.success(user.is_verified ? "ভেরিফিকেশন সরানো হয়েছে" : "ভেরিফাই করা হয়েছে");
        } else if (type === "notify") {
          if (!notifTitle.trim() || !notifMessage.trim()) {
            toast.error("টাইটেল ও মেসেজ দিন");
            setActionLoading(false);
            return;
          }
          await sendAdminNotification(user.user_id, notifTitle, notifMessage, "info");
          toast.success("নোটিফিকেশন পাঠানো হয়েছে");
        } else if (type === "delete") {
          await deleteUserAccount(user.user_id);
          toast.success(`${user.name}-এর অ্যাকাউন্ট ডিলেট করা হয়েছে`);
        }
        await refresh();
      } catch (e: any) {
        toast.error(e.message || "কিছু ভুল হয়েছে!");
      }
      setActionLoading(false);
      setActionModal(null);
      setReason("");
      setNotifTitle("");
      setNotifMessage("");
    };

    // Confirm for destructive actions
    if (["block", "suspend", "lock", "delete"].includes(type)) {
      const labels: Record<string, string> = {
        block: `${user.name}-কে ব্লক করতে চান?`,
        suspend: `${user.name}-কে সাসপেন্ড করতে চান?`,
        lock: `${user.name}-কে লক করতে চান?`,
        delete: `${user.name}-এর অ্যাকাউন্ট সম্পূর্ণ ডিলেট করতে চান? এটি পূর্বাবস্থায় ফেরানো যাবে না!`,
      };
      showConfirm("⚠️ নিশ্চিত করুন", labels[type] || "এই কাজ করতে চান?", doAction);
    } else {
      doAction();
    }
  };

  const handleLoginAsUser = (user: AdminUser) => {
    showConfirm(
      "🔑 ইউজার হিসেবে লগইন",
      `${user.name}-এর অ্যাকাউন্টে ঢুকতে চান? এটি শুধুমাত্র ভিউ করার জন্য ব্যবহার করুন।`,
      async () => {
        // Store admin session info
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          localStorage.setItem("admin_return_token", session.access_token);
          localStorage.setItem("admin_return_refresh", session.refresh_token);
        }
        // Sign in as user using service role via edge function
        // For now, we navigate to their data view
        toast.info(`${user.name}-এর ড্যাশবোর্ড দেখা হচ্ছে...`);
        // Store impersonation mode
        localStorage.setItem("impersonate_user_id", user.user_id);
        localStorage.setItem("impersonate_user_name", user.name);
        navigate("/dashboard");
        setConfirmModal(null);
      }
    );
  };

  const handleAppealAction = (appeal: Appeal, action: "approved" | "rejected") => {
    const doIt = async () => {
      await updateAppealStatus(appeal.id, action, appealResponse);
      if (action === "approved") {
        await updateUserStatus(appeal.user_id, "active");
        toast.success("আবেদন অনুমোদিত — অ্যাকাউন্ট সক্রিয় করা হয়েছে");
      } else {
        await sendAdminNotification(appeal.user_id, "❌ আবেদন প্রত্যাখ্যান", appealResponse || "আপনার আবেদন প্রত্যাখ্যান করা হয়েছে।", "warning");
        toast.success("আবেদন প্রত্যাখ্যান করা হয়েছে");
      }
      setAppealResponse("");
      await refresh();
      setConfirmModal(null);
    };

    showConfirm(
      action === "approved" ? "✅ আবেদন অনুমোদন" : "❌ আবেদন প্রত্যাখ্যান",
      action === "approved"
        ? "এই আবেদন অনুমোদন করলে ইউজারের অ্যাকাউন্ট সক্রিয় হবে।"
        : "এই আবেদন প্রত্যাখ্যান করতে চান?",
      doIt
    );
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-primary text-xl font-bold animate-pulse">এডমিন প্যানেল লোড হচ্ছে...</div></div>;

  const addSpamWord = async () => {
    if (!newSpamWord.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("spam_words" as any).insert({ word: newSpamWord.trim().toLowerCase(), added_by: user?.id });
    setNewSpamWord("");
    await refresh();
    toast.success("স্প্যাম ওয়ার্ড যুক্ত হয়েছে");
  };

  const removeSpamWord = async (id: string) => {
    await supabase.from("spam_words" as any).delete().eq("id", id);
    await refresh();
    toast.success("স্প্যাম ওয়ার্ড সরানো হয়েছে");
  };

  const liftSpamBan = async (userId: string) => {
    await supabase.from("spam_bans" as any).update({ ban_until: null, is_permanent: false, updated_at: new Date().toISOString() }).eq("user_id", userId);
    await sendAdminNotification(userId, "✅ স্প্যাম ব্যান মুক্ত", "আপনার স্প্যাম ব্যান তুলে নেওয়া হয়েছে। সতর্ক থাকুন।", "success");
    await refresh();
    toast.success("ব্যান মুক্ত করা হয়েছে");
  };
  if (!authorized) return null;

  const timeAgo = (d: string) => { try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: bn }); } catch { return ""; } };
  const pendingAppeals = appeals.filter(a => a.status === "pending");

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-2 rounded-xl hover:bg-secondary transition"><ArrowLeft size={20} /></button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center text-white"><Shield size={20} /></div>
              <div>
                <h1 className="text-lg font-black text-foreground">এডমিন প্যানেল</h1>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Life OS Control Center</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {stats.online} অনলাইন
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {[
            { key: "dashboard", icon: Activity, label: "ড্যাশবোর্ড" },
            { key: "users", icon: Users, label: "ইউজার" },
            { key: "reports", icon: Flag, label: `রিপোর্ট${reports.filter(r => r.status === 'pending').length ? ` (${reports.filter(r => r.status === 'pending').length})` : ""}` },
            { key: "spam", icon: AlertTriangle, label: `স্প্যাম${spamBans.filter(b => b.violation_count > 0).length ? ` (${spamBans.filter(b => b.violation_count > 0).length})` : ""}` },
            { key: "appeals", icon: FileText, label: `আবেদন${pendingAppeals.length ? ` (${pendingAppeals.length})` : ""}` },
            { key: "logs", icon: Clock, label: "লগ" },
            { key: "settings", icon: Settings, label: "সেটিংস" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition whitespace-nowrap ${tab === t.key ? "bg-primary text-primary-foreground shadow-lg" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 pb-10">
        {/* Dashboard Tab */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "মোট ইউজার", value: stats.total, icon: Users, color: "from-blue-500 to-cyan-500" },
                { label: "সক্রিয়", value: stats.active, icon: UserCheck, color: "from-emerald-500 to-green-500" },
                { label: "ব্লক/সাসপেন্ড", value: stats.blocked + stats.suspended, icon: Ban, color: "from-red-500 to-pink-500" },
                { label: "ভেরিফাইড", value: stats.verified, icon: BadgeCheck, color: "from-purple-500 to-indigo-500" },
              ].map((s, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>
                    <s.icon size={18} />
                  </div>
                  <p className="text-2xl font-black text-foreground">{s.value}</p>
                  <p className="text-xs font-bold text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Pending Appeals Alert */}
            {pendingAppeals.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 cursor-pointer hover:bg-amber-500/15 transition" onClick={() => setTab("appeals")}>
                <p className="font-bold text-amber-600 flex items-center gap-2">
                  <FileText size={18} /> {pendingAppeals.length}টি নতুন আবেদন অপেক্ষমান
                </p>
              </div>
            )}

            {/* Online Users */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> অনলাইন ইউজার ({stats.online})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {users.filter(u => u.is_online).map(u => (
                  <div key={u.user_id} className="flex items-center gap-3 p-3 bg-secondary rounded-xl cursor-pointer hover:bg-secondary/80 transition" onClick={() => { setSelectedUser(u); setTab("users"); }}>
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">{u.name.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate flex items-center gap-1">{u.name} {u.is_verified && <BadgeCheck size={14} className="text-blue-500" />}</p>
                      <p className="text-[10px] text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                ))}
                {stats.online === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-4">কেউ অনলাইনে নেই</p>}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Activity size={18} /> সাম্প্রতিক কার্যক্রম</h3>
              <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                {logs.slice(0, 20).map(log => (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-secondary rounded-xl text-sm">
                    <div>
                      <span className="font-bold text-foreground">{log.action}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{timeAgo(log.created_at)}</span>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">কোনো কার্যক্রম নেই</p>}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="নাম, ইমেইল বা মোবাইল দিয়ে খুঁজুন..." className="w-full pl-12 pr-4 py-3 rounded-2xl bg-card border border-border outline-none font-bold text-sm text-foreground focus:border-primary transition" />
            </div>

            <div className="flex gap-2 flex-wrap">
              {["all", "active", "blocked", "suspended", "locked"].map(f => (
                <button key={f} onClick={() => setSearch(f === "all" ? "" : f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${search === f || (f === "all" && !search) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {f === "all" ? "সবাই" : statusLabels[f] || f} ({f === "all" ? stats.total : (stats as any)[f] || 0})
                </button>
              ))}
            </div>

            {/* Page info */}
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>মোট {filteredUsers.length} জন ইউজার</span>
              <span>পৃষ্ঠা {userPage}/{Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE))}</span>
            </div>

            <div className="space-y-3">
              {filteredUsers.slice((userPage - 1) * USERS_PER_PAGE, userPage * USERS_PER_PAGE).map(user => (
                <div key={user.user_id} className="bg-card rounded-2xl p-4 border border-border shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-black text-primary">{user.name.charAt(0)}</div>
                        {user.is_online && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-card" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                          {user.name}
                          {user.is_verified && <BadgeCheck size={16} className="text-blue-500 shrink-0" />}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusColors[user.status] || statusColors.active}`}>
                            {statusLabels[user.status] || "সক্রিয়"}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        {user.mobile && <p className="text-xs text-muted-foreground">{user.mobile}</p>}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          যোগদান: {timeAgo(user.created_at)}
                          {user.lock_until && ` • লক পর্যন্ত: ${new Date(user.lock_until).toLocaleDateString('bn-BD')}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      {user.status !== "active" && (
                        <button onClick={() => setActionModal({ type: "activate", user })} className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition" title="সক্রিয় করুন"><Unlock size={14} /></button>
                      )}
                      <button onClick={() => setActionModal({ type: "block", user })} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition" title="ব্লক"><Ban size={14} /></button>
                      <button onClick={() => setActionModal({ type: "suspend", user })} className="p-2 rounded-xl bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition" title="সাসপেন্ড"><UserX size={14} /></button>
                      <button onClick={() => setActionModal({ type: "lock", user })} className="p-2 rounded-xl bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition" title="লক"><Lock size={14} /></button>
                      <button onClick={() => setActionModal({ type: "verify", user })} className={`p-2 rounded-xl transition ${user.is_verified ? "bg-blue-500/20 text-blue-500" : "bg-secondary text-muted-foreground"} hover:bg-blue-500/25`} title="ভেরিফাই"><BadgeCheck size={14} /></button>
                      <button onClick={() => setActionModal({ type: "notify", user })} className="p-2 rounded-xl bg-secondary text-muted-foreground hover:bg-secondary/80 transition" title="নোটিফিকেশন"><Bell size={14} /></button>
                      <button onClick={() => handleLoginAsUser(user)} className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 transition" title="ঢুকুন"><LogIn size={14} /></button>
                      <button onClick={() => setActionModal({ type: "delete", user })} className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition" title="ডিলেট"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-center py-10 text-muted-foreground font-bold">কোনো ইউজার পাওয়া যায়নি</div>
              )}
            </div>

            {/* Pagination */}
            {filteredUsers.length > USERS_PER_PAGE && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => { setUserPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={userPage <= 1}
                  className="px-4 py-2 rounded-xl bg-card border border-border font-bold text-sm text-foreground hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← আগের
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.ceil(filteredUsers.length / USERS_PER_PAGE) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => { setUserPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className={`w-9 h-9 rounded-xl font-bold text-sm transition ${p === userPage ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setUserPage(p => Math.min(Math.ceil(filteredUsers.length / USERS_PER_PAGE), p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={userPage >= Math.ceil(filteredUsers.length / USERS_PER_PAGE)}
                  className="px-4 py-2 rounded-xl bg-card border border-border font-bold text-sm text-foreground hover:bg-secondary transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  পরের →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {tab === "reports" && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-foreground flex items-center gap-2"><Flag size={20} /> পোস্ট রিপোর্টসমূহ</h3>
            <div className="flex gap-2 flex-wrap mb-2">
              {["all", "pending", "resolved", "closed"].map(f => {
                const count = f === "all" ? reports.length : reports.filter(r => r.status === f).length;
                return (
                  <button key={f} onClick={() => setReportFilter(f === "all" ? "" : f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${reportFilter === f || (f === "all" && !reportFilter) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                    {f === "all" ? "সব" : f === "pending" ? "⏳ অপেক্ষমান" : f === "resolved" ? "✅ সমাধান" : "❌ বন্ধ"} ({count})
                  </button>
                );
              })}
            </div>
            {reports.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground font-bold">
                <div className="text-4xl mb-3">📭</div>
                কোনো রিপোর্ট নেই
              </div>
            ) : (
              <div className="space-y-3">
                {reports
                  .filter(r => !reportFilter || reportFilter === "all" || r.status === reportFilter)
                  .map((report: any) => {
                  const reporter = users.find(u => u.user_id === report.reporter_id);
                  const reported = users.find(u => u.user_id === report.reported_id);
                  const replies = reportReplies[report.id] || [];
                  return (
                    <div key={report.id} className={`bg-card rounded-2xl p-4 border shadow-sm ${report.status === "pending" ? "border-amber-500/40" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-foreground text-sm">{reporter?.name || "অজানা"}</span>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className="font-bold text-foreground text-sm">{reported?.name || "অজানা"}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                              report.status === "pending" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" :
                              report.status === "resolved" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" :
                              "bg-secondary text-muted-foreground border-border"
                            }`}>
                              {report.status === "pending" ? "⏳ অপেক্ষমান" : report.status === "resolved" ? "✅ সমাধান" : "❌ বন্ধ"}
                            </span>
                          </div>
                          <p className="text-sm text-foreground bg-secondary/60 rounded-xl p-3 my-2">{report.reason}</p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(report.created_at)}</p>

                          {/* Existing replies */}
                          {replies.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {replies.map((rep: any) => (
                                <div key={rep.id} className={`rounded-xl px-3 py-2 text-xs ${rep.is_admin ? 'bg-primary/10 border border-primary/20' : 'bg-secondary border border-border'}`}>
                                  <span className="font-black text-[10px] text-muted-foreground">{rep.is_admin ? '🛡️ এডমিন' : `👤 ${reporter?.name || 'ইউজার'}`} • </span>
                                  <span className="text-foreground font-semibold">{rep.message}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {report.admin_note && (
                            <p className="text-xs text-muted-foreground mt-2 bg-primary/5 border border-primary/20 rounded-lg p-2">🛡️ এডমিন নোট: {report.admin_note}</p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0">
                          {/* Admin reply input */}
                          {replyingReportId === report.id ? (
                            <div className="w-48 space-y-1.5">
                              <textarea
                                value={reportReplyText}
                                onChange={e => setReportReplyText(e.target.value)}
                                placeholder="রিপ্লাই লিখুন..."
                                className="w-full p-2 rounded-lg bg-secondary border border-border outline-none text-xs font-bold text-foreground resize-none h-16 focus:border-primary transition"
                              />
                              <div className="flex gap-1">
                                <button onClick={async () => {
                                  if (!reportReplyText.trim()) return;
                                  const { data: { user } } = await supabase.auth.getUser();
                                  await supabase.from("report_replies" as any).insert({
                                    report_id: report.id,
                                    user_id: user?.id,
                                    message: reportReplyText.trim(),
                                    is_admin: true,
                                  });
                                  // Notify reporter
                                  await supabase.from("admin_notifications").insert({
                                    user_id: report.reporter_id,
                                    title: "🛡️ রিপোর্টে এডমিন রিপ্লাই",
                                    message: reportReplyText.trim(),
                                    type: "info",
                                  });
                                  setReportReplyText("");
                                  setReplyingReportId(null);
                                  refresh();
                                  toast.success("রিপ্লাই পাঠানো হয়েছে");
                                }} disabled={!reportReplyText.trim()} className="flex-1 px-2 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:opacity-90 disabled:opacity-50 transition">পাঠান</button>
                                <button onClick={() => { setReplyingReportId(null); setReportReplyText(""); }} className="px-2 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[10px] font-bold hover:bg-secondary/80 transition">✕</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button onClick={() => setReplyingReportId(report.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition">
                                <MessageSquare size={12} /> রিপ্লাই
                              </button>
                              {report.status === "pending" && (
                                <>
                                  <button onClick={async () => {
                                    await supabase.from("reports").update({ status: "resolved", admin_note: reportAdminNote || null } as any).eq("id", report.id);
                                    await supabase.from("admin_notifications").insert({
                                      user_id: report.reporter_id,
                                      title: "✅ রিপোর্ট সমাধান হয়েছে",
                                      message: reportAdminNote || "আপনার রিপোর্ট পর্যালোচনা করা হয়েছে।",
                                      type: "success",
                                    });
                                    refresh();
                                    toast.success("রিপোর্ট সমাধান করা হয়েছে");
                                  }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 text-xs font-bold hover:bg-emerald-500/25 transition">
                                    ✅ সমাধান
                                  </button>
                                  <button onClick={async () => {
                                    await supabase.from("reports").update({ status: "closed" } as any).eq("id", report.id);
                                    refresh();
                                    toast.success("রিপোর্ট বন্ধ করা হয়েছে");
                                  }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-bold hover:bg-secondary/80 transition">
                                    ❌ বন্ধ
                                  </button>
                                </>
                              )}
                              {/* Toggle reply enabled */}
                              <button onClick={async () => {
                                await supabase.from("reports").update({ reply_enabled: !report.reply_enabled } as any).eq("id", report.id);
                                refresh();
                                toast.success(report.reply_enabled ? "ইউজার রিপ্লাই বন্ধ" : "ইউজার রিপ্লাই চালু");
                              }} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition ${report.reply_enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-secondary text-muted-foreground"}`}>
                                {report.reply_enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                {report.reply_enabled ? "রিপ্লাই চালু" : "রিপ্লাই বন্ধ"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Appeals Tab */}
        {tab === "appeals" && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-foreground flex items-center gap-2"><FileText size={20} /> ইউজার আবেদনসমূহ</h3>
            {appeals.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground font-bold">
                <div className="text-4xl mb-3">📭</div>
                কোনো আবেদন নেই
              </div>
            ) : (
              <div className="space-y-3">
                {appeals.map(appeal => {
                  const appealUser = users.find(u => u.user_id === appeal.user_id);
                  return (
                    <div key={appeal.id} className={`bg-card rounded-2xl p-4 border shadow-sm ${appeal.status === "pending" ? "border-amber-500/40" : "border-border"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-foreground">{appealUser?.name || "অজানা"}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${appeal.status === "pending" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : appeal.status === "approved" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-red-500/15 text-red-600 border-red-500/30"}`}>
                              {appeal.status === "pending" ? "অপেক্ষমান" : appeal.status === "approved" ? "অনুমোদিত" : "প্রত্যাখ্যাত"}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-bold">
                              {appeal.appeal_type === "unblock" ? "আনব্লক" : "আনলক"}
                            </span>
                          </div>
                          <p className="text-sm text-foreground bg-secondary/60 rounded-xl p-3 my-2">{appeal.message}</p>
                          <p className="text-[10px] text-muted-foreground">{timeAgo(appeal.created_at)}</p>
                          {appeal.admin_response && (
                            <p className="text-xs text-muted-foreground mt-1 bg-secondary rounded-lg p-2">এডমিন: {appeal.admin_response}</p>
                          )}
                        </div>
                        {appeal.status === "pending" && (
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <input
                              type="text"
                              value={appealResponse}
                              onChange={e => setAppealResponse(e.target.value)}
                              placeholder="রিপ্লাই..."
                              className="text-xs p-2 rounded-lg bg-secondary border border-border outline-none w-28"
                            />
                            <button onClick={() => handleAppealAction(appeal, "approved")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 text-xs font-bold hover:bg-emerald-500/25 transition">
                              ✅ অনুমোদন
                            </button>
                            <button onClick={() => handleAppealAction(appeal, "rejected")} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-600 text-xs font-bold hover:bg-red-500/25 transition">
                              ❌ প্রত্যাখ্যান
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Spam Tab */}
        {tab === "spam" && (
          <div className="space-y-6">
            {/* Add Spam Word */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><AlertTriangle size={18} /> স্প্যাম ওয়ার্ড ম্যানেজমেন্ট</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newSpamWord}
                  onChange={e => setNewSpamWord(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addSpamWord()}
                  placeholder="নতুন স্প্যাম ওয়ার্ড যুক্ত করুন..."
                  className="flex-1 px-4 py-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground focus:border-primary transition"
                />
                <button
                  onClick={addSpamWord}
                  disabled={!newSpamWord.trim()}
                  className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus size={16} /> যুক্ত
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {spamWords.map((sw: any) => (
                  <div key={sw.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-full text-sm font-bold text-destructive">
                    {sw.word}
                    <button onClick={() => removeSpamWord(sw.id)} className="hover:bg-destructive/20 rounded-full p-0.5 transition"><X size={14} /></button>
                  </div>
                ))}
                {spamWords.length === 0 && <p className="text-sm text-muted-foreground">কোনো স্প্যাম ওয়ার্ড যুক্ত করা হয়নি</p>}
              </div>
            </div>

            {/* Active Bans */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Ban size={18} /> স্প্যাম ব্যান তালিকা</h3>
              <div className="space-y-2">
                {spamBans.filter((b: any) => b.violation_count > 0).map((ban: any) => {
                  const banUser = users.find(u => u.user_id === ban.user_id);
                  const isActive = ban.is_permanent || (ban.ban_until && new Date(ban.ban_until) > new Date());
                  return (
                    <div key={ban.id} className={`flex items-center justify-between p-3 rounded-xl border ${isActive ? "bg-destructive/5 border-destructive/30" : "bg-secondary border-border"}`}>
                      <div>
                        <p className="text-sm font-bold text-foreground">{banUser?.name || "অজানা"}</p>
                        <p className="text-xs text-muted-foreground">
                          লঙ্ঘন: {ban.violation_count} বার
                          {ban.is_permanent && " • স্থায়ী ব্যান"}
                          {!ban.is_permanent && ban.ban_until && isActive && ` • ব্যান: ${new Date(ban.ban_until).toLocaleDateString('bn-BD')} পর্যন্ত`}
                          {!isActive && " • মুক্ত"}
                        </p>
                      </div>
                      {isActive && (
                        <button
                          onClick={() => liftSpamBan(ban.user_id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 text-xs font-bold hover:bg-emerald-500/25 transition"
                        >
                          <Unlock size={14} className="inline mr-1" /> মুক্ত করুন
                        </button>
                      )}
                    </div>
                  );
                })}
                {spamBans.filter((b: any) => b.violation_count > 0).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">কোনো স্প্যাম ব্যান নেই</p>
                )}
              </div>
            </div>

            {/* Recent Violations */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Eye size={18} /> সাম্প্রতিক লঙ্ঘন</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
                {spamViolations.map((v: any) => {
                  const vUser = users.find(u => u.user_id === v.user_id);
                  return (
                    <div key={v.id} className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {vUser?.name || "অজানা"} <span className="text-destructive">"{v.word_matched}"</span> ব্যবহার করেছে
                        </p>
                        <p className="text-[10px] text-muted-foreground">{v.content_type === "post" ? "পোস্টে" : "কমেন্টে"} • {timeAgo(v.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                {spamViolations.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">কোনো লঙ্ঘন নেই</p>}
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {tab === "logs" && (
          <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Activity size={18} /> অ্যাক্টিভিটি লগ</h3>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto no-scrollbar">
              {logs.map(log => {
                const actionLabels: Record<string, string> = {
                  status_active: "✅ সক্রিয় করেছেন",
                  status_blocked: "🚫 ব্লক করেছেন",
                  status_suspended: "⚠️ সাসপেন্ড করেছেন",
                  status_locked: "🔒 লক করেছেন",
                  verify: "✅ ভেরিফাই করেছেন",
                  unverify: "❌ আনভেরিফাই করেছেন",
                  delete_account: "🗑️ অ্যাকাউন্ট ডিলেট করেছেন",
                  appeal_approved: "✅ আবেদন অনুমোদন করেছেন",
                  appeal_rejected: "❌ আবেদন প্রত্যাখ্যান করেছেন",
                };
                const targetUser = users.find(u => u.user_id === log.target_user_id);
                return (
                  <div key={log.id} className="flex items-center justify-between p-3 bg-secondary rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        {actionLabels[log.action] || log.action}
                        {targetUser && <span className="text-primary ml-1">{targetUser.name}</span>}
                      </p>
                      {log.details?.reason && <p className="text-xs text-muted-foreground mt-0.5">কারণ: {log.details.reason}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{timeAgo(log.created_at)}</span>
                  </div>
                );
              })}
              {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">কোনো লগ নেই</p>}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {tab === "settings" && (
          <div className="space-y-6">
            <h3 className="text-lg font-black text-foreground flex items-center gap-2"><Settings size={20} /> সাইট সেটিংস</h3>

            {/* Feature Controls */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h4 className="font-bold text-foreground mb-4 flex items-center gap-2">⚙️ ফিচার কন্ট্রোল</h4>
              <p className="text-xs text-muted-foreground mb-4">এখান থেকে সাইটের বিভিন্ন ফিচার অন/অফ করতে পারবেন।</p>
              <div className="space-y-3">
                {[
                  { key: "feature_post_images", label: "📸 পোস্টে ছবি আপলোড", desc: "ইউজাররা পোস্টে ছবি যোগ করতে পারবে" },
                  { key: "feature_chat_images", label: "💬 চ্যাটে ছবি পাঠানো", desc: "ইউজাররা চ্যাটে ছবি পাঠাতে পারবে" },
                  { key: "feature_comment_images", label: "💭 কমেন্টে ছবি", desc: "ইউজাররা কমেন্টে ছবি যোগ করতে পারবে" },
                  { key: "feature_stories", label: "📱 স্টোরি", desc: "ইউজাররা ২৪ ঘণ্টার স্টোরি পোস্ট করতে পারবে" },
                ].map(item => {
                  const isOn = featureToggles[item.key] ?? true;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                      <button
                        onClick={async () => {
                          const newVal = !isOn;
                          setFeatureToggles(prev => ({ ...prev, [item.key]: newVal }));
                          await supabase.from("site_settings" as any).update({ value: newVal ? "true" : "false", updated_at: new Date().toISOString() }).eq("key", item.key);
                          toast.success(`${item.label} ${newVal ? "চালু" : "বন্ধ"} করা হয়েছে`);
                        }}
                        className={`w-12 h-7 rounded-full transition-colors flex items-center px-1 ${isOn ? "bg-primary" : "bg-muted"}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-background shadow transition-transform ${isOn ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Site Logo */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h4 className="font-bold text-foreground mb-4 flex items-center gap-2"><Image size={18} /> সাইট লোগো</h4>
              <div className="flex items-center gap-4">
                {siteLogo ? (
                  <img src={siteLogo} alt="Site Logo" className="w-20 h-20 object-contain rounded-xl border border-border bg-secondary p-1" />
                ) : (
                  <div className="w-20 h-20 rounded-xl border border-dashed border-border bg-secondary flex items-center justify-center text-muted-foreground">
                    <Image size={28} />
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-muted-foreground">PNG, JPG বা SVG ফাইল আপলোড করুন। সর্বোচ্চ 2MB।</p>
                  <div className="flex gap-2">
                    <label className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition flex items-center gap-2 ${uploadingLogo ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                      <Upload size={14} /> {uploadingLogo ? "আপলোড হচ্ছে..." : "লোগো আপলোড"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingLogo}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { toast.error("ফাইল সাইজ 2MB এর বেশি!"); return; }
                          setUploadingLogo(true);
                          const ext = file.name.split('.').pop();
                          const path = `site/logo.${ext}`;
                          const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
                          if (error) { toast.error("আপলোড ব্যর্থ!"); setUploadingLogo(false); return; }
                          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                          const url = urlData.publicUrl + "?t=" + Date.now();
                          await supabase.from("site_settings" as any).update({ value: url, updated_at: new Date().toISOString() }).eq("key", "site_logo");
                          setSiteLogo(url);
                          setUploadingLogo(false);
                          toast.success("লোগো আপডেট হয়েছে!");
                        }}
                      />
                    </label>
                    {siteLogo && (
                      <button onClick={async () => {
                        await supabase.from("site_settings" as any).update({ value: "", updated_at: new Date().toISOString() }).eq("key", "site_logo");
                        setSiteLogo("");
                        toast.success("লোগো সরানো হয়েছে");
                      }} className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition">
                        সরান
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Site Favicon */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h4 className="font-bold text-foreground mb-4 flex items-center gap-2">⭐ সাইট ফেভিকন</h4>
              <div className="flex items-center gap-4">
                {siteFavicon ? (
                  <img src={siteFavicon} alt="Favicon" className="w-16 h-16 object-contain rounded-xl border border-border bg-secondary p-1" />
                ) : (
                  <div className="w-16 h-16 rounded-xl border border-dashed border-border bg-secondary flex items-center justify-center text-muted-foreground text-2xl">
                    ⭐
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-muted-foreground">ছোট আইকন (32x32 বা 64x64 পিক্সেল রেকমেন্ডেড)। PNG বা ICO ফরম্যাট।</p>
                  <div className="flex gap-2">
                    <label className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition flex items-center gap-2 ${uploadingFavicon ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                      <Upload size={14} /> {uploadingFavicon ? "আপলোড হচ্ছে..." : "ফেভিকন আপলোড"}
                      <input
                        type="file"
                        accept="image/png,image/x-icon,image/svg+xml"
                        className="hidden"
                        disabled={uploadingFavicon}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 1 * 1024 * 1024) { toast.error("ফাইল সাইজ 1MB এর বেশি!"); return; }
                          setUploadingFavicon(true);
                          const ext = file.name.split('.').pop();
                          const path = `site/favicon.${ext}`;
                          const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
                          if (error) { toast.error("আপলোড ব্যর্থ!"); setUploadingFavicon(false); return; }
                          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                          const url = urlData.publicUrl + "?t=" + Date.now();
                          await supabase.from("site_settings" as any).update({ value: url, updated_at: new Date().toISOString() }).eq("key", "site_favicon");
                          setSiteFavicon(url);
                          setUploadingFavicon(false);
                          toast.success("ফেভিকন আপডেট হয়েছে!");
                          // Update favicon in DOM
                          const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
                          if (link) link.href = url;
                        }}
                      />
                    </label>
                    {siteFavicon && (
                      <button onClick={async () => {
                        await supabase.from("site_settings" as any).update({ value: "", updated_at: new Date().toISOString() }).eq("key", "site_favicon");
                        setSiteFavicon("");
                        toast.success("ফেভিকন সরানো হয়েছে");
                      }} className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition">
                        সরান
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
              <h4 className="font-bold text-foreground mb-4">👁️ প্রিভিউ</h4>
              <div className="flex items-center gap-3 bg-secondary rounded-xl p-4">
                {siteFavicon ? (
                  <img src={siteFavicon} alt="Favicon" className="w-6 h-6 object-contain" />
                ) : (
                  <span className="text-lg">⚡</span>
                )}
                {siteLogo ? (
                  <img src={siteLogo} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <span className="text-lg font-black text-primary">Life OS</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">এভাবে সাইটের হেডার ও ব্রাউজার ট্যাবে দেখাবে</p>
            </div>
          </div>
        )}
      </main>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-foreground/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setActionModal(null)}>
          <div className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-black text-foreground mb-1">
              {actionModal.type === "block" && "🚫 ব্লক করুন"}
              {actionModal.type === "suspend" && "⚠️ সাসপেন্ড করুন"}
              {actionModal.type === "lock" && "🔒 লক করুন"}
              {actionModal.type === "activate" && "✅ সক্রিয় করুন"}
              {actionModal.type === "verify" && (actionModal.user.is_verified ? "❌ আনভেরিফাই" : "✅ ভেরিফাই")}
              {actionModal.type === "notify" && "📢 নোটিফিকেশন পাঠান"}
              {actionModal.type === "delete" && "🗑️ অ্যাকাউন্ট ডিলেট"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              ইউজার: <strong className="text-foreground">{actionModal.user.name}</strong> ({actionModal.user.email})
            </p>

            <div className="space-y-3">
              {(actionModal.type === "block" || actionModal.type === "suspend" || actionModal.type === "lock") && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground">কারণ (ঐচ্ছিক)</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="কারণ লিখুন..." className="w-full p-3 mt-1 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground resize-none h-20" />
                </div>
              )}

              {actionModal.type === "lock" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground">কতদিনের জন্য লক?</label>
                  <div className="flex gap-2 mt-1">
                    {[1, 3, 7, 14, 30].map(d => (
                      <button key={d} onClick={() => setLockDays(d)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${lockDays === d ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground"}`}>
                        {d} দিন
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {actionModal.type === "notify" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">টাইটেল</label>
                    <input type="text" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="নোটিফিকেশনের টাইটেল..." className="w-full p-3 mt-1 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground">মেসেজ</label>
                    <textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} placeholder="নোটিফিকেশনের মেসেজ লিখুন..." className="w-full p-3 mt-1 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground resize-none h-24" />
                  </div>
                </>
              )}

              {actionModal.type === "delete" && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                  <p className="text-sm font-bold text-destructive">⚠️ সতর্কতা: এই কাজ পূর্বাবস্থায় ফেরানো যাবে না! ইউজারের সমস্ত ডেটা মুছে যাবে।</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setActionModal(null)} className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition">বাতিল</button>
                <button onClick={handleAction} disabled={actionLoading} className={`flex-1 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 ${actionModal.type === "delete" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>
                  {actionLoading ? "অপেক্ষা করুন..." : "নিশ্চিত"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-foreground/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setConfirmModal(null)}>
          <div className="bg-card rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-foreground mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-muted-foreground mb-5">{confirmModal.desc}</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-bold hover:bg-secondary/80 transition">না, বাতিল</button>
              <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition">হ্যাঁ, নিশ্চিত</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
