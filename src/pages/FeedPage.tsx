
import { useState, useEffect, useCallback, useRef } from "react";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { getMyStatus } from "@/lib/adminStore";

interface PostProfile {
  name: string;
  user_id: string;
  is_online?: boolean;
  is_verified?: boolean;
  avatar_url?: string | null;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_id: string | null;
  created_at: string;
  profile?: PostProfile;
  likes_count: number;
  liked_by_me: boolean;
  replies?: Comment[];
}

const REACTIONS = [
  { type: "like", emoji: "👍", label: "লাইক" },
  { type: "love", emoji: "❤️", label: "ভালোবাসা" },
  { type: "haha", emoji: "😂", label: "হাহা" },
  { type: "wow", emoji: "😮", label: "ওয়াও" },
  { type: "sad", emoji: "😢", label: "কষ্ট" },
  { type: "angry", emoji: "😡", label: "রাগ" },
];

interface PostReaction {
  user_id: string;
  reaction_type: string;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  category: string;
  created_at: string;
  profile?: PostProfile;
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  my_reaction: string | null;
  reactions: PostReaction[];
}

const CATEGORIES = [
  { value: "general", label: "সাধারণ", emoji: "📝" },
  { value: "tech", label: "প্রযুক্তি", emoji: "💻" },
  { value: "life", label: "জীবন", emoji: "🌱" },
  { value: "funny", label: "মজার", emoji: "😂" },
  { value: "news", label: "খবর", emoji: "📰" },
  { value: "islamic", label: "ইসলামিক", emoji: "🕌" },
  { value: "education", label: "শিক্ষা", emoji: "📚" },
  { value: "health", label: "স্বাস্থ্য", emoji: "💪" },
];

// Auto-detect category from content
const detectCategory = (content: string): string => {
  const lower = content.toLowerCase();
  const keywords: Record<string, string[]> = {
    tech: ["কোড", "প্রোগ্রামিং", "সফটওয়্যার", "ডেভেলপ", "টেক", "কম্পিউটার", "ল্যাপটপ", "মোবাইল", "অ্যাপ", "ওয়েব", "এআই", "ai", "code", "programming", "tech", "software", "developer", "react", "javascript", "python", "html", "css", "api", "database", "server", "linux", "github"],
    islamic: ["আল্লাহ", "নামাজ", "কুরআন", "হাদিস", "ইসলাম", "মসজিদ", "রমজান", "ঈদ", "দোয়া", "জুমা", "সালাত", "তাওবা", "জান্নাত", "রাসূল", "সুন্নাহ", "ইবাদত", "যাকাত", "হজ্জ", "রোজা", "ইফতার", "সেহরি"],
    health: ["স্বাস্থ্য", "ব্যায়াম", "ডাক্তার", "ওষুধ", "হাসপাতাল", "রোগ", "চিকিৎসা", "ফিটনেস", "যোগ", "ডায়েট", "ঘুম", "মানসিক", "স্ট্রেস", "health", "gym", "exercise", "doctor"],
    education: ["পড়াশোনা", "পরীক্ষা", "বিশ্ববিদ্যালয়", "স্কুল", "কলেজ", "শিক্ষা", "বই", "গবেষণা", "পড়া", "লেখা", "জ্ঞান", "শিক্ষক", "ছাত্র", "রেজাল্ট", "পাঠ", "study", "exam", "university", "school"],
    funny: ["হাহা", "মজা", "জোকস", "ফানি", "হাসি", "কৌতুক", "😂", "🤣", "lol", "funny", "joke", "haha"],
    news: ["খবর", "সংবাদ", "রাজনীতি", "সরকার", "নির্বাচন", "আন্দোলন", "প্রতিবাদ", "ব্রেকিং", "দুর্ঘটনা", "আইন", "news", "breaking", "politics"],
    life: ["জীবন", "ভালোবাসা", "পরিবার", "বন্ধু", "স্বপ্ন", "অনুভূতি", "মন", "কষ্ট", "সুখ", "দুঃখ", "ভ্রমণ", "প্রকৃতি", "গান", "সিনেমা", "ছবি", "রান্না", "খাবার"],
  };
  
  let bestCat = "general";
  let bestScore = 0;
  for (const [cat, words] of Object.entries(keywords)) {
    const score = words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestCat = cat; }
  }
  return bestCat;
};

