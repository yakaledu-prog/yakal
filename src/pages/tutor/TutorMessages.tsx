import { useState, useEffect } from "react";
import {
  Search, Phone, Video, X,
  Image as ImageIcon, Link as LinkIcon, FileText, Volume2,
  BellOff, ArrowLeft, MessageSquarePlus, Loader2
} from "lucide-react";
import {
  countUnread,
  lastMessage,
  type Conversation,
} from "@/mock/chatData";
import { cn } from "@/utils/cn";
import { ChatPane, avatarUrl, formatListDate } from "@/components/chat/ChatPane";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getConversations, getContacts, getOrCreateConversation,
  subscribeToMessages, mapDbToLocalConversations, type Contact,
} from "@/services/messageService";

function MinimalStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
    </div>
  );
}

// ─── Tutor Mock Data ─────────────────────────────────────────────────────────
const TUTOR_COURSES: Record<string, { subject: string; level: string; sessions: number }[]> = {
  u1: [
    { subject: "Calculus II", level: "Intermediate", sessions: 34 },
    { subject: "Calculus I", level: "Beginner", sessions: 51 },
    { subject: "Pre-Calculus", level: "Beginner", sessions: 18 },
  ],
  u3: [
    { subject: "Physics (Mechanics)", level: "Intermediate", sessions: 27 },
    { subject: "Physics (Electromagnetism)", level: "Advanced", sessions: 14 },
  ],
  u5: [
    { subject: "Data Structures", level: "Intermediate", sessions: 42 },
    { subject: "Algorithms", level: "Advanced", sessions: 29 },
    { subject: "Python Basics", level: "Beginner", sessions: 56 },
  ],
};

const TUTOR_AVAILABILITY: Record<string, { day: string; slots: string[] }[]> = {
  u1: [
    { day: "Mon", slots: ["10:00 AM", "2:00 PM"] },
    { day: "Tue", slots: [] },
    { day: "Wed", slots: ["11:00 AM"] },
    { day: "Thu", slots: ["3:00 PM", "5:00 PM"] },
    { day: "Fri", slots: ["10:00 AM"] },
    { day: "Sat", slots: [] },
  ],
  u3: [
    { day: "Mon", slots: ["9:00 AM"] },
    { day: "Tue", slots: ["1:00 PM", "4:00 PM"] },
    { day: "Wed", slots: [] },
    { day: "Thu", slots: ["9:00 AM"] },
    { day: "Fri", slots: [] },
    { day: "Sat", slots: ["10:00 AM", "12:00 PM"] },
  ],
  u5: [
    { day: "Mon", slots: ["3:00 PM"] },
    { day: "Tue", slots: ["3:00 PM"] },
    { day: "Wed", slots: ["3:00 PM"] },
    { day: "Thu", slots: ["3:00 PM"] },
    { day: "Fri", slots: [] },
    { day: "Sat", slots: [] },
  ],
};

