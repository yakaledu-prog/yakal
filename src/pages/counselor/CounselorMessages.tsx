import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Search, ArrowLeft, MessageSquarePlus, Loader2 } from "lucide-react";
import { countUnread, lastMessage, type Conversation } from "@/mock/chatData";
import { cn } from "@/utils/cn";
import { ChatPane, avatarUrl, formatListDate } from "@/components/chat/ChatPane";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getConversations, getContacts, getOrCreateConversation, markMessagesAsRead,
  subscribeToMessages, mapDbToLocalConversations, type Contact,
} from "@/services/messageService";
import { usePresence, useTypingIndicator } from "@/hooks/usePresence";

export function CounselorMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const openWith = (location.state as { openWith?: string } | null)?.openWith;

  const { data: dbConversations, isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user,
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", user?.id],
    queryFn: () => getContacts(user!.id),
    enabled: !!user,
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  const onlineIds = usePresence(user?.id);
  const { typingUserIds, notifyTyping } = useTypingIndicator(activeConvId || undefined, user?.id);

  useEffect(() => {
    if (dbConversations) {
      setConversations(mapDbToLocalConversations(dbConversations));
      if (!activeConvId && dbConversations.length > 0 && !openWith) setActiveConvId(dbConversations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbConversations]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToMessages(() => queryClient.invalidateQueries({ queryKey: ["conversations", user.id] }));
    return () => unsub();
  }, [user, queryClient]);

  // Deep-link: "Message" button from a student detail page.
  useEffect(() => {
    if (openWith && user) startChat({ id: openWith } as Contact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWith, user]);

  const liveConversations = conversations.map((c) => ({
    ...c,
    contact: { ...c.contact, isOnline: onlineIds.has(c.contact.id) },
  }));
  const activeConv = liveConversations.find((c) => c.id === activeConvId);
  const activeTyping = !!activeConv && typingUserIds.has(activeConv.contact.id);

  function openConversation(convId: string) {
    setActiveConvId(convId);
    setShowChatOnMobile(true);
    if (user) markMessagesAsRead(convId, user.id).catch(() => {});
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0, messages: c.messages.map((m) => ({ ...m, isRead: true })) } : c))
    );
  }

  async function startChat(contact: Contact) {
    if (!user || startingChatId) return;
    setStartingChatId(contact.id);
    try {
      const convId = await getOrCreateConversation(user.id, contact.id);
      await queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      setActiveConvId(convId);
      setShowChatOnMobile(true);
    } catch (err) {
      console.error("Failed to start conversation", err);
    } finally {
      setStartingChatId(null);
    }
  }

  const filtered = liveConversations.filter((c) => c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const existingIds = new Set(conversations.map((c) => c.contact.id));
  const newContacts = contacts.filter(
    (p) => !existingIds.has(p.id) && p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageWrapper>
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] flex flex-col">
        <div className="bg-[#1099A1] text-white p-6 md:p-10 shrink-0">
          <div className="max-w-[1440px] mx-auto">
            <h1 className="text-3xl font-bold tracking-tight mb-1">Messages</h1>
            <p className="text-white/80 text-[15px]">Advise your students on their applications</p>
          </div>
        </div>

        <div className="flex-1 max-w-[1440px] mx-auto w-full bg-white dark:bg-[#111b21] border-x border-[#e9edef] dark:border-[#2a3942] overflow-hidden flex flex-col md:flex-row min-h-0 shadow-sm">
          {/* Left */}
          <div className={cn("w-full md:w-[340px] flex-shrink-0 flex-col bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#2a3942]", showChatOnMobile ? "hidden md:flex" : "flex")}>
            <div className="px-3 py-3 border-b border-[#e9edef] dark:border-[#2a3942]">
              <div className="flex items-center gap-2 border-b-2 border-[#1099A1] px-2 py-2">
                <Search size={18} className="text-[#1099A1] shrink-0" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search or start new chat" className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#1099A1]" size={22} /></div>}
              {filtered.map((conv) => {
                const last = lastMessage(conv.messages);
                const unread = countUnread(conv.messages);
                const isActive = conv.id === activeConvId;
                return (
                  <div key={conv.id} onClick={() => openConversation(conv.id)}
                    className={cn("flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors", isActive ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]")}>
                    <div className="relative shrink-0">
                      <img src={conv.contact.avatar || avatarUrl(conv.contact.id)} alt={conv.contact.name} className="w-12 h-12 rounded-full object-cover" />
                      {conv.contact.isOnline && <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#97CE9D] border-2 border-white dark:border-[#111b21] rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#2a3942] pb-3">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="text-[15px] font-medium text-[#111] dark:text-[#e9edef] truncate">{conv.contact.name}</span>
                        <span className={cn("text-[12px] shrink-0 ml-1", unread > 0 ? "text-[#1099A1] font-medium" : "text-[#667781] dark:text-[#8696a0]")}>{last ? formatListDate(last.timestamp) : ""}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate flex-1">{last ? last.text : "No messages yet"}</span>
                        {unread > 0 && <div className="ml-2 bg-[#1099A1] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0">{unread}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {newContacts.map((p) => (
                <div key={p.id} onClick={() => startChat(p)}
                  className={cn("flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]", startingChatId !== null && "pointer-events-none opacity-60")}>
                  <div className="relative shrink-0">
                    <img src={p.avatar_url || avatarUrl(p.id)} alt={p.full_name} className="w-12 h-12 rounded-full object-cover" />
                    {onlineIds.has(p.id) && <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#97CE9D] border-2 border-white dark:border-[#111b21] rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#2a3942] pb-3">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-[15px] font-medium text-[#111] dark:text-[#e9edef] truncate">{p.full_name}</span>
                      {startingChatId === p.id && <Loader2 className="animate-spin text-[#1099A1] shrink-0 ml-1" size={14} />}
                    </div>
                    <span className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate capitalize">{p.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className={cn("flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a]", !showChatOnMobile ? "hidden md:flex" : "flex")}>
            {showChatOnMobile && (
              <div className="md:hidden bg-white dark:bg-[#111b21] px-4 py-2 border-b border-[#e9edef] dark:border-[#2a3942]">
                <button onClick={() => setShowChatOnMobile(false)} className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]"><ArrowLeft size={20} /></button>
              </div>
            )}
            {activeConv ? (
              <ChatPane activeConv={activeConv} setConversations={setConversations} showHeader isTyping={activeTyping} onTyping={notifyTyping} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                <MessageSquarePlus size={40} className="text-[#aebac1]" />
                <p className="text-[15px] font-semibold text-[#111] dark:text-white">No conversation selected</p>
                <p className="text-[13px] text-[#667781] dark:text-[#8696a0] max-w-xs">Pick a conversation, or start a new chat with a student.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