const FeedPage = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostContent, setNewPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; postId: string; name: string } | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [profiles, setProfiles] = useState<Record<string, PostProfile>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showReactedBy, setShowReactedBy] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const viewTimers = useRef<Record<string, number>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [userStatus, setUserStatus] = useState<{ status: string; suspend_reason: string | null }>({ status: "active", suspend_reason: null });
  const [appealMessage, setAppealMessage] = useState("");
  const [appealSent, setAppealSent] = useState(false);

  // Init
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    getMyStatus().then(setUserStatus);
  }, []);

  // Load profiles
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("profiles").select("user_id, name, is_online");
      if (data) {
        const map: Record<string, PostProfile> = {};
        data.forEach(p => { map[p.user_id] = p as PostProfile; });
        setProfiles(map);
      }
    };
    load();
  }, []);

  // Load posts
  const loadPosts = useCallback(async () => {
    if (!currentUserId) return;

    const { data: postsData } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!postsData) return;

    // Get likes counts
    const postIds = postsData.map(p => p.id);
    const { data: likesData } = await supabase
      .from("post_likes")
      .select("post_id, user_id, reaction_type")
      .in("post_id", postIds);

    // Get comments counts
    const { data: commentsData } = await supabase
      .from("post_comments")
      .select("post_id")
      .in("post_id", postIds);

    // Get user interests for sorting
    const { data: interests } = await supabase
      .from("user_interests")
      .select("category, score")
      .eq("user_id", currentUserId);

    const interestMap: Record<string, number> = {};
    interests?.forEach(i => { interestMap[i.category] = i.score; });

    const enriched: Post[] = postsData.map(p => {
      const postLikes = likesData?.filter(l => l.post_id === p.id) || [];
      const postComments = commentsData?.filter(c => c.post_id === p.id) || [];
      const myReaction = postLikes.find(l => l.user_id === currentUserId);
      return {
        ...p,
        category: p.category || "general",
        profile: profiles[p.user_id],
        likes_count: postLikes.length,
        comments_count: postComments.length,
        liked_by_me: !!myReaction,
        my_reaction: myReaction?.reaction_type || null,
        reactions: postLikes.map(l => ({ user_id: l.user_id, reaction_type: l.reaction_type || 'like' })),
      };
    });

    // Enhanced Algorithm: interest score + engagement + recency + diversity
    enriched.sort((a, b) => {
      const aInterest = interestMap[a.category] || 0;
      const bInterest = interestMap[b.category] || 0;
      
      // Engagement score (weighted: comments > likes)
      const aEngagement = a.likes_count * 2 + a.comments_count * 4;
      const bEngagement = b.likes_count * 2 + b.comments_count * 4;
      
      // Recency decay (exponential)
      const aAge = (Date.now() - new Date(a.created_at).getTime()) / 3600000;
      const bAge = (Date.now() - new Date(b.created_at).getTime()) / 3600000;
      const aDecay = Math.exp(-aAge * 0.08);
      const bDecay = Math.exp(-bAge * 0.08);
      
      // Engagement velocity (engagement per hour)
      const aVelocity = aAge > 0 ? aEngagement / Math.max(aAge, 0.5) : aEngagement * 2;
      const bVelocity = bAge > 0 ? bEngagement / Math.max(bAge, 0.5) : bEngagement * 2;
      
      // Boost for posts by others (not own posts)
      const aOtherBoost = a.user_id !== currentUserId ? 1.2 : 1;
      const bOtherBoost = b.user_id !== currentUserId ? 1.2 : 1;
      
      const aScore = ((aInterest * 15) + aEngagement + (aVelocity * 3)) * aDecay * aOtherBoost;
      const bScore = ((bInterest * 15) + bEngagement + (bVelocity * 3)) * bDecay * bOtherBoost;
      return bScore - aScore;
    });

    setPosts(enriched);
  }, [currentUserId, profiles]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Realtime
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => loadPosts())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, (payload) => {
        loadPosts();
        if (payload.eventType === "INSERT") {
          const c = payload.new as any;
          if (expandedComments.has(c.post_id)) {
            loadComments(c.post_id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, loadPosts, expandedComments]);

  // View-time tracking with IntersectionObserver
  useEffect(() => {
    if (!currentUserId) return;
    
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const postId = entry.target.getAttribute("data-post-id");
        if (!postId) return;
        
        if (entry.isIntersecting) {
          viewTimers.current[postId] = Date.now();
        } else if (viewTimers.current[postId]) {
          const viewTime = (Date.now() - viewTimers.current[postId]) / 1000;
          delete viewTimers.current[postId];
          
          if (viewTime >= 3) {
            const post = posts.find(p => p.id === postId);
            if (post) {
              const boost = Math.min(Math.floor(viewTime / 3), 3);
              for (let i = 0; i < boost; i++) trackInterest(post.category);
            }
          }
        }
      });
    }, { threshold: 0.5 });
    
    document.querySelectorAll("[data-post-id]").forEach(el => {
      observerRef.current?.observe(el);
    });
    
    return () => { observerRef.current?.disconnect(); };
  }, [currentUserId, posts]);
  // Track interest
  const trackInterest = async (category: string) => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from("user_interests")
      .select("score")
      .eq("user_id", currentUserId)
      .eq("category", category)
      .single();

    if (data) {
      await supabase
        .from("user_interests")
        .update({ score: data.score + 1, updated_at: new Date().toISOString() })
        .eq("user_id", currentUserId)
        .eq("category", category);
    } else {
      await supabase
        .from("user_interests")
        .insert({ user_id: currentUserId, category, score: 1 });
    }
  };

  // Create post
  const createPost = async () => {
    if (!newPostContent.trim() || !currentUserId) return;
    setPosting(true);
    const autoCategory = detectCategory(newPostContent);
    await supabase.from("posts").insert({
      user_id: currentUserId,
      content: newPostContent.trim(),
      category: autoCategory,
    });
    trackInterest(autoCategory);
    setNewPostContent("");
    setPosting(false);
  };

  // React to post
  const reactToPost = async (post: Post, reactionType: string) => {
    setShowReactionPicker(null);
    if (post.my_reaction === reactionType) {
      // Remove reaction
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else if (post.liked_by_me) {
      // Change reaction
      await supabase.from("post_likes").update({ reaction_type: reactionType } as any).eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      // New reaction
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId, reaction_type: reactionType } as any);
      trackInterest(post.category);
    }
  };

  // Load comments
  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!data) return;

    // Get comment likes
    const commentIds = data.map(c => c.id);
    const { data: cLikes } = await supabase
      .from("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);

    const enriched: Comment[] = data.map(c => ({
      ...c,
      profile: profiles[c.user_id],
      likes_count: cLikes?.filter(l => l.comment_id === c.id).length || 0,
      liked_by_me: cLikes?.some(l => l.comment_id === c.id && l.user_id === currentUserId) || false,
    }));

    // Nest replies
    const topLevel = enriched.filter(c => !c.parent_id);
    const replies = enriched.filter(c => c.parent_id);
    topLevel.forEach(c => {
      c.replies = replies.filter(r => r.parent_id === c.id);
    });

    setComments(prev => ({ ...prev, [postId]: topLevel }));
  };

  // Toggle comments
  const toggleComments = (postId: string) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
      loadComments(postId);
    }
    setExpandedComments(next);
  };

  // Add comment
  const addComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text || !currentUserId) return;
    await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: currentUserId,
      content: text,
    });
    setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    trackInterest(posts.find(p => p.id === postId)?.category || "general");
  };

  // Add reply
  const addReply = async () => {
    if (!replyInput.trim() || !replyingTo || !currentUserId) return;
    await supabase.from("post_comments").insert({
      post_id: replyingTo.postId,
      user_id: currentUserId,
      content: replyInput.trim(),
      parent_id: replyingTo.commentId,
    });
    setReplyInput("");
    setReplyingTo(null);
  };

  // Like comment
  const toggleCommentLike = async (comment: Comment) => {
    if (comment.liked_by_me) {
      await supabase.from("comment_likes").delete().eq("comment_id", comment.id).eq("user_id", currentUserId);
    } else {
      await supabase.from("comment_likes").insert({ comment_id: comment.id, user_id: currentUserId });
    }
    loadComments(comment.post_id);
  };

  // Delete post
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const deletePost = async (postId: string) => {
    await supabase.from("posts").delete().eq("id", postId);
    setDeletePostId(null);
  };

  const displayPosts = posts;

  const timeAgo = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: bn });
    } catch {
      return "";
    }
  };

  return (
    <div className="bg-background min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border p-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:border-primary transition text-lg shrink-0">←</button>
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow text-base shrink-0">📰</div>
          <h1 className="text-lg font-black text-foreground flex-1 truncate">নিউজফিড</h1>
          <button onClick={() => navigate("/chat")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:border-primary transition text-sm shrink-0">💬</button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto w-full flex-1 pb-6 px-3 overflow-x-hidden">
        {/* Blocked user screen */}
        {userStatus.status === "blocked" ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-xl font-black text-destructive mb-2">আপনার অ্যাকাউন্ট ব্লক করা হয়েছে</h2>
            {userStatus.suspend_reason && (
              <p className="text-sm text-muted-foreground bg-destructive/10 rounded-xl p-3 mb-4 max-w-sm text-center">
                <span className="font-bold">কারণ:</span> {userStatus.suspend_reason}
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-4">আপনি নিউজফিড দেখতে বা পোস্ট করতে পারবেন না।</p>
            {!appealSent ? (
              <div className="w-full max-w-sm space-y-3">
                <textarea
                  value={appealMessage}
                  onChange={e => setAppealMessage(e.target.value)}
                  placeholder="আনব্লকের জন্য আবেদন লিখুন..."
                  className="w-full p-3 bg-secondary rounded-2xl outline-none border border-border focus:border-primary transition text-foreground text-sm resize-none h-24"
                />
                <button
                  onClick={async () => {
                    if (!appealMessage.trim() || !currentUserId) return;
                    await supabase.from('appeals' as any).insert({ user_id: currentUserId, appeal_type: 'unblock', message: appealMessage.trim() });
                    setAppealSent(true);
                  }}
                  disabled={!appealMessage.trim()}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-bold hover:opacity-90 transition disabled:opacity-50"
                >
                  📩 আবেদন পাঠান
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-bold text-emerald-600">আবেদন পাঠানো হয়েছে!</p>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Create Post - hidden for suspended */}
        {userStatus.status === "suspended" ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl mt-3 mb-3 p-4 text-center">
            <p className="text-sm font-bold text-amber-600">⚠️ আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে। আপনি পোস্ট করতে পারবেন না।</p>
            {userStatus.suspend_reason && <p className="text-xs text-muted-foreground mt-1">কারণ: {userStatus.suspend_reason}</p>}
          </div>
        ) : (
        <div className="bg-card border border-border rounded-2xl mt-3 mb-3 shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 p-3 sm:p-4">
            <Avatar className="w-9 h-9 shrink-0 mt-0.5">
              <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                {profiles[currentUserId]?.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <textarea
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              placeholder="আপনার মনে কী আছে...?"
              className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[60px] pt-1.5"
              rows={2}
            />
          </div>
          {newPostContent.trim() && (
            <div className="px-3 pb-1">
              <span className="text-[10px] text-muted-foreground bg-secondary/60 rounded-full px-2 py-0.5 font-bold">
                {(() => {
                  const cat = detectCategory(newPostContent);
                  const info = CATEGORIES.find(c => c.value === cat);
                  return info ? `${info.emoji} ${info.label}` : "📝 সাধারণ";
                })()}
              </span>
            </div>
          )}
          <div className="border-t border-border px-3 py-2 flex justify-end">
            <button
              onClick={createPost}
              disabled={!newPostContent.trim() || posting}
              className="bg-primary text-primary-foreground px-5 py-1.5 rounded-full text-xs font-black hover:opacity-90 transition active:scale-95 disabled:opacity-50"
            >
              {posting ? "..." : "পোস্ট করুন"}
            </button>
          </div>
        </div>
        )}

        {/* Posts */}
        {displayPosts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-muted-foreground font-bold">কোনো পোস্ট নেই</p>
            <p className="text-muted-foreground text-sm mt-1">প্রথম পোস্ট করুন!</p>
          </div>
        )}

        <div className="space-y-3">
          {displayPosts.map(post => {
            const profile = profiles[post.user_id];
            const isMyPost = post.user_id === currentUserId;
            const catInfo = CATEGORIES.find(c => c.value === post.category);

            return (
              <div key={post.id} data-post-id={post.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden max-w-full">
                {/* Post Header */}
                <div className="flex items-center gap-3 p-4 pb-2">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                      {profile?.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-foreground truncate">{profile?.name || "অজানা"}</p>
                      {profile?.is_online && <span className="w-2 h-2 bg-green-500 rounded-full shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] text-muted-foreground">{timeAgo(post.created_at)}</p>
                      {catInfo && <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded-full text-muted-foreground font-bold">{catInfo.emoji} {catInfo.label}</span>}
                    </div>
                  </div>
                  {isMyPost && (
                    <button
                      onClick={() => setDeletePostId(post.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition text-sm"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {/* Post Content */}
                <div className="px-3 sm:px-4 pb-3">
                  <p className="text-sm text-foreground font-semibold whitespace-pre-wrap break-words leading-relaxed overflow-hidden">{post.content}</p>
                </div>

                {/* Reaction Stats */}
                {(post.likes_count > 0 || post.comments_count > 0) && (
                  <div className="px-4 pb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {post.likes_count > 0 && (
                        <button onClick={() => setShowReactedBy(showReactedBy === post.id ? null : post.id)} className="flex items-center gap-1 hover:underline transition">
                          {/* Show unique reaction emojis */}
                          {(() => {
                            const types = [...new Set(post.reactions.map(r => r.reaction_type))];
                            return types.slice(0, 3).map(t => {
                              const r = REACTIONS.find(rx => rx.type === t);
                              return <span key={t} className="text-sm -mr-1">{r?.emoji || "👍"}</span>;
                            });
                          })()}
                          <span className="ml-1.5">{post.likes_count}</span>
                        </button>
                      )}
                    </div>
                    {post.comments_count > 0 && (
                      <button onClick={() => toggleComments(post.id)} className="hover:text-primary transition">
                        💬 {post.comments_count}টি মন্তব্য
                      </button>
                    )}
                  </div>
                )}

                {/* Who Reacted Popup */}
                {showReactedBy === post.id && post.reactions.length > 0 && (
                  <div className="px-4 pb-3">
                    <div className="bg-secondary border border-border rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-foreground">রিয়্যাক্ট করেছেন</span>
                        <button onClick={() => setShowReactedBy(null)} className="text-muted-foreground text-xs hover:text-destructive">✕</button>
                      </div>
                      {REACTIONS.map(reaction => {
                        const users = post.reactions.filter(r => r.reaction_type === reaction.type);
                        if (users.length === 0) return null;
                        return (
                          <div key={reaction.type} className="flex items-center gap-2">
                            <span className="text-base">{reaction.emoji}</span>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {users.map(u => (
                                <span key={u.user_id} className="text-[10px] bg-card border border-border rounded-full px-2 py-0.5 font-bold text-foreground">
                                  {profiles[u.user_id]?.name || "অজানা"}
                                </span>
                              ))}
                            </div>
                            <span className="text-[10px] text-muted-foreground font-bold">{users.length}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-border flex relative">
                  <div className="flex-1 relative">
                    {/* Reaction Picker */}
                    {showReactionPicker === post.id && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-2xl shadow-lg px-2 py-1.5 flex gap-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                        {REACTIONS.map(r => (
                          <button
                            key={r.type}
                            onClick={() => reactToPost(post, r.type)}
                            className="text-2xl hover:scale-125 transition-transform active:scale-95 p-1"
                            title={r.label}
                          >
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => post.liked_by_me ? reactToPost(post, post.my_reaction!) : setShowReactionPicker(showReactionPicker === post.id ? null : post.id)}
                      onMouseEnter={() => !post.liked_by_me && setShowReactionPicker(post.id)}
                      onMouseLeave={() => setTimeout(() => setShowReactionPicker(prev => prev === post.id ? null : prev), 800)}
                      className={`w-full py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 transition hover:bg-secondary/50 ${
                        post.liked_by_me ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {post.liked_by_me
                        ? <>{REACTIONS.find(r => r.type === post.my_reaction)?.emoji || "👍"} {REACTIONS.find(r => r.type === post.my_reaction)?.label || "লাইক"}</>
                        : <>👍 লাইক</>
                      }
                    </button>
                  </div>
                  <button
                    onClick={() => toggleComments(post.id)}
                    className="flex-1 py-2.5 text-sm font-bold text-muted-foreground flex items-center justify-center gap-1.5 transition hover:bg-secondary/50 border-l border-border"
                  >
                    💬 মন্তব্য
                  </button>
                </div>

                {/* Comments Section */}
                {expandedComments.has(post.id) && (
                  <div className="border-t border-border bg-secondary/20">
                    {/* Comment list */}
                    <div className="max-h-80 overflow-y-auto px-4 py-3 space-y-3">
                      {(!comments[post.id] || comments[post.id].length === 0) && (
                        <p className="text-center text-muted-foreground text-xs py-2">কোনো মন্তব্য নেই</p>
                      )}
                      {comments[post.id]?.map(comment => (
                        <div key={comment.id}>
                          {/* Comment */}
                          <div className="flex gap-2">
                            <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                              <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px]">
                                {profiles[comment.user_id]?.name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="bg-card border border-border rounded-xl px-3 py-2">
                                <p className="text-[11px] font-black text-foreground">{profiles[comment.user_id]?.name || "অজানা"}</p>
                                <p className="text-xs text-foreground font-semibold mt-0.5 break-words">{comment.content}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-1 px-1">
                                <span className="text-[10px] text-muted-foreground">{timeAgo(comment.created_at)}</span>
                                <button
                                  onClick={() => toggleCommentLike(comment)}
                                  className={`text-[10px] font-bold transition ${comment.liked_by_me ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
                                >
                                  {comment.liked_by_me ? "❤️" : "লাইক"} {comment.likes_count > 0 && `(${comment.likes_count})`}
                                </button>
                                <button
                                  onClick={() => {
                                    setReplyingTo({ commentId: comment.id, postId: post.id, name: profiles[comment.user_id]?.name || "অজানা" });
                                    setTimeout(() => replyInputRef.current?.focus(), 100);
                                  }}
                                  className="text-[10px] font-bold text-muted-foreground hover:text-primary transition"
                                >
                                  রিপ্লাই
                                </button>
                              </div>

                              {/* Replies */}
                              {comment.replies && comment.replies.length > 0 && (
                                <div className="mt-2 ml-2 space-y-2 border-l-2 border-border pl-2">
                                  {comment.replies.map(reply => (
                                    <div key={reply.id} className="flex gap-2">
                                      <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                                        <AvatarFallback className="bg-primary/10 text-primary font-black text-[9px]">
                                          {profiles[reply.user_id]?.name?.charAt(0) || "?"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <div className="bg-card border border-border rounded-lg px-2.5 py-1.5">
                                          <p className="text-[10px] font-black text-foreground">{profiles[reply.user_id]?.name || "অজানা"}</p>
                                          <p className="text-[11px] text-foreground font-semibold break-words">{reply.content}</p>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 px-1">
                                          <span className="text-[9px] text-muted-foreground">{timeAgo(reply.created_at)}</span>
                                          <button
                                            onClick={() => toggleCommentLike(reply)}
                                            className={`text-[9px] font-bold transition ${reply.liked_by_me ? "text-red-500" : "text-muted-foreground hover:text-red-500"}`}
                                          >
                                            {reply.liked_by_me ? "❤️" : "লাইক"} {reply.likes_count > 0 && `(${reply.likes_count})`}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Reply indicator */}
                    {replyingTo && replyingTo.postId === post.id && (
                      <div className="px-4 py-1 bg-primary/5 border-t border-border flex items-center gap-2">
                        <span className="text-[10px] text-primary font-bold">↩ {replyingTo.name} কে রিপ্লাই</span>
                        <button onClick={() => setReplyingTo(null)} className="text-muted-foreground text-xs hover:text-destructive">✕</button>
                      </div>
                    )}

                    {/* Comment/Reply input */}
                    <div className="px-4 py-3 border-t border-border flex gap-2">
                      {replyingTo && replyingTo.postId === post.id ? (
                        <>
                          <input
                            ref={replyInputRef}
                            value={replyInput}
                            onChange={e => setReplyInput(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addReply()}
                            placeholder={`${replyingTo.name} কে রিপ্লাই...`}
                            className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-xs font-bold text-foreground outline-none focus:border-primary transition"
                          />
                          <button onClick={addReply} disabled={!replyInput.trim()} className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 transition">↩</button>
                        </>
                      ) : (
                        <>
                          <input
                            value={commentInputs[post.id] || ""}
                            onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && addComment(post.id)}
                            placeholder="মন্তব্য লিখুন..."
                            className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-xs font-bold text-foreground outline-none focus:border-primary transition"
                          />
                          <button onClick={() => addComment(post.id)} disabled={!commentInputs[post.id]?.trim()} className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50 transition">→</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
      <DeleteConfirmDialog
        open={deletePostId !== null}
        onOpenChange={(open) => !open && setDeletePostId(null)}
        onConfirm={() => { if (deletePostId) deletePost(deletePostId); }}
        title="পোস্ট ডিলেট করবেন?"
        description="এই পোস্টটি স্থায়ীভাবে মুছে ফেলা হবে।"
      />
    </div>
  );
};

export default FeedPage;
