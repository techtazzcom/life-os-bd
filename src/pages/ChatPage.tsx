import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserProfileDialog from "@/components/chat/UserProfileDialog";
import { useCall } from "@/components/call/CallProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import UserAvatar, { getAvatarColor } from "@/components/chat/UserAvatar";

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

// Avatar colors handled by UserAvatar component

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

  // Auth & online status
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

  useEffect(() => {
    if (!currentUserId) return;
    supabase.from("profiles").select("user_id, name, email, is_online, last_seen, avatar_url").neq("user_id", currentUserId).then(({ data }) => {
      if (data) setUsers(data as Profile[]);
    });
  }, [currentUserId]);

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
    const channel = supabase.channel("chat-messages-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const msg = payload.new as Message;
          if ((msg.sender_id === currentUserId && msg.receiver_id === selectedUser?.user_id) || (msg.sender_id === selectedUser?.user_id && msg.receiver_id === currentUserId)) {
            setMessages(prev => [...prev, msg]);
            if (msg.sender_id === selectedUser?.user_id) supabase.from("messages").update({ read: true }).eq("id", msg.id);
          }
          buildConversations();
        }
        if (payload.eventType === "UPDATE") {
          setMessages(prev => prev.map(m => m.id === (payload.new as Message).id ? { ...m, ...(payload.new as Message) } : m));
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, selectedUser, buildConversations]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUserId) return;
    const content = newMessage.trim();
    setNewMessage("");
    await supabase.from("messages").insert({ sender_id: currentUserId, receiver_id: selectedUser.user_id, content });
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
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}দিন`;
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" });
  };

  const formatMsgTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });

  const formatLastSeen = (dateStr: string | null | undefined) => {
    if (!dateStr) return "অফলাইন";
    const d = new Date(dateStr);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "সবেমাত্র সক্রিয়";
    if (mins < 60) return `${mins} মি. আগে সক্রিয়`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ঘ. আগে সক্রিয়`;
    return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short" }) + " সক্রিয়";
  };

  const filteredConversations = search
    ? conversations.filter(c => c.user.name.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  // ===== DESKTOP LAYOUT =====
  if (!isMobile) {
    return (
      <div className="h-screen flex bg-background overflow-hidden">
        {/* Sidebar */}
        <div className="w-[380px] flex flex-col border-r border-border bg-card shrink-0">
          {/* Sidebar Header */}
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-[26px] font-black text-foreground tracking-tight">চ্যাট</h1>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-accent transition-colors text-sm text-foreground"
                  title="ড্যাশবোর্ড"
                >
                  🏠
                </button>
                <button className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-accent transition-colors text-sm">
                  ✏️
                </button>
              </div>
            </div>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Messenger-এ অনুসন্ধান করুন"
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-secondary border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
          </div>

          {/* Online strip */}
          {users.filter(u => u.is_online).length > 0 && (
            <div className="px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
              {users.filter(u => u.is_online).map(u => (
                <button key={u.user_id} onClick={() => setSelectedUser(u)} className="flex flex-col items-center gap-1 min-w-[60px] group">
                  <div className="relative">
                    <UserAvatar name={u.name} avatarUrl={u.avatar_url} size={52} className="shadow-md group-hover:shadow-lg transition-shadow" />
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                  </div>
                  <span className="text-[11px] text-muted-foreground group-hover:text-foreground truncate w-[60px] text-center transition-colors">{u.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredConversations.map(conv => {
              const isSelected = selectedUser?.user_id === conv.user.user_id;
              return (
                <button
                  key={conv.user.user_id}
                  onClick={() => setSelectedUser(conv.user)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? 'bg-primary/10'
                      : 'hover:bg-secondary/80'
                  }`}
                  style={{ width: 'calc(100% - 16px)' }}
                >
                  <div className="relative shrink-0">
                    <UserAvatar name={conv.user.name} avatarUrl={conv.user.avatar_url} size={48} />
                    {conv.user.is_online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[14px] truncate ${conv.unreadCount > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                        {conv.user.name}
                      </p>
                      {conv.lastMessageTime && (
                        <span className={`text-[11px] shrink-0 ${conv.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                          {formatTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {conv.lastMessage ? (
                        <>
                          {conv.isMine && <span className="text-muted-foreground text-[12px] shrink-0">আপনি:</span>}
                          <p className={`text-[12px] truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                            {conv.lastMessage}
                          </p>
                        </>
                      ) : (
                        <p className="text-[12px] text-muted-foreground/50 italic">নতুন কথোপকথন শুরু করুন</p>
                      )}
                    </div>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedUser ? (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center bg-background">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">আপনার মেসেজ</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  বাম পাশ থেকে একটি কথোপকথন সিলেক্ট করুন<br />অথবা নতুন মেসেজ শুরু করুন
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header - Desktop */}
              <div className="h-[68px] flex items-center px-5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }}
                    className="relative shrink-0 group"
                  >
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${getAvatarColor(selectedUser.name)} flex items-center justify-center text-white text-sm font-bold shadow-sm group-hover:shadow-md transition-shadow`}>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    {selectedUser.is_online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                    )}
                  </button>
                  <div
                    className="min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }}
                  >
                    <p className="font-bold text-[15px] text-foreground truncate leading-tight">{selectedUser.name}</p>
                    <p className="text-[12px] leading-tight mt-0.5">
                      {selectedUser.is_online
                        ? <span className="text-green-500 font-medium">● সক্রিয়</span>
                        : <span className="text-muted-foreground">{formatLastSeen(selectedUser.last_seen)}</span>
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => startCall(selectedUser.user_id, selectedUser.name, "audio")}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-primary text-lg"
                    title="অডিও কল"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => startCall(selectedUser.user_id, selectedUser.name, "video")}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-primary text-lg"
                    title="ভিডিও কল"
                  >
                    📹
                  </button>
                  <button
                    onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-muted-foreground text-sm ml-1"
                    title="প্রোফাইল দেখুন"
                  >
                    ℹ️
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-6 py-5 no-scrollbar bg-background">
                {messages.length === 0 && (
                  <div className="text-center py-20">
                    <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br ${getAvatarColor(selectedUser.name)} flex items-center justify-center text-white text-4xl font-bold shadow-lg mb-4`}>
                      {selectedUser.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="font-bold text-foreground text-xl mb-1">{selectedUser.name}</p>
                    <p className="text-muted-foreground text-sm">এই কথোপকথনের শুরু</p>
                  </div>
                )}
                {messages.map((m, idx) => {
                  const isMine = m.sender_id === currentUserId;
                  const prevMsg = messages[idx - 1];
                  const nextMsg = messages[idx + 1];
                  const sameSenderPrev = prevMsg && prevMsg.sender_id === m.sender_id;
                  const sameSenderNext = nextMsg && nextMsg.sender_id === m.sender_id;
                  const timeDiff = prevMsg ? new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime() : Infinity;
                  const showTimestamp = timeDiff > 300000;

                  // Bubble radius logic for grouped messages
                  const isFirst = !sameSenderPrev || showTimestamp;
                  const isLast = !sameSenderNext || (nextMsg && new Date(nextMsg.created_at).getTime() - new Date(m.created_at).getTime() > 300000);

                  let bubbleRadius = "rounded-[20px]";
                  if (isMine) {
                    if (isFirst && isLast) bubbleRadius = "rounded-[20px]";
                    else if (isFirst) bubbleRadius = "rounded-[20px] rounded-br-[6px]";
                    else if (isLast) bubbleRadius = "rounded-[20px] rounded-tr-[6px]";
                    else bubbleRadius = "rounded-[20px] rounded-r-[6px]";
                  } else {
                    if (isFirst && isLast) bubbleRadius = "rounded-[20px]";
                    else if (isFirst) bubbleRadius = "rounded-[20px] rounded-bl-[6px]";
                    else if (isLast) bubbleRadius = "rounded-[20px] rounded-tl-[6px]";
                    else bubbleRadius = "rounded-[20px] rounded-l-[6px]";
                  }

                  return (
                    <div key={m.id}>
                      {showTimestamp && (
                        <div className="text-center my-5">
                          <span className="text-[11px] text-muted-foreground/70 font-medium px-4 py-1.5 rounded-full bg-secondary/60">
                            {formatMsgTime(m.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${isFirst && !showTimestamp ? 'mt-3' : 'mt-[3px]'}`}>
                        {/* Remote avatar on first message of group */}
                        {!isMine && (
                          <div className="w-8 mr-2 shrink-0 self-end">
                            {isLast && (
                              <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarColor(selectedUser.name)} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>
                                {selectedUser.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="max-w-[55%] group relative">
                          <div className={`px-4 py-2 text-[15px] leading-relaxed ${bubbleRadius} ${
                            isMine
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-secondary text-foreground'
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          </div>
                          {/* Hover time */}
                          <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap`}>
                            <span className="text-[11px] text-muted-foreground bg-card border border-border px-2 py-1 rounded-lg shadow-sm">
                              {formatMsgTime(m.created_at)}
                              {isMine && (
                                <span className={`ml-1 ${m.read ? 'text-primary' : ''}`}>
                                  {m.read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input - Desktop */}
              <div className="px-5 py-3 bg-card border-t border-border shrink-0">
                <div className="flex items-center gap-3">
                  <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-primary text-lg shrink-0">
                    ➕
                  </button>
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Aa"
                      className="w-full px-5 py-2.5 rounded-full bg-secondary border-0 outline-none text-[15px] text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-lg hover:scale-110 transition-transform">
                      😊
                    </button>
                  </div>
                  {newMessage.trim() ? (
                    <button
                      onClick={sendMessage}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-90 shrink-0 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  ) : (
                    <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors text-primary text-xl shrink-0">
                      👍
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <UserProfileDialog userId={profileUserId} open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    );
  }

  // ===== MOBILE LAYOUT =====
  return (
    <div className="bg-background min-h-screen flex flex-col">
      {!selectedUser ? (
        <div className="flex flex-col h-screen">
          {/* Mobile Header */}
          <div className="sticky top-0 z-30 bg-card px-4 pt-3 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => navigate("/dashboard")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-accent transition text-base">←</button>
                <h1 className="text-2xl font-black text-foreground">চ্যাট</h1>
              </div>
              <button className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary hover:bg-accent transition text-base">✏️</button>
            </div>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="অনুসন্ধান করুন"
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-secondary border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          </div>
          {/* Online strip */}
          {users.filter(u => u.is_online).length > 0 && (
            <div className="px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar border-b border-border/30">
              {users.filter(u => u.is_online).map(u => (
                <button key={u.user_id} onClick={() => setSelectedUser(u)} className="flex flex-col items-center gap-1 min-w-[56px]">
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getAvatarColor(u.name)} flex items-center justify-center text-white text-base font-bold shadow-md`}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 border-2 border-card rounded-full" />
                  </div>
                  <span className="text-[11px] text-muted-foreground truncate w-14 text-center">{u.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          )}
          {/* Conversations */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredConversations.map(conv => (
              <button key={conv.user.user_id} onClick={() => setSelectedUser(conv.user)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition active:bg-secondary">
                <div className="relative shrink-0">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getAvatarColor(conv.user.name)} flex items-center justify-center text-white text-lg font-bold shadow-sm`}>
                    {conv.user.name.charAt(0).toUpperCase()}
                  </div>
                  {conv.user.is_online && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-[2.5px] border-card rounded-full" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className={`text-[15px] truncate ${conv.unreadCount > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>{conv.user.name}</p>
                    {conv.lastMessageTime && <span className={`text-[11px] shrink-0 ml-2 ${conv.unreadCount > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>{formatTime(conv.lastMessageTime)}</span>}
                  </div>
                  {conv.lastMessage ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      {conv.isMine && <span className="text-muted-foreground text-[12px] shrink-0">আপনি:</span>}
                      <p className={`text-[13px] truncate ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{conv.lastMessage}</p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-muted-foreground/50 mt-0.5">মেসেজ পাঠান</p>
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">{conv.unreadCount > 9 ? "9+" : conv.unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Mobile Chat View */
        <div className="flex flex-col h-screen">
          <div className="sticky top-0 z-30 bg-card border-b border-border px-2 py-2 shadow-sm">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedUser(null)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition text-lg shrink-0">←</button>
              <button onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }} className="relative shrink-0">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(selectedUser.name)} flex items-center justify-center text-white text-xs font-bold`}>
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                {selectedUser.is_online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />}
              </button>
              <div className="flex-1 min-w-0" onClick={() => { setProfileUserId(selectedUser.user_id); setProfileOpen(true); }}>
                <p className="font-bold text-[14px] text-foreground truncate leading-tight">{selectedUser.name}</p>
                <p className="text-[11px] leading-tight">
                  {selectedUser.is_online ? <span className="text-green-500 font-medium">সক্রিয়</span> : <span className="text-muted-foreground">{formatLastSeen(selectedUser.last_seen)}</span>}
                </p>
              </div>
              <div className="flex items-center">
                <button onClick={() => startCall(selectedUser.user_id, selectedUser.name, "audio")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition active:scale-95 text-primary text-lg">📞</button>
                <button onClick={() => startCall(selectedUser.user_id, selectedUser.name, "video")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-secondary transition active:scale-95 text-primary text-lg">📹</button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar bg-background">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${getAvatarColor(selectedUser.name)} flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-3`}>
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
              const showGap = timeDiff > 300000;
              return (
                <div key={m.id}>
                  {showGap && (
                    <div className="text-center my-4">
                      <span className="text-[11px] text-muted-foreground bg-secondary/80 px-3 py-1 rounded-full">{formatMsgTime(m.created_at)}</span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${sameSender && !showGap ? 'mt-0.5' : 'mt-2'}`}>
                    <div className="max-w-[78%] group relative">
                      <div className={`px-3.5 py-2 text-[15px] ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-[20px] rounded-br-[5px]'
                          : 'bg-secondary text-foreground rounded-[20px] rounded-bl-[5px]'
                      }`}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : 'justify-start'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <span className="text-[10px] text-muted-foreground">{formatMsgTime(m.created_at)}</span>
                        {isMine && <span className={`text-[10px] ${m.read ? 'text-primary' : 'text-muted-foreground'}`}>{m.read ? '✓✓' : '✓'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <input ref={inputRef} type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Aa"
                  className="w-full px-4 py-2.5 rounded-full bg-secondary border-0 outline-none text-[15px] text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>
              {newMessage.trim() ? (
                <button onClick={sendMessage} className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-90 shrink-0 shadow-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                </button>
              ) : (
                <button className="w-10 h-10 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition active:scale-90 text-xl shrink-0">👍</button>
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
