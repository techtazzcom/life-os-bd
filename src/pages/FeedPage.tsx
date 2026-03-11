import PostComposer from "@/components/feed/PostComposer";
import PostFeed from "@/components/feed/PostFeed";

// Component এর মধ্যে এগুলো যোগ করুন:

export default function FeedPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
      }
    });
  }, []);

  const handlePostSubmitted = () => {
    // ফিড রিফ্রেশ করুন
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* স্টোরি বার */}
      <StoriesBar currentUserId={currentUserId} profiles={{}} />

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

      {/* নোটিফিকেশন এবং অন্যান্য */}
      <FeedNotifications currentUserId={currentUserId} profiles={{}} />
      <FeedSettingsModal open={false} onOpenChange={() => {}} currentUserId={currentUserId} profiles={{}} />
    </div>
  );
}