// ─── Contact Profile Panel (Telegram-style) ───────────────────────────────────
function ContactProfilePanel({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const isTutor = conv.contact.role === "Tutor";
  const [activeTab, setActiveTab] = useState<"media" | "links" | "files" | "courses" | "availability">("media");

  const tutorCourses = TUTOR_COURSES[conv.contact.id] ?? [];
  const tutorAvailability = TUTOR_AVAILABILITY[conv.contact.id] ?? [];

  const mockMedia = [
    "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=150&q=70",
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=150&q=70",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=150&q=70",
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=150&q=70",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=150&q=70",
    "https://images.unsplash.com/photo-1546521343-4eb2c01aa44b?w=150&q=70",
  ];

  const mockLinks = [
    { title: "Calc II Problem Set 4", url: "portal.yakal.edu/files/calc-ps4" },
    { title: "Physics Lab Report Template", url: "portal.yakal.edu/files/lab-template" },
    { title: "Session Recording – Nov 14", url: "portal.yakal.edu/recordings/nov14" },
  ];

  const mockFiles = [
    { name: "Integration_Notes.pdf", size: "2.4 MB" },
    { name: "Study_Guide_Midterm.docx", size: "1.1 MB" },
    { name: "Session_Transcript.txt", size: "48 KB" },
  ];

  const levelColor = (level: string) => {
    if (level === "Beginner") return "bg-[#97CE9D]/20 text-[#2d7a54]";
    if (level === "Intermediate") return "bg-[#1099A1]/10 text-[#1099A1]";
    return "bg-[#CAA25F]/15 text-[#8a6a2a]";
  };

  return (
    <div className="w-[300px] flex-shrink-0 flex flex-col border-l border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] overflow-y-auto animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33]">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-[#54656f] dark:text-[#aebac1]">
          <X size={18} />
        </button>
        <span className="text-[15px] font-semibold text-[#111] dark:text-white">Contact info</span>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-2 py-6 px-4 border-b border-[#e9edef] dark:border-[#2a3942]">
        <img
          src={avatarUrl(conv.contact.id)}
          alt={conv.contact.name}
          className="w-24 h-24 rounded-full object-cover ring-4 ring-[#97CE9D]/30"
        />
        <div className="text-center">
          <h2 className="text-lg font-bold text-[#111] dark:text-white">{conv.contact.name}</h2>
          <span className={cn(
            "text-xs font-medium px-2.5 py-0.5 rounded-full",
            conv.contact.role === "Tutor"
              ? "bg-[#1099A1]/10 text-[#1099A1]"
              : "bg-[#97CE9D]/20 text-[#2d7a54]"
          )}>
            {conv.contact.role}
          </span>
          <p className={cn("text-[13px] mt-1", conv.contact.isOnline ? "text-[#1099A1]" : "text-[#667781] dark:text-[#8696a0]")}>
            {conv.contact.isOnline ? "online" : `last seen ${formatListDate(conv.contact.lastSeen)}`}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-around py-4 border-b border-[#e9edef] dark:border-[#2a3942]">
        {[
          { icon: <Phone size={20} />, label: "Audio" },
          { icon: <Video size={20} />, label: "Video" },
          { icon: <BellOff size={20} />, label: "Mute" },
          { icon: <Search size={20} />, label: "Search" },
        ].map(({ icon, label }) => (
          <button key={label} className="flex flex-col items-center gap-1 text-[#1099A1] hover:opacity-75 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-[#1099A1]/10 flex items-center justify-center">
              {icon}
            </div>
            <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">{label}</span>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-[#e9edef] dark:border-[#2a3942] scrollbar-none">
        {([
          { key: "media", label: "Media", icon: <ImageIcon size={12} /> },
          { key: "links", label: "Links", icon: <LinkIcon size={12} /> },
          { key: "files", label: "Files", icon: <FileText size={12} /> },
          ...(isTutor ? [
            { key: "courses", label: "Courses", icon: <Volume2 size={12} /> },
            { key: "availability", label: "Hours", icon: <Phone size={12} /> },
          ] : []),
        ] as { key: typeof activeTab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex-shrink-0 px-3 py-2.5 text-[12px] font-medium transition-colors flex items-center gap-1",
              activeTab === key
                ? "text-[#1099A1] border-b-2 border-[#1099A1]"
                : "text-[#667781] dark:text-[#8696a0] hover:text-[#111] dark:hover:text-white"
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-3">
        {activeTab === "media" && (
          <div className="grid grid-cols-3 gap-1">
            {mockMedia.map((src, i) => (
              <img key={i} src={src} alt="" className="w-full aspect-square object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity" />
            ))}
          </div>
        )}
        {activeTab === "links" && (
          <div className="space-y-3">
            {mockLinks.map((link, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] cursor-pointer transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#1099A1]/10 flex items-center justify-center shrink-0">
                  <LinkIcon size={14} className="text-[#1099A1]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#1099A1] truncate">{link.title}</p>
                  <p className="text-[11px] text-[#667781]">{link.url}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "files" && (
          <div className="space-y-2">
            {mockFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] cursor-pointer transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[#1099A1]/10 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-[#1099A1]" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#111] dark:text-white truncate">{file.name}</p>
                  <p className="text-[11px] text-[#667781]">{file.size}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "courses" && (
          <div className="space-y-3">
            {tutorCourses.length === 0 ? (
              <p className="text-[13px] text-[#667781] text-center py-4">No courses listed.</p>
            ) : tutorCourses.map((c, i) => (
              <div key={i} className="p-3 rounded-xl border border-[#e9edef] dark:border-[#2a3942] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[#111] dark:text-white leading-tight">{c.subject}</p>
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0", levelColor(c.level))}>
                    {c.level}
                  </span>
                </div>
                <p className="text-[12px] text-[#667781] dark:text-[#8696a0] mt-1">{c.sessions} sessions completed</p>
                <button className="mt-2 w-full py-1.5 rounded-lg bg-[#1099A1]/10 text-[#1099A1] text-[12px] font-medium hover:bg-[#1099A1]/20 transition-colors">
                  Book a session
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "availability" && (
          <div className="space-y-2">
            <p className="text-[11px] text-[#667781] dark:text-[#8696a0] mb-3">Weekly availability (1-hour slots)</p>
            {tutorAvailability.length === 0 ? (
              <p className="text-[13px] text-[#667781] text-center py-4">No schedule listed.</p>
            ) : tutorAvailability.map((day, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-8 text-[12px] font-semibold text-[#111] dark:text-white pt-0.5 shrink-0">{day.day}</span>
                <div className="flex-1">
                  {day.slots.length === 0 ? (
                    <span className="text-[12px] text-[#8696a0] italic">Unavailable</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {day.slots.map((slot, j) => (
                        <button
                          key={j}
                          className="px-2.5 py-1 rounded-lg bg-[#97CE9D]/20 text-[#2d7a54] dark:text-[#97CE9D] text-[12px] font-medium hover:bg-[#97CE9D]/40 transition-colors"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="mt-4 pt-3 border-t border-[#e9edef] dark:border-[#2a3942]">
              <button className="w-full py-2 rounded-xl bg-[#1099A1] text-white text-[13px] font-semibold hover:bg-[#0d7f86] transition-colors">
                Request a Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TutorMessages() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dbConversations, isLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => getConversations(user!.id),
    enabled: !!user,
  });

  // Every other profile in the app (the seeded demo users) is a potential chat.
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', user?.id],
    queryFn: () => getContacts(user!.id),
    enabled: !!user,
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showChatOnMobile, setShowChatOnMobile] = useState(false);
  const [startingChatId, setStartingChatId] = useState<string | null>(null);

  useEffect(() => {
    if (dbConversations) {
      setConversations(mapDbToLocalConversations(dbConversations));
      if (!activeConvId && dbConversations.length > 0) setActiveConvId(dbConversations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbConversations]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToMessages(() => {
      queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
    });
    return () => unsubscribe();
  }, [user, queryClient]);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  function openConversation(convId: string) {
    setActiveConvId(convId);
    setShowProfile(false);
    setShowChatOnMobile(true);
    // Mark as read
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, unreadCount: 0, messages: c.messages.map((m) => ({ ...m, isRead: true })) }
          : c
      )
    );
  }

  async function startChat(contact: Contact) {
    if (!user || startingChatId) return;
    setStartingChatId(contact.id);
    try {
      const convId = await getOrCreateConversation(user.id, contact.id);
      await queryClient.invalidateQueries({ queryKey: ['conversations', user.id] });
      setActiveConvId(convId);
      setShowChatOnMobile(true);
    } catch (err) {
      console.error("Failed to start conversation", err);
    } finally {
      setStartingChatId(null);
    }
  }

  const filtered = conversations.filter((c) =>
    c.contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Demo users you haven't chatted with yet, honoring the search box.
  const existingContactIds = new Set(conversations.map((c) => c.contact.id));
  const newContacts = contacts.filter(
    (p) => !existingContactIds.has(p.id) && p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageWrapper>
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] flex flex-col">
        {/* Massive Integrated Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="max-w-[1440px] mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Messages</h1>
                <p className="text-white/80 text-[15px]">Stay connected with your students and parents</p>
              </div>
              <div className="flex items-center gap-8">
                <MinimalStat label="Unread" value={conversations.reduce((acc, c) => acc + countUnread(c.messages), 0)} />
                <MinimalStat label="Contacts" value={conversations.length} />
              </div>
            </div>
          </div>
        </div>

        {/* Messaging Layout Container */}
        <div className="flex-1 max-w-[1440px] mx-auto w-full bg-white dark:bg-[#111b21] border-x border-[#e9edef] dark:border-[#2a3942] overflow-hidden flex flex-col md:flex-row min-h-0 shadow-sm">
          {/* ── Left Pane ────────────────────────────────────────────── */}
          <div className={cn(
            "w-full md:w-[340px] flex-shrink-0 flex-col bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#2a3942]",
            showChatOnMobile ? "hidden md:flex" : "flex"
          )}>
            {/* Search bar */}
            <div className="px-3 py-3 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
              <div className="flex items-center gap-2 border-b-2 border-[#1099A1] px-2 py-2 transition-colors">
                <Search size={18} className="text-[#1099A1] shrink-0" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search or start new chat"
                  className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
                />
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-[#1099A1]" size={22} />
                </div>
              )}
              {filtered.map((conv) => {
                const last = lastMessage(conv.messages);
                const unread = countUnread(conv.messages);
                const isActive = conv.id === activeConvId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => openConversation(conv.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors",
                      isActive ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                    )}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={conv.contact.avatar || avatarUrl(conv.contact.id)}
                        alt={conv.contact.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      {conv.contact.isOnline && (
                        <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#97CE9D] border-2 border-white dark:border-[#111b21] rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#2a3942] pb-3 -mb-0">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="text-[15px] font-medium text-[#111] dark:text-[#e9edef] truncate">{conv.contact.name}</span>
                        <span className={cn("text-[12px] shrink-0 ml-1", unread > 0 ? "text-[#1099A1] font-medium" : "text-[#667781] dark:text-[#8696a0]")}>
                          {last ? formatListDate(last.timestamp) : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate flex-1">
                          {last ? last.text : "No messages yet"}
                        </span>
                        {unread > 0 && (
                          <div className="ml-2 bg-[#1099A1] text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0">
                            {unread}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Users without a conversation yet, listed like any other chat */}
              {newContacts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => startChat(p)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]",
                    startingChatId !== null && "pointer-events-none opacity-60"
                  )}
                >
                  <div className="relative shrink-0">
                    <img
                      src={p.avatar_url || avatarUrl(p.id)}
                      alt={p.full_name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#2a3942] pb-3 -mb-0">
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

          {/* ── Chat Pane ────────────────────────────────────────────── */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a]",
            !showChatOnMobile ? "hidden md:flex" : "flex"
          )}>
            {showChatOnMobile && (
              <div className="md:hidden bg-white dark:bg-[#111b21] px-4 py-2 border-b border-[#e9edef] dark:border-[#2a3942]">
                <button
                  onClick={() => setShowChatOnMobile(false)}
                  className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]"
                >
                  <ArrowLeft size={20} />
                </button>
              </div>
            )}
            
            {activeConv ? (
              <ChatPane
                activeConv={activeConv}
                setConversations={setConversations}
                showHeader={true}
                onProfileClick={() => setShowProfile((v) => !v)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                <MessageSquarePlus size={40} className="text-[#aebac1]" />
                <p className="text-[15px] font-semibold text-[#111] dark:text-white">No conversation selected</p>
                <p className="text-[13px] text-[#667781] dark:text-[#8696a0] max-w-xs">
                  Pick a conversation on the left, or start a new chat with one of the users listed there.
                </p>
              </div>
            )}
          </div>

          {/* Profile Panel */}
          {showProfile && activeConv && (
            <ContactProfilePanel conv={activeConv} onClose={() => setShowProfile(false)} />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
