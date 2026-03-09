import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { compressImage } from "@/lib/imageCompress";
import { toast } from "sonner";
import { Plus, X, Eye } from "lucide-react";

interface Story {
  id: string;
  user_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  expires_at: string;
  views_count?: number;
}

interface StoryGroup {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  stories: Story[];
  viewed: boolean;
}

interface Props {
  currentUserId: string;
  profiles: Record<string, { name: string; user_id: string; avatar_url?: string | null }>;
}

const StoriesBar = ({ currentUserId, profiles }: Props) => {
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const [progress, setProgress] = useState(0);

  const loadStories = async () => {
    if (!currentUserId) return;
    const { data: stories } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!stories) return;

    // Get views for my stories
    const myStoryIds = stories.filter(s => s.user_id === currentUserId).map(s => s.id);
    let viewsMap: Record<string, number> = {};
    if (myStoryIds.length > 0) {
      const { data: views } = await supabase
        .from("story_views")
        .select("story_id")
        .in("story_id", myStoryIds);
      if (views) {
        views.forEach((v: any) => {
          viewsMap[v.story_id] = (viewsMap[v.story_id] || 0) + 1;
        });
      }
    }

    // Get which stories I've viewed
    const allIds = stories.map(s => s.id);
    const { data: myViews } = await supabase
      .from("story_views")
      .select("story_id")
      .eq("viewer_id", currentUserId)
      .in("story_id", allIds);
    const viewedSet = new Set(myViews?.map((v: any) => v.story_id) || []);

    // Group by user
    const grouped: Record<string, StoryGroup> = {};
    stories.forEach((s: any) => {
      if (!grouped[s.user_id]) {
        const p = profiles[s.user_id];
        grouped[s.user_id] = {
          user_id: s.user_id,
          name: p?.name || "অজানা",
          avatar_url: p?.avatar_url,
          stories: [],
          viewed: true,
        };
      }
      grouped[s.user_id].stories.push({ ...s, views_count: viewsMap[s.id] || 0 });
      if (!viewedSet.has(s.id) && s.user_id !== currentUserId) {
        grouped[s.user_id].viewed = false;
      }
    });

    // Sort: my story first, then unviewed, then viewed
    const groups = Object.values(grouped);
    groups.sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      if (!a.viewed && b.viewed) return -1;
      if (a.viewed && !b.viewed) return 1;
      return 0;
    });

    setStoryGroups(groups);
  };

  useEffect(() => { loadStories(); }, [currentUserId, profiles]);

  const uploadStory = async () => {
    if (!selectedFile || !currentUserId) return;
    setUploading(true);
    try {
      const compressed = await compressImage(selectedFile);
      const path = `stories/${currentUserId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("media").upload(path, compressed, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      await supabase.from("stories").insert({
        user_id: currentUserId,
        image_url: urlData.publicUrl,
        caption: caption.trim(),
      });
      toast.success("স্টোরি আপলোড হয়েছে!");
      setShowUpload(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption("");
      loadStories();
    } catch (e: any) {
      toast.error("স্টোরি আপলোড ব্যর্থ!");
    }
    setUploading(false);
  };

  const viewStory = async (group: StoryGroup) => {
    setViewingGroup(group);
    setCurrentStoryIdx(0);
    setProgress(0);
    // Mark as viewed
    if (group.user_id !== currentUserId) {
      for (const s of group.stories) {
        await supabase.from("story_views").insert({ story_id: s.id, viewer_id: currentUserId }).select();
      }
    }
  };

  // Auto-advance stories
  useEffect(() => {
    if (!viewingGroup) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          setCurrentStoryIdx(idx => {
            if (idx + 1 >= viewingGroup.stories.length) {
              setViewingGroup(null);
              return 0;
            }
            return idx + 1;
          });
          return 0;
        }
        return prev + 2;
      });
    }, 100);
    progressRef.current = interval;
    return () => clearInterval(interval);
  }, [viewingGroup, currentStoryIdx]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("ফাইল 10MB এর বেশি!"); return; }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setShowUpload(true);
  };

  const deleteMyStory = async (storyId: string) => {
    await supabase.from("stories").delete().eq("id", storyId);
    toast.success("স্টোরি ডিলেট হয়েছে");
    setViewingGroup(null);
    loadStories();
  };

  const myGroup = storyGroups.find(g => g.user_id === currentUserId);

  return (
    <>
      {/* Stories Bar */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar py-3 px-1">
        {/* Add Story */}
        <button className="flex flex-col items-center gap-1 min-w-[68px] shrink-0 relative">
          <label className="cursor-pointer">
            <div className={`w-16 h-16 rounded-full border-2 ${myGroup ? 'border-primary' : 'border-dashed border-border'} flex items-center justify-center bg-secondary relative overflow-hidden`}>
              {myGroup ? (
                <img
                  src={myGroup.stories[0].image_url}
                  alt=""
                  className="w-full h-full object-cover rounded-full"
                  onClick={(e) => { e.preventDefault(); viewStory(myGroup); }}
                />
              ) : (
                <Plus size={22} className="text-primary" />
              )}
              <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-card">
                <Plus size={10} className="text-primary-foreground" />
              </div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </label>
          <span className="text-[10px] text-muted-foreground font-bold truncate w-16 text-center">আমার স্টোরি</span>
        </button>

        {/* Other stories */}
        {storyGroups.filter(g => g.user_id !== currentUserId).map(group => (
          <button
            key={group.user_id}
            onClick={() => viewStory(group)}
            className="flex flex-col items-center gap-1 min-w-[68px] shrink-0"
          >
            <div className={`w-16 h-16 rounded-full p-[3px] ${group.viewed ? 'bg-muted' : 'bg-gradient-to-tr from-primary via-primary to-primary/60'}`}>
              <div className="w-full h-full rounded-full overflow-hidden border-2 border-card">
                {group.stories[0]?.image_url ? (
                  <img src={group.stories[0].image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Avatar className="w-full h-full">
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">
                      {group.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-bold truncate w-16 text-center">{group.name.split(" ")[0]}</span>
          </button>
        ))
        }
      </div>

      {/* Upload Preview Modal */}
      {showUpload && previewUrl && (
        <div className="fixed inset-0 z-[60] bg-foreground/90 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm flex flex-col items-center">
            <div className="relative w-full aspect-[9/16] max-h-[65vh] rounded-2xl overflow-hidden bg-black mb-4">
              <img src={previewUrl} alt="" className="w-full h-full object-contain" />
              <button onClick={() => { setShowUpload(false); setSelectedFile(null); setPreviewUrl(null); }} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white">
                <X size={18} />
              </button>
            </div>
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="ক্যাপশন লিখুন... (ঐচ্ছিক)"
              className="w-full px-4 py-2.5 rounded-xl bg-card/20 border border-white/20 text-white text-sm outline-none placeholder:text-white/50 mb-3"
            />
            <button
              onClick={uploadStory}
              disabled={uploading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {uploading ? "আপলোড হচ্ছে..." : "📸 স্টোরি পোস্ট করুন"}
            </button>
          </div>
        </div>
      )}

      {/* Story Viewer */}
      {viewingGroup && viewingGroup.stories[currentStoryIdx] && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          {/* Progress bars */}
          <div className="flex gap-1 px-3 pt-3 pb-1">
            {viewingGroup.stories.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: i < currentStoryIdx ? '100%' : i === currentStoryIdx ? `${progress}%` : '0%' }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-white/20 text-white font-black text-sm">
                {viewingGroup.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-white text-sm font-bold">{viewingGroup.name}</p>
              <p className="text-white/60 text-[10px]">
                {new Date(viewingGroup.stories[currentStoryIdx].created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {viewingGroup.user_id === currentUserId && (
              <div className="flex items-center gap-2">
                <span className="text-white/70 text-xs flex items-center gap-1">
                  <Eye size={14} /> {viewingGroup.stories[currentStoryIdx].views_count || 0}
                </span>
                <button
                  onClick={() => deleteMyStory(viewingGroup.stories[currentStoryIdx].id)}
                  className="text-white/70 hover:text-red-400 transition text-sm"
                >
                  🗑️
                </button>
              </div>
            )}
            <button onClick={() => setViewingGroup(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          {/* Story Image */}
          <div
            className="flex-1 flex items-center justify-center relative"
            onClick={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              if (x < rect.width / 3) {
                // Previous
                if (currentStoryIdx > 0) { setCurrentStoryIdx(i => i - 1); setProgress(0); }
              } else {
                // Next
                if (currentStoryIdx + 1 < viewingGroup.stories.length) { setCurrentStoryIdx(i => i + 1); setProgress(0); }
                else setViewingGroup(null);
              }
            }}
          >
            <img
              src={viewingGroup.stories[currentStoryIdx].image_url}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Caption */}
          {viewingGroup.stories[currentStoryIdx].caption && (
            <div className="px-6 py-4 text-center">
              <p className="text-white text-sm font-semibold">{viewingGroup.stories[currentStoryIdx].caption}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default StoriesBar;
