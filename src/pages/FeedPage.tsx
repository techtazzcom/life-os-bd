import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PostComposer from "@/components/feed/PostComposer";
import PostFeed from "@/components/feed/PostFeed";
import StoriesBar from "@/components/feed/StoriesBar";
import FeedNotifications from "@/components/feed/FeedNotifications";

export default function FeedPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  const handlePostSubmitted = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* স্টোরি বার */}
      <StoriesBar currentUserId={currentUserId} />

      {/* পোস্ট কম্পোজার */}
      <PostComposer
        currentUserId={currentUserId}
        onPostSubmitted={handlePostSubmitted}
      />

      {/* ফিড */}
      <PostFeed
        currentUserId={currentUserId}
        refreshTrigger={refreshTrigger}
      />

      {/* নোটিফিকেশন */}
      <FeedNotifications
        onClose={() => {}}
        currentUserId={currentUserId}
        profiles={{}}
      />
    </div>
  );
}
