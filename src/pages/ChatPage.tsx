import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserProfileDialog from "@/components/chat/UserProfileDialog";
import { useCall } from "@/components/call/CallProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import UserAvatar, { getAvatarColor } from "@/components/chat/UserAvatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { compressImage } from "@/lib/imageCompress";
import { useFeatureSettings } from "@/hooks/useFeatureSettings";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ChatGroup {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  last_message?: string;
  last_message_time?: string;
}

interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface Profile {
  user_id: string;
  name: string;
  email: string;
  is_online?: boolean;
  last_seen?: string | null;
  avatar_url?: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url?: string | null;
  read: boolean;
  created_at: string;
}

interface ConversationItem {
  user: Profile;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isMine: boolean;
}

const ChatPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { settings: featureSettings } = useFeatureSettings();
  const [currentUserId, setCurrentUserId] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showInsightPanel, setShowInsightPanel] = useState(false);
  const { startCall } = useCall();
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUserIdRef = useRef("");
  const [sendingImage, setSendingImage] = useState(false);

  // Group state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [chatMode, setChatMode] = useState<"dm" | "group">("dm");
  const groupMsgEndRef = useRef<HTMLDivElement>(null);

  // Auth & Initial Fetch
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        currentUserIdRef.current = user.id;
      }
    });
  }, []);

  // Fetch Users and Listen for Presence
  useEffect(() => {
    if (!currentUserId) return;

    // ১. প্রাথমিক ইউজার ডাটা ফেচ
    const fetchUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, email, is_online, last_seen, avatar_url")
        .neq("user_id", currentUserId);
      if (data) setUsers(data as Profile[]);
    };
    fetchUsers();

    // ২. রিয়েল-টাইম অনলাইন আপডেট লিসেনার
    const channel = supabase.channel("online-status-sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
        const updatedUser = payload.new as Profile;
        setUsers(prev => prev.map(u => u.user_id === updatedUser.user_id ? { ...u, is_online: updatedUser.is_online, last_seen: updatedUser.last_seen } : u));
        
        if (selectedUser?.user_id === updatedUser.user_id) {
          setSelectedUser(prev => prev ? { ...prev, is_online: updatedUser.is_online, last_seen: updatedUser.last_seen } : null);
        }
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, selectedUser?.user_id]);

  const buildConversations = useCallback(async () => {
    if (!currentUserId || users.length === 0) return;
    const { data: allMsgs } = await supabase
      .from("messages").select("*")
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false });
    if (!allMsgs) return;

    const convMap: Record<string, { lastMsg: Message; unread: number }> = {};
    for (const msg of allMsgs as Message[]) {
      const otherId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
      if (!convMap[otherId]) convMap[otherId] = { lastMsg: msg, unread: 0 };
      if (msg.sender_id !== currentUserId && !msg.read) convMap[otherId].unread++;
    }

    const withConv: ConversationItem[] = [];
    const withoutConv: ConversationItem[] = [];
    users.forEach(u => {
      const conv = convMap[u.user_id];
      if (conv) {
        withConv.push({ user: u, lastMessage: conv.lastMsg.content, lastMessageTime: conv.lastMsg.created_at, unreadCount: conv.unread, isMine: conv.lastMsg.sender_id === currentUserId });
      } else {
        withoutConv.push({ user: u, lastMessage: "", lastMessageTime: "", unreadCount: 0, isMine: false });
      }
    });
    withConv.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    setConversations([...withConv, ...withoutConv]);
  }, [currentUserId, users]);

  useEffect(() => { buildConversations(); }, [buildConversations]);

  const loadMessages = useCallback(async () => {
    if (!currentUserId || !selectedUser) return;
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${currentUserId})`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);
    await supabase.from("messages").update({ read: true }).eq("sender_id", selectedUser.user_id).eq("receiver_id", currentUserId).eq("read", false);
  }, [currentUserId, selectedUser]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase.channel("chat-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          const msg = payload.new as Message;
          if ((msg.sender_id === currentUserId && msg.receiver_id === selectedUser?.user_id) || (msg.sender_id === selectedUser?.user_id && msg.receiver_id === currentUserId)) {
            setMessages(prev => [...prev, msg]);
            if (msg.sender_id === selectedUser?.user_id) supabase.from("messages").update({ read: true }).eq("id", msg.id);
          }
          buildConversations();
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, selectedUser, buildConversations]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (overrideContent?: string) => {
    const content = overrideContent || newMessage.trim();
    if (!content || !selectedUser || !currentUserId) return;
    if (!overrideContent) setNewMessage("");
    await supabase.from("messages").insert({ sender_id: currentUserId, receiver_id: selectedUser.user_id, content });
  };

  const sendImageMessage = async (file: File) => {
    if (!selectedUser || !currentUserId) return;
    setSendingImage(true);
    try {
      const compressed = await compressImage(file);
      const path = `chat/${currentUserId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("media").upload(path, compressed, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      await supabase.from("messages").insert({ sender_id: currentUserId, receiver_id: selectedUser.user_id, content: "📷 ছবি", image_url: data.publicUrl });
    } catch {
      toast.error("ছবি পাঠানো ব্যর্থ!");
    }
    setSendingImage(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("ছবি 10MB এর বেশি!"); return; }
    sendImageMessage(file);
    e.target.value = "";
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "এইমাত্র";
    if (mins < 60) return `${mins}মি`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}ঘ`;
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
  };

  const formatMsgTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });

  const formatLastSeen = (dateStr: string | null | undefined, is_online?: boolean) => {
    if (is_online) return "সক্রিয়";
    if (!dateStr) return "অফলাইন";
    const d = new Date(dateStr);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "এইমাত্র সক্রিয়";
    if (mins < 60) return `${mins} মি. আগে`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ঘ. আগে`;
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
  };

  // ===== GROUP CHAT FUNCTIONS (Keep as is) =====
  const loadGroups = useCallback(async () => {
    if (!currentUserId) return;
    const { data: memberOf } = await supabase.from("chat_group_members" as any).select("group_id").eq("user_id", currentUserId);
    if (!memberOf || (memberOf as any[]).length === 0) { setGroups([]); return; }
    const groupIds = (memberOf as any[]).map((m: any) => m.group_id);
    const { data: groupsData } = await supabase.from("chat_groups" as any).select("*").in("id", groupIds).order("updated_at", { ascending: false });
    if (groupsData) {
      const enriched: ChatGroup[] = [];
      for (const g of groupsData as any[]) {
        const { data: lastMsg } = await supabase.from("group_messages" as any).select("content, created_at").eq("group_id", g.id).order("created_at", { ascending: false }).limit(1) as any;
        const { count } = await supabase.from("chat_group_members" as any).select("*", { count: "exact", head: true }).eq("group_id", g.id) as any;
        enriched.push({ ...g, member_count: count || 0, last_message: lastMsg?.[0]?.content || "", last_message_time: lastMsg?.[0]?.created_at || g.created_at });
      }
      setGroups(enriched);
    }
  }, [currentUserId]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const createGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0) { toast.error("নাম ও সদস্য দিন"); return; }
    const { data: group, error } = await supabase.from("chat_groups" as any).insert({ name: newGroupName.trim(), created_by: currentUserId }).select().single();
    if (error || !group) { toast.error("ব্যর্থ"); return; }
    const members = [currentUserId, ...selectedMembers].map(uid => ({ group_id: (group as any).id, user_id: uid, role: uid === currentUserId ? "creator" : "member" }));
    await supabase.from("chat_group_members" as any).insert(members);
    setShowCreateGroup(false); setNewGroupName(""); setSelectedMembers([]); await loadGroups();
  };

  const loadGroupMessages = useCallback(async () => {
    if (!selectedGroup) return;
    const { data } = await supabase.from("group_messages" as any).select("*").eq("group_id", selectedGroup.id).order("created_at", { ascending: true });
    if (data) setGroupMessages(data as any[]);
  }, [selectedGroup]);

  useEffect(() => { loadGroupMessages(); }, [loadGroupMessages]);
  useEffect(() => { groupMsgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [groupMessages]);

  const sendGroupMessage = async (overrideContent?: string) => {
    const content = overrideContent || newMessage.trim();
    if (!content || !selectedGroup || !currentUserId) return;
    if (!overrideContent) setNewMessage("");
    await supabase.from("group_messages" as any).insert({ group_id: selectedGroup.id, sender_id: currentUserId, content });
  };

  const getProfileName = (userId: string) => users.find(u => u.user_id === userId)?.name || "অজানা";

  const filteredConversations = search
    ? conversations.filter(c => c.user.name.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  // ===== RENDER HELPERS =====
  const renderOnlineIndicator = (isOnline?: boolean) => (
    isOnline ? <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-card rounded-full shadow-sm animate-pulse" /> : null
  );

  // Desktop View
  if (!isMobile) {
    return (
      <div className="h-screen flex bg-background overflow-hidden">
        {/* Sidebar */}
        <div className="w-[380px] flex flex-col border-r border-border bg-card shrink-0">
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-[26px] font-black text-foreground tracking-tight">চ্যাট</h1>
              <div className="flex items-center gap-1.5">
                <button onClick={() => navigate("/dashboard")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-accent text-sm">🏠</button>
                <button onClick={() => navigate("/feed")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-accent text-sm">📰</button>
                <button onClick={() => setShowCreateGroup(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-accent text-sm">👥</button>
              </div>
            </div>
            <div className="relative">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Messenger-এ অনুসন্ধান করুন" className="w-full pl-10 pr-4 py-2.5 rounded-full bg-secondary border-0 outline-none text-sm" />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
            </div>
          </div>

          <div className="flex border-b border-border">
            <button onClick={() => setChatMode("dm")} className={`flex-1 py-2 text-sm font-bold ${chatMode === "dm" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>💬 চ্যাট</button>
            <button onClick={() => setChatMode("group")} className={`flex-1 py-2 text-sm font-bold ${chatMode === "group" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}>👥 গ্রুপ</button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">
            {chatMode === "dm" ? (
              filteredConversations.map(conv => (
                <button key={conv.user.user_id} onClick={() => setSelectedUser(conv.user)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-xl transition-all ${selectedUser?.user_id === conv.user.user_id ? 'bg-primary/10' : 'hover:bg-secondary/80'}`}
                  style={{ width: 'calc(100% - 16px)' }}>
                  <div className="relative shrink-0">
                    <UserAvatar name={conv.user.name} avatarUrl={conv.user.avatar_url} size={48} />
                    {renderOnlineIndicator(conv.user.is_online)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <p className={`text-[14px] truncate ${conv.unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>{conv.user.name}</p>
                      <span className="text-[11px] text-muted-foreground">{formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <p className="text-[12px] truncate text-muted-foreground">{conv.lastMessage || "মেসেজ পাঠান"}</p>
                  </div>
                </button>
              ))
            ) : (
              groups.map(g => (
                <button key={g.id} onClick={() => { setSelectedGroup(g); setSelectedUser(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-xl ${selectedGroup?.id === g.id ? 'bg-primary/10' : 'hover:bg-secondary/80'}`}
                  style={{ width: 'calc(100% - 16px)' }}>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl">👥</div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[14px] font-bold truncate">{g.name}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{g.last_message || "গ্রুপ চ্যাট শুরু করুন"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedUser ? (
            <>
              <div className="h-[68px] flex items-center px-5 border-b bg-card/80 backdrop-blur-sm">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative cursor-pointer" onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }}>
                    <UserAvatar name={selectedUser.name} avatarUrl={selectedUser.avatar_url} size={44} />
                    {renderOnlineIndicator(selectedUser.is_online)}
                  </div>
                  <div>
                    <p className="font-bold text-[15px]">{selectedUser.name}</p>
                    <p className="text-[12px] flex items-center gap-1">
                      {selectedUser.is_online ? <><span className="w-2 h-2 bg-green-500 rounded-full" /> <span className="text-green-500 font-bold">সক্রিয়</span></> : <span className="text-muted-foreground">{formatLastSeen(selectedUser.last_seen)}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startCall(selectedUser.user_id, selectedUser.name, "audio")} className="p-2 hover:bg-secondary rounded-full text-primary text-xl">📞</button>
                  <button onClick={() => startCall(selectedUser.user_id, selectedUser.name, "video")} className="p-2 hover:bg-secondary rounded-full text-primary text-xl">📹</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 no-scrollbar bg-background">
                {messages.map((m, idx) => {
                  const isMine = m.sender_id === currentUserId;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mt-1`}>
                      <div className={`max-w-[60%] px-4 py-2 rounded-[20px] text-[15px] ${isMine ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                        {m.content !== "📷 ছবি" && <p>{m.content}</p>}
                        {m.image_url && <img src={m.image_url} className="mt-1 rounded-lg max-w-[250px]" onClick={() => window.open(m.image_url!, '_blank')} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-5 py-3 border-t bg-card">
                <div className="flex items-center gap-3">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage()} placeholder="Aa" className="flex-1 px-4 py-2 rounded-full bg-secondary outline-none" />
                  <button onClick={() => sendMessage()} className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center">➤</button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">কথোপকথন শুরু করতে ইউজার সিলেক্ট করুন</div>
          )}
        </div>
      </div>
    );
  }

  // Mobile View
  return (
    <div className="flex flex-col h-screen bg-background">
      {!selectedUser && !selectedGroup ? (
        <>
          <div className="p-4 bg-card shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-black">চ্যাট</h1>
              <div className="flex gap-2">
                <button onClick={() => navigate("/dashboard")} className="p-2 bg-secondary rounded-full">🏠</button>
                <button onClick={() => setShowCreateGroup(true)} className="p-2 bg-secondary rounded-full">👥</button>
              </div>
            </div>
            <input type="text" placeholder="সার্চ করুন..." className="w-full p-2.5 rounded-full bg-secondary outline-none text-sm" />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.map(conv => (
              <button key={conv.user.user_id} onClick={() => setSelectedUser(conv.user)} className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50">
                <div className="relative shrink-0">
                  <UserAvatar name={conv.user.name} avatarUrl={conv.user.avatar_url} size={56} />
                  {renderOnlineIndicator(conv.user.is_online)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold truncate">{conv.user.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{conv.lastMessage || "নতুন মেসেজ পাঠান"}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col h-screen">
          <div className="p-2 border-b flex items-center gap-2 bg-card">
            <button onClick={() => setSelectedUser(null)} className="p-2 text-2xl">←</button>
            <div className="relative" onClick={() => { setProfileUserId(selectedUser!.user_id); setProfileOpen(true); }}>
              <UserAvatar name={selectedUser!.name} avatarUrl={selectedUser!.avatar_url} size={40} />
              {renderOnlineIndicator(selectedUser!.is_online)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="font-bold text-sm truncate">{selectedUser!.name}</p>
              <p className="text-[10px] flex items-center gap-1">
                {selectedUser!.is_online ? <><span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> <span className="text-green-500 font-bold">সক্রিয়</span></> : <span>{formatLastSeen(selectedUser!.last_seen)}</span>}
              </p>
            </div>
            <button onClick={() => startCall(selectedUser!.user_id, selectedUser!.name, "audio")} className="p-2 text-primary text-lg">📞</button>
            <button onClick={() => startCall(selectedUser!.user_id, selectedUser!.name, "video")} className="p-2 text-primary text-lg">📹</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-2.5 rounded-2xl text-sm ${m.sender_id === currentUserId ? 'bg-primary text-white' : 'bg-secondary'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-card border-t flex items-center gap-2">
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="মেসেজ..." className="flex-1 p-2.5 bg-secondary rounded-full outline-none text-sm" />
            <button onClick={() => sendMessage()} className="p-2.5 bg-primary text-white rounded-full">➤</button>
          </div>
        </div>
      )}

      <UserProfileDialog userId={profileUserId} open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default ChatPage;
