import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import UserProfileDialog from "@/components/chat/UserProfileDialog";

interface Profile {
  user_id: string;
  name: string;
  email: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

const ChatPage = () => {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showUserList, setShowUserList] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  // Load all users
  useEffect(() => {
    if (!currentUserId) return;
    const loadUsers = async () => {
      const { data } = await supabase.from("profiles").select("user_id, name, email").neq("user_id", currentUserId);
      if (data) setUsers(data);
    };
    loadUsers();
  }, [currentUserId]);

  // Load unread counts
  useEffect(() => {
    if (!currentUserId) return;
    const loadUnread = async () => {
      const { data } = await supabase
        .from("messages")
        .select("sender_id")
        .eq("receiver_id", currentUserId)
        .eq("read", false);
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1; });
        setUnreadCounts(counts);
      }
    };
    loadUnread();
  }, [currentUserId, messages]);

  // Load messages for selected user
  const loadMessages = useCallback(async () => {
    if (!currentUserId || !selectedUser) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${currentUserId})`)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as Message[]);

    // Mark as read
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("sender_id", selectedUser.user_id)
      .eq("receiver_id", currentUserId)
      .eq("read", false);
  }, [currentUserId, selectedUser]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel("chat-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === currentUserId && msg.receiver_id === selectedUser?.user_id) ||
          (msg.sender_id === selectedUser?.user_id && msg.receiver_id === currentUserId)
        ) {
          setMessages(prev => [...prev, msg]);
          // Mark as read if we're viewing this conversation
          if (msg.sender_id === selectedUser?.user_id) {
            supabase.from("messages").update({ read: true }).eq("id", msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, selectedUser]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser || !currentUserId) return;
    await supabase.from("messages").insert({
      sender_id: currentUserId,
      receiver_id: selectedUser.user_id,
      content: newMessage.trim(),
    });
    setNewMessage("");
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border p-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary border border-border hover:border-primary transition text-lg">←</button>
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow text-base">💬</div>
          <h1 className="text-lg font-black text-foreground">
            {selectedUser ? (
              <span className="flex items-center gap-2">
                <button onClick={() => { setSelectedUser(null); setShowUserList(true); }} className="md:hidden text-muted-foreground text-sm">←</button>
                {selectedUser.name}
              </span>
            ) : "চ্যাট"}
          </h1>
        </div>
      </nav>

      <div className="flex-1 max-w-6xl mx-auto w-full flex overflow-hidden">
        {/* User List */}
        <div className={`${selectedUser && !showUserList ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-border bg-card shrink-0`}>
          <div className="p-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 ইউজার খুঁজুন..."
              className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">কোনো ইউজার পাওয়া যায়নি</p>
            ) : (
              filteredUsers.map(u => (
                <button
                  key={u.user_id}
                  onClick={() => { setSelectedUser(u); setShowUserList(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/80 transition border-b border-border/50 ${selectedUser?.user_id === u.user_id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                >
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-black shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p
                      className="font-bold text-sm text-foreground truncate hover:text-primary cursor-pointer transition"
                      onClick={(e) => { e.stopPropagation(); setProfileUserId(u.user_id); setProfileOpen(true); }}
                    >{u.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {unreadCounts[u.user_id] > 0 && (
                    <span className="w-6 h-6 bg-destructive text-destructive-foreground text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {unreadCounts[u.user_id]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${!selectedUser && showUserList ? 'hidden md:flex' : 'flex'} flex-col flex-1 min-w-0`}>
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">💬</div>
                <p className="text-muted-foreground font-bold text-lg">একজন ইউজার সিলেক্ট করুন</p>
                <p className="text-muted-foreground text-sm mt-1">চ্যাট শুরু করতে বাম পাশ থেকে ইউজার বেছে নিন</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-3">👋</div>
                    <p className="text-muted-foreground font-bold">{selectedUser.name} কে মেসেজ পাঠান!</p>
                  </div>
                )}
                {messages.map(m => {
                  const isMine = m.sender_id === currentUserId;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${isMine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border text-foreground rounded-bl-md'}`}>
                        <p className="text-sm font-semibold whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'} text-right`}>
                          {formatTime(m.created_at)}
                          {isMine && <span className="ml-1">{m.read ? '✓✓' : '✓'}</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-3 bg-card">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="মেসেজ লিখুন..."
                    className="flex-1 p-3 rounded-xl bg-secondary border border-border outline-none text-sm font-bold text-foreground focus:border-primary transition"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-primary text-primary-foreground px-5 rounded-xl font-bold hover:opacity-90 transition active:scale-95 disabled:opacity-50"
                  >
                    পাঠান
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
