import { useState, useEffect, useCallback, useRef } from "react";
import DeleteConfirmDialog from "@/components/dashboard/DeleteConfirmDialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";
import { getMyStatus } from "@/lib/adminStore";
import { BadgeCheck, Settings, ImagePlus, X, Loader2 } from "lucide-react";
import UserProfileDialog from "@/components/chat/UserProfileDialog";
import FeedNotifications from "@/components/feed/FeedNotifications";
import FriendList from "@/components/feed/FriendList";
import FeedSettingsModal from "@/components/feed/FeedSettingsModal";
import LinkPreview from "@/components/feed/LinkPreview";
// StoriesBar ইমপোর্ট বাদ দেওয়া হয়েছে
import { loadSpamWords, checkSpam, recordViolation, isSpamBanned } from "@/lib/spamChecker";
import { compressImage } from "@/lib/imageCompress";
import { useFeatureSettings } from "@/hooks/useFeatureSettings";
import { toast } from "sonner";

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
  image_url?: string | null;
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
  image_url?: string | null;
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

const detectCategory = (content: string): string => {
  const lower = content.toLowerCase();
  const keywords: Record<string, string[]> = {
    tech: ["কোড", "প্রোগ্রামিং", "সফটওয়্যার", "টেক", "code", "programming", "react", "javascript"],
    islamic: ["আল্লাহ", "নামাজ", "কুরআন", "হাদিস", "ইসলাম"],
    health: ["স্বাস্থ্য", "ব্যায়াম", "ডাক্তার"],
    education: ["পড়াশোনা", "পরীক্ষা", "শিক্ষা"],
    funny: ["হাহা", "মজা", "😂", "🤣"],
    news: ["খবর", "সংবাদ"],
    life: ["জীবন", "ভালোবাসা", "পরিবার"],
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
  const { settings: featureSettings } = useFeatureSettings();
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
  const [userStatus, setUserStatus] = useState<{ status: string; suspend_reason: string | null }>({ status: "active", suspend_reason: null });
  const [appealMessage, setAppealMessage] = useState("");
  const [appealSent, setAppealSent] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [spamWords, setSpamWords] = useState<string[]>([]);
  const [spamBanStatus, setSpamBanStatus] = useState<{ banned: boolean; permanent: boolean; banUntil: string | null }>({ banned: false, permanent: false, banUntil: null });
  
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [commentImages, setCommentImages] = useState<Record<string, File | null>>({});
  const [commentImagePreviews, setCommentImagePreviews] = useState<Record<string, string | null>>({});

  // Report System States (সংরক্ষিত)
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [reportPostId, setReportPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportMenuPostId, setReportMenuPostId] = useState<string | null>(null);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [showMyReports, setShowMyReports] = useState(false);
  const [replyToReportId, setReplyToReportId] = useState<string | null>(null);
  const [reportReplyText, setReportReplyText] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        isSpamBanned(user.id).then(setSpamBanStatus);
      }
    });
    getMyStatus().then(setUserStatus);
    loadSpamWords().then(setSpamWords);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const loadUnread = async () => {
      const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("receiver_id", currentUserId).eq("read", false);
      setUnreadMsgCount(count || 0);
    };
    loadUnread();
    const channel = supabase.channel("feed-msg-unread").on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${currentUserId}` }, () => loadUnread()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("profiles").select("user_id, name, is_online, is_verified, avatar_url");
      if (data) {
        const map: Record<string, PostProfile> = {};
        data.forEach(p => { map[p.user_id] = p as PostProfile; });
        setProfiles(map);
      }
    };
    load();
  }, []);

  const loadPosts = useCallback(async () => {
    if (!currentUserId) return;
    const { data: postsData } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
    if (!postsData) return;
    const postIds = postsData.map(p => p.id);
    const { data: likesData } = await supabase.from("post_likes").select("post_id, user_id, reaction_type").in("post_id", postIds);
    const { data: commentsData } = await supabase.from("post_comments").select("post_id").in("post_id", postIds);

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
    setPosts(enriched);
  }, [currentUserId, profiles]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    try {
      const compressed = await compressImage(file);
      const fileName = `${currentUserId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("media").upload(`${folder}/${fileName}`, compressed, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(`${folder}/${fileName}`);
      return data.publicUrl;
    } catch {
      toast.error("ছবি আপলোড ব্যর্থ!");
      return null;
    }
  };

  const createPost = async () => {
    if ((!newPostContent.trim() && !postImage) || !currentUserId || posting) return;
    if (spamBanStatus.banned) {
      toast.error("আপনার পোস্ট করার অধিকার বন্ধ।");
      return;
    }
    setPosting(true);
    let imageUrl: string | null = null;
    if (postImage) {
      imageUrl = await uploadImage(postImage, "posts");
    }
    const { data: newPost, error } = await supabase.from("posts").insert({
      user_id: currentUserId,
      content: newPostContent.trim() || "📷",
      category: detectCategory(newPostContent),
      image_url: imageUrl,
    }).select().single();
    
    if (error) {
      toast.error("পোস্ট তৈরিতে সমস্যা হয়েছে!");
    } else {
      loadPosts();
      setNewPostContent("");
      setPostImage(null);
      setPostImagePreview(null);
      toast.success("পোস্ট সফলভাবে তৈরি হয়েছে!");
    }
    setPosting(false);
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase.from("post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    if (data) {
      const { data: cLikes } = await supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", data.map(c => c.id));
      const enriched: Comment[] = data.map(c => ({
        ...c,
        profile: profiles[c.user_id],
        likes_count: cLikes?.filter(l => l.comment_id === c.id).length || 0,
        liked_by_me: cLikes?.some(l => l.comment_id === c.id && l.user_id === currentUserId) || false,
      }));
      setComments(prev => ({ ...prev, [postId]: enriched }));
    }
  };

  const toggleComments = (postId: string) => {
    const next = new Set(expandedComments);
    if (next.has(postId)) { next.delete(postId); } 
    else { next.add(postId); loadComments(postId); }
    setExpandedComments(next);
  };

  const addComment = async (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text && !commentImages[postId]) return;
    let imageUrl: string | null = null;
    if (commentImages[postId]) imageUrl = await uploadImage(commentImages[postId]!, "comments");
    
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: currentUserId,
      content: text || "📷",
      image_url: imageUrl
    });

    if (!error) {
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
      setCommentImagePreviews(prev => ({ ...prev, [postId]: null }));
      loadComments(postId);
      loadPosts();
    }
  };

  const reactToPost = async (post: Post, reactionType: string) => {
    if (post.my_reaction === reactionType) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else if (post.liked_by_me) {
      await supabase.from("post_likes").update({ reaction_type: reactionType } as any).eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId, reaction_type: reactionType } as any);
    }
    loadPosts();
  };

  const deletePost = async (postId: string) => {
    await supabase.from("posts").delete().eq("id", postId);
    setDeletePostId(null);
    loadPosts();
  };

  const submitReport = async () => {
    if (!reportPostId || !reportReason.trim()) return;
    setReportSending(true);
    await supabase.from("reports").insert({
      reporter_id: currentUserId,
      reason: reportReason.trim(),
      post_id: reportPostId,
    } as any);
    toast.success("রিপোর্ট জমা হয়েছে!");
    setReportPostId(null);
    setReportReason("");
    setReportSending(false);
  };

  return (
    <div className="bg-background min-h-screen flex flex-col overflow-x-hidden">
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border p-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <button onClick={() => navigate("/dashboard")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border shrink-0">←</button>
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground text-base shrink-0">📰</div>
          <h1 className="text-[15px] sm:text-lg font-black text-foreground flex-1 truncate">নিউজফিড</h1>
          <button onClick={() => setSettingsOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary"><Settings size={18} /></button>
          <FriendList currentUserId={currentUserId} profiles={profiles} onSelectUser={(uid) => { setProfileUserId(uid); setProfileOpen(true); }} />
          <FeedNotifications currentUserId={currentUserId} profiles={profiles} />
          <button onClick={() => navigate("/chat")} className="relative w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border shrink-0">
            💬 {unreadMsgCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white text-[10px] rounded-full flex items-center justify-center">{unreadMsgCount}</span>}
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto w-full flex-1 pb-6 px-3">
        {/* Stories - পুরোপুরি সরিয়ে দেওয়া হয়েছে */}

        <div className="bg-card border border-border rounded-2xl mt-3 mb-3 shadow-sm overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <Avatar className="w-9 h-9 shrink-0"><AvatarFallback>{profiles[currentUserId]?.name?.charAt(0)}</AvatarFallback></Avatar>
            <textarea
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              placeholder="আপনার মনে কী আছে...?"
              className="flex-1 bg-transparent text-sm font-semibold outline-none resize-none min-h-[60px]"
            />
          </div>
          {postImagePreview && (
            <div className="px-3 pb-2 relative">
              <img src={postImagePreview} className="w-full max-h-60 object-cover rounded-xl border border-border" alt="Preview" />
              <button onClick={() => { setPostImage(null); setPostImagePreview(null); }} className="absolute top-2 right-5 bg-black/50 text-white rounded-full p-1"><X size={14} /></button>
            </div>
          )}
          <div className="border-t border-border px-3 py-2 flex items-center justify-between">
            <label className="cursor-pointer text-primary hover:bg-secondary p-2 rounded-full transition">
              <ImagePlus size={20} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setPostImage(file); setPostImagePreview(URL.createObjectURL(file)); }
              }} />
            </label>
            <button
              onClick={createPost}
              disabled={(!newPostContent.trim() && !postImage) || posting}
              className="bg-primary text-primary-foreground px-5 py-1.5 rounded-full text-xs font-black disabled:opacity-50 flex items-center gap-1"
            >
              {posting && <Loader2 size={12} className="animate-spin" />}
              {posting ? "পোস্ট হচ্ছে..." : "পোস্ট করুন"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {posts.map(post => {
            const profile = profiles[post.user_id];
            return (
              <div key={post.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4 pb-2">
                  <Avatar className="w-10 h-10 cursor-pointer" onClick={() => { setProfileUserId(post.user_id); setProfileOpen(true); }}><AvatarFallback>{profile?.name?.charAt(0)}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-sm">{profile?.name || "User"}</p>
                      {profile?.is_verified && <BadgeCheck size={14} className="text-blue-500" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: bn })}</p>
                  </div>
                  <div className="relative">
                    <button onClick={() => setReportMenuPostId(reportMenuPostId === post.id ? null : post.id)} className="text-muted-foreground p-1">⋮</button>
                    {reportMenuPostId === post.id && (
                      <div className="absolute right-0 top-full bg-card border border-border rounded-xl shadow-lg z-50 py-1 min-w-[120px]">
                        {post.user_id === currentUserId ? (
                          <button onClick={() => setDeletePostId(post.id)} className="w-full px-4 py-2 text-left text-xs font-bold text-destructive hover:bg-destructive/10">🗑️ মুছুন</button>
                        ) : (
                          <button onClick={() => setReportPostId(post.id)} className="w-full px-4 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-100">🚩 রিপোর্ট</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-4 pb-3">
                  <p className="text-sm font-semibold whitespace-pre-wrap">{post.content !== "📷" && post.content}</p>
                  <LinkPreview content={post.content} />
                </div>

                {/* ✅ Post Image Fix */}
                {post.image_url && (
                  <div className="w-full bg-secondary/10">
                    <img src={post.image_url} alt="Post" className="w-full h-auto max-h-[500px] object-contain" loading="lazy" />
                  </div>
                )}

                <div className="border-t border-border flex">
                  <button onClick={() => reactToPost(post, 'like')} className={`flex-1 py-3 text-xs font-bold ${post.liked_by_me ? 'text-primary' : 'text-muted-foreground'}`}>
                    {post.liked_by_me ? (REACTIONS.find(r => r.type === post.my_reaction)?.emoji || "👍") : "👍"} লাইক ({post.likes_count})
                  </button>
                  <button onClick={() => toggleComments(post.id)} className="flex-1 py-3 text-xs font-bold text-muted-foreground border-l border-border">💬 মন্তব্য ({post.comments_count})</button>
                </div>

                {expandedComments.has(post.id) && (
                  <div className="bg-secondary/10 p-4 border-t border-border">
                    <div className="space-y-3 mb-3 max-h-60 overflow-y-auto">
                      {comments[post.id]?.map(comment => (
                        <div key={comment.id} className="flex gap-2">
                          <Avatar className="w-7 h-7"><AvatarFallback>{comment.profile?.name?.charAt(0)}</AvatarFallback></Avatar>
                          <div className="flex-1 bg-card border border-border rounded-xl px-3 py-2">
                            <p className="text-[10px] font-black">{comment.profile?.name}</p>
                            <p className="text-xs">{comment.content}</p>
                            {comment.image_url && <img src={comment.image_url} className="mt-1 rounded-lg max-h-40" alt="comment" />}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={commentInputs[post.id] || ""}
                        onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="মন্তব্য লিখুন..."
                        className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-xs outline-none"
                        onKeyDown={e => e.key === "Enter" && addComment(post.id)}
                      />
                      <button onClick={() => addComment(post.id)} className="bg-primary text-white px-4 rounded-xl text-xs">→</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals & Dialogs (সংরক্ষিত) */}
      <DeleteConfirmDialog open={deletePostId !== null} onOpenChange={() => setDeletePostId(null)} onConfirm={() => deletePost(deletePostId!)} />
      <UserProfileDialog userId={profileUserId} open={profileOpen} onOpenChange={setProfileOpen} />
      <FeedSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} currentUserId={currentUserId} profiles={profiles} />
      
      {reportPostId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-black mb-4">🚩 রিপোর্ট করুন</h3>
            <textarea value={reportReason} onChange={e => setReportReason(e.target.value)} placeholder="কারণ লিখুন..." className="w-full p-3 rounded-xl bg-secondary border border-border h-24 mb-4 text-sm" />
            <div className="flex gap-2">
              <button onClick={() => setReportPostId(null)} className="flex-1 py-2 bg-secondary rounded-xl font-bold">বাতিল</button>
              <button onClick={submitReport} disabled={!reportReason.trim() || reportSending} className="flex-1 py-2 bg-destructive text-white rounded-xl font-bold">পাঠান</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedPage;
