import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks user's online status globally.
 * Sets is_online=true on mount, false on unmount/tab close.
 */
export function useOnlineStatus() {
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const setOnline = async (online: boolean) => {
      const uid = userIdRef.current;
      if (!uid) return;
      
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-online-status`;
        
        if (!online && navigator.sendBeacon) {
          // Use sendBeacon for offline (works on tab close)
          navigator.sendBeacon(url, JSON.stringify({ user_id: uid, online: false }));
          return;
        }

        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ online, user_id: uid }),
        });
      } catch {
        // Fallback direct update
        await supabase.from("profiles").update({ is_online: online, last_seen: new Date().toISOString() } as any).eq("user_id", uid);
      }
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        userIdRef.current = user.id;
        setOnline(true);
      }
    });

    // Heartbeat every 2 minutes
    const heartbeat = setInterval(() => {
      if (userIdRef.current) setOnline(true);
    }, 120000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setOnline(false);
      } else {
        setOnline(true);
      }
    };

    const handleBeforeUnload = () => {
      setOnline(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(heartbeat);
      setOnline(false);
    };
  }, []);
}
