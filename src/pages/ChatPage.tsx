import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserProfileDialog from "@/components/chat/UserProfileDialog";
import { useCall } from "@/components/call/CallProvider";
import { useIsMobile } from "@/hooks/use-mobile";

interface Profile {
  user_id: string;
  name: string;
  email: string;
  is_online?: boolean;
  last_seen?: string | null;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
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
  const { startCall } = useCall();
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUserIdRef = useRef("");

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        currentUserIdRef.current = user.id;
        supabase.from("profiles").update({ is_online: true, last_seen: new Date().toISOString() } as any).eq("user_id", user.id);
      }
    });
    const handleBeforeUnload = () => {
      if (currentUserIdRef.current) {
        navigator.sendBeacon && supabase.from("profiles").update({ is_online: false, last_seen: new Date().toISOString() } as any).eq("user_id", currentUserIdRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (currentUserIdRef.current) {
        supabase.from("profiles").update({ is_online: false, last_seen: new Date().toISOString() } as any).eq("user_id", currentUserIdRef.current);
      }
    };
  }, []);

  // Load users
  useEffect(() => {
    if (!currentUserId) return;
    supabase.from("profiles").select("user_id, name, email, is_online, last_seen").neq("user_id", currentUserId).then(({ data }) => {
      if (data) setUsers(data as Profile[]);
    });
  }, [currentUserId]);

  // Build conversation list sorted by latest message
  const buildConversations = useCallback(async () => {
    if (!currentUserId || users.length === 0) return;

    const { data: allMsgs } = await supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order("created_at", { ascending: false });

    if (!allMsgs) return;

    const convMap: Record<string, { lastMsg: Message; unread: number }> = {};

    for (const msg of allMsgs as Message[]) {
      const otherId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
      if (!convMap[otherId]) {
        convMap[otherId] = { lastMsg: msg, unread: 0 };
      }
      if (msg.sender_id !== currentUserId && !msg.read) {
        convMap[otherId].unread++;
      }
    }

    // Users with conversations first, sorted by last message time
    const withConv: ConversationItem[] = [];
    const withoutConv: ConversationItem[] = [];

    users.forEach(u => {
      const conv = convMap[u.user_id];
      if (conv) {
        withConv.push({
          user: u,
          lastMessage: conv.lastMsg.content,
          lastMessageTime: conv.lastMsg.created_at,
          unreadCount: conv.unread,
          isMine: conv.lastMsg.sender_id === currentUserId,
        });
      } else {
        withoutConv.push({
          user: u,
          lastMessage: "",
          lastMessageTime: "",
          unreadCount: 0,
          isMine: false,
        });
      }
    });

    withConv.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    setConversations([...withConv, ...withoutConv]);
  }, [currentUserId, users]);

  useEffect(() => { buildConversations(); }, [buildConversations]);

  // Load messages for selected user
  const loadMessages = useCallback(async () => {
    if (!currentUserId || !selectedUser) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${currentUserId})`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);

    await supabase
      .from("messages")
      .update({ read: true })
      .eq("sender_id", selectedUser.user_id)
      .eq("receiver_id", currentUserId)
      .eq("read", false);
  }, [currentUserId, selectedUser]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel("chat-messages-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === currentUserId && msg.receiver_id === selectedUser?.user_id) ||
            (msg.sender_id === selectedUser?.user_id && msg.receiver_id === currentUserId)
          ) {
            setMessages(prev => [...prev, msg]);
            if (msg.sender_id === selectedUser?.user_id) {
              supabase.from("messages").update({ read: true }).eq("id", msg.id);
            }
          }
          buildConversations();
        }
        if (payload.eventType === "UPDATE") {
          setMessages(prev => prev.map(m => m.id === (payload.new as Message).id ? { ...m, ...(payload.new as Message) } : m));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, selectedUser, buildConversations]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUserId) return;
    const content = newMessage.trim();
    setNewMessage("");
    await supabase.from("messages").insert({
      sender_id: currentUserId,
      receiver_id: selectedUser.user_id,
      content,
    });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "এইমাত্র";
    if (mins < 60) return `${mins} মি.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ঘ.`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} দিন`;
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
  };

  const formatMsgTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
  };

  const formatLastSeen = (dateStr: string | null | undefined) => {
    if (!dateStr) return "অফলাইন";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "সবেমাত্র অ্যাক্টিভ";
    if (mins < 60) return `${mins} মি. আগে অ্যাক্টিভ`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ঘ. আগে অ্যাক্টিভ`;
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" }) + " অ্যাক্টিভ";
  };

  const filteredConversations = search
    ? conversations.filter(c => c.user.name.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const showChatView = selectedUser && (isMobile || true);

  // ========= RENDER =========
  return (
    <div className="bg-background min-h-screen flex flex-col">
      {/* ===== USER LIST VIEW ===== */}
      {(!selectedUser || !isMobile) && (
        <div className={`${selectedUser && !isMobile ? 'w-[360px] border-r border-border' : 'w-full'} ${selectedUser && isMobile ? 'hidden' : ''} flex flex-col h-screen ${!isMobile && selectedUser ? '' : ''}`}
          style={!isMobile && selectedUser ? { position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40 } : {}}>
          {/* Messenger Header */}
          <div className="sticky top-0 z-30 bg-card px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => navigate("/dashboard")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition text-base">
                  ←
                </button>
                <h1 className="text-2xl font-black text-foreground">চ্যাট</h1>
              </div>
              <div className="flex items-center gap-1">
                <button className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 transition text-base">
                  ✏️
                </button>
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="অনুসন্ধান করুন"
                className="w-full pl-9 pr-4 py-2 rounded-full bg-secondary border-0 outline-none text-sm font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          </div>

          {/* Online users strip */}
          {users.filter(u => u.is_online).length > 0 && (
            <div className="px-4 py-2 flex gap-3 overflow-x-auto no-scrollbar border-b border-border/50">
              {users.filter(u => u.is_online).map(u => (
                <button
                  key={u.user_id}
                  onClick={() => setSelectedUser(u)}
                  className="flex flex-col items-center gap-1 min-w-[56px]"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-black text-primary">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-[2.5px] border-card rounded-full" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground truncate w-14 text-center">{u.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredConversations.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-12">কোনো কথোপকথন নেই</p>
            ) : (
              filteredConversations.map(conv => (
                <button
                  key={conv.user.user_id}
                  onClick={() => setSelectedUser(conv.user)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition active:bg-secondary ${selectedUser?.user_id === conv.user.user_id ? 'bg-primary/5' : ''}`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-lg font-black text-primary">
                      {conv.user.name.charAt(0).toUpperCase()}
                    </div>
                    {conv.user.is_online && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-[2.5px] border-card rounded-full" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold text-[15px] truncate ${conv.unreadCount > 0 ? 'text-foreground font-bold' : 'text-foreground'}`}>
                        {conv.user.name}
                      </p>
                      {conv.lastMessageTime && (
                        <span className={`text-[11px] shrink-0 ml-2 ${conv.unreadCount > 0 ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {conv.isMine && <span className="text-muted-foreground text-xs shrink-0">আপনি:</span>}
                        <p className={`text-[13px] truncate ${conv.unreadCount > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                          {conv.lastMessage}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[13px] text-muted-foreground/60 mt-0.5">কোনো মেসেজ নেই</p>
                    )}
                  </div>
                  {/* Unread badge */}
                  {conv.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===== CHAT VIEW ===== */}
      {selectedUser && (
        <div className={`flex flex-col h-screen ${!isMobile ? 'ml-[360px]' : ''}`}>
          {/* Chat Header */}
          <div className="sticky top-0 z-30 bg-card border-b border-border px-3 py-2 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition text-lg shrink-0"
              >
                ←
              </button>
              <button
                onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }}
                className="relative shrink-0"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-black text-primary">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                {selectedUser.is_online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />
                )}
              </button>
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }}
              >
                <p className="font-bold text-[15px] text-foreground truncate">{selectedUser.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedUser.is_online ? (
                    <span className="text-green-500 font-semibold">সক্রিয়</span>
                  ) : (
                    formatLastSeen(selectedUser.last_seen)
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => startCall(selectedUser.user_id, selectedUser.name, "audio")}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition active:scale-95 text-primary text-lg"
                >
                  📞
                </button>
                <button
                  onClick={() => startCall(selectedUser.user_id, selectedUser.name, "video")}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition active:scale-95 text-primary text-lg"
                >
                  📹
                </button>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar" style={{ background: 'var(--background)' }}>
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl font-black text-primary mb-3">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <p className="font-bold text-foreground text-lg">{selectedUser.name}</p>
                <p className="text-muted-foreground text-sm mt-1">কথোপকথন শুরু করুন</p>
              </div>
            )}
            {messages.map((m, idx) => {
              const isMine = m.sender_id === currentUserId;
              const prevMsg = messages[idx - 1];
              const sameSender = prevMsg && prevMsg.sender_id === m.sender_id;
              const timeDiff = prevMsg ? new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime() : Infinity;
              const showGap = timeDiff > 300000; // 5 min gap

              return (
                <div key={m.id}>
                  {showGap && (
                    <div className="text-center my-4">
                      <span className="text-[11px] text-muted-foreground bg-secondary/80 px-3 py-1 rounded-full">
                        {formatMsgTime(m.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${sameSender && !showGap ? 'mt-0.5' : 'mt-2'}`}>
                    <div className={`max-w-[78%] group relative`}>
                      <div className={`px-3 py-2 text-[15px] ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-[18px] rounded-br-[4px]'
                          : 'bg-secondary text-foreground rounded-[18px] rounded-bl-[4px]'
                      }`}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <span className="text-[10px] text-muted-foreground">{formatMsgTime(m.created_at)}</span>
                        {isMine && (
                          <span className={`text-[10px] ${m.read ? 'text-primary' : 'text-muted-foreground'}`}>
                            {m.read ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area - Messenger style */}
          <div className="border-t border-border bg-card px-3 py-2">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Aa"
                  className="w-full px-4 py-2.5 rounded-full bg-secondary border-0 outline-none text-[15px] text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>
              {newMessage.trim() ? (
                <button
                  onClick={sendMessage}
                  className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition active:scale-90 text-xl shrink-0"
                >
                  ➤
                </button>
              ) : (
                <button className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition active:scale-90 text-xl shrink-0">
                  👍
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <UserProfileDialog userId={profileUserId} open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default ChatPage;
