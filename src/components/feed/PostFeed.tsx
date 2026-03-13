import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { Heart, MessageCircle } from "lucide-react";

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  user_id: string;
  created_at: string;
  profiles?: {
    name: string;
    avatar_url: string | null;
  };
}

interface PostFeedProps {
  currentUserId: string;
  refreshTrigger: number;
}

export default function PostFeed({ currentUserId, refreshTrigger }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Fetch posts error:", error);
      // fallback without join
      const { data: fallbackData } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts(fallbackData || []);
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-400">লোড হচ্ছে...</div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">📭</div>
        <p className="text-gray-600 font-medium">কোনো পোস্ট নেই</p>
        <p className="text-gray-400 text-sm">প্রথম পোস্ট করুন!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="bg-white rounded-xl shadow-sm border p-4">
          <div className="flex items-center gap-3 mb-3">
            {post.profiles?.avatar_url ? (
              <img src={post.profiles.avatar_url} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                {post.profiles?.name?.charAt(0) || "U"}
              </div>
            )}
            <div>
              <p className="font-medium text-sm">{post.profiles?.name || "ব্যবহারকারী"}</p>
              <p className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: bn })}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{post.content}</p>

          {post.image_url && (
            <img src={post.image_url} alt="" className="rounded-lg w-full max-h-96 object-cover mb-3" />
          )}

          <div className="flex items-center gap-4 pt-2 border-t text-gray-400">
            <button className="flex items-center gap-1 text-sm hover:text-red-500 transition">
              <Heart size={18} /> পছন্দ
            </button>
            <button className="flex items-center gap-1 text-sm hover:text-blue-500 transition">
              <MessageCircle size={18} /> মন্তব্য
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
