import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PostFeed from "@/components/feed/PostFeed";
import FeedNotifications from "@/components/feed/FeedNotifications";

export default function FeedPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, { name: string; avatar_url?: string | null }>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  // প্রোফাইল লোড করুন নোটিফিকেশনের জন্য
  useEffect(() => {
    if (!currentUserId) return;
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, avatar_url");
      if (data) {
        const map: Record<string, { name: string; avatar_url?: string | null }> = {};
        data.forEach((p: any) => {
          map[p.id] = { name: p.name, avatar_url: p.avatar_url };
        });
        setProfiles(map);
      }
    };
    fetchProfiles();
  }, [currentUserId]);

  const handlePostSubmitted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="max-w-2xl mx-auto py-4 px-2">
      {/* পোস্ট কম্পোজার - পরে PostComposer কম্পোনেন্ট তৈরি করে এখানে যোগ করুন */}
      {/* <PostComposer currentUserId={currentUserId} onPostSubmitted={handlePostSubmitted} /> */}

      {/* ফিড */}
      <PostFeed currentUserId={currentUserId} refreshTrigger={refreshTrigger} />

      {/* নোটিফিকেশন */}
      <FeedNotifications currentUserId={currentUserId} profiles={profiles} />
    </div>
  );
}
