import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
import ChatPage from "./pages/ChatPage";
import FeedPage from "./pages/FeedPage";
import { CallProvider } from "./components/call/CallProvider";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  useOnlineStatus();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);


// ইউজারের অ্যাক্টিভিটি আপডেট করার জন্য নতুন কোড
  useEffect(() => {
    const updateActivity = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase
          .from('profiles')
          .update({ 
            last_seen: new Date().toISOString(),
            is_online: true 
          })
          .eq('user_id', session.user.id);
      }
    };

    // ইউজার যখনই সাইটে থাকবে, প্রতি ১ মিনিট পরপর আপডেট হবে
    updateActivity(); 
    const interval = setInterval(updateActivity, 60000); 

    return () => clearInterval(interval);
  }, []);






  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthenticated(!!session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><div className="text-primary text-xl font-bold animate-pulse">Life OS লোড হচ্ছে...</div></div>;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthenticated(!!session);
      setLoading(false);
    });
  }, []);

  if (loading) return null;
  if (authenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Load dynamic site settings (favicon)
function useSiteSettings() {
  useEffect(() => {
    supabase.from("site_settings" as any).select("*").then(({ data }) => {
      if (!data) return;
      (data as any[]).forEach((s: any) => {
        if (s.key === "site_favicon" && s.value) {
          const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
          if (link) link.href = s.value;
        }
      });
    });
  }, []);
}

const App = () => {
  useSiteSettings();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <CallProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
          <Route path="/forgot-password" element={<AuthRoute><ForgotPasswordPage /></AuthRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </CallProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
};

export default App;
