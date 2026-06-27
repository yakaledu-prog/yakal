import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Search, MoreVertical, Phone, Video,
  Paperclip, Smile, Mic, Check, CheckCheck, X,
  Image as ImageIcon, Link as LinkIcon, FileText, Volume2,
  BellOff,
} from "lucide-react";
import {
  mockConversations,
  currentUser,
  countUnread,
  lastMessage,
  type Conversation,
  type Message,
} from "@/mock/chatData";
import { cn } from "@/utils/cn";

// ─── Brand Colors ─────────────────────────────────────────────────────────────
// Primary: #1099A1 | Mint: #97CE9D | Gold: #CAA25F

// ─── Chat Background Pattern (brand-colored dot grid) ─────────────────────────
const CHAT_BG_LIGHT = "#f0faf0"; // very light mint
const CHAT_BG_DARK = "#0d2528";  // very dark teal

// SVG dot-grid pattern encoded as data URI
const dotPatternLight = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='1.4' fill='%2397CE9D' opacity='0.35'/%3E%3C/svg%3E")`;
const dotPatternDark = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='1.4' fill='%231099A1' opacity='0.25'/%3E%3C/svg%3E")`;

// ─── Reliable avatar helper ────────────────────────────────────────────────────
// pravatar.cc is extremely reliable – we map contact id → img index
const AVATAR_MAP: Record<string, string> = {
  "u1": "https://i.pravatar.cc/96?img=11",
  "u2": "https://i.pravatar.cc/96?img=16",
  "u3": "https://i.pravatar.cc/96?img=33",
  "u4": "https://i.pravatar.cc/96?img=47",
  "u5": "https://i.pravatar.cc/96?img=53",
  "current-user": "https://i.pravatar.cc/96?img=5",
};

function avatarUrl(id: string): string {
  return AVATAR_MAP[id] ?? `https://i.pravatar.cc/96?u=${id}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatListDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return formatTime(date);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDaySeparator(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function groupByDay(messages: Message[]): { label: string; messages: Message[] }[] {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = "";
  for (const msg of messages) {
    const label = formatDaySeparator(msg.timestamp);
    if (label !== currentLabel) {
      groups.push({ label, messages: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

// ─── Status Tick ──────────────────────────────────────────────────────────────
function StatusTick({ status }: { status: Message["status"] }) {
  if (status === "sending") return <Check size={12} className="opacity-50" />;
  if (status === "sent") return <Check size={12} />;
  if (status === "delivered") return <CheckCheck size={12} />;
  return <CheckCheck size={12} className="text-[#34b7f1]" />;
}

// ─── Unread Badge ─────────────────────────────────────────────────────────────
function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="min-w-[20px] h-5 px-1.5 bg-[#1099A1] text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
      {count}
    </span>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg, contact, isConsecutive }: { msg: Message; contact?: Conversation["contact"]; isConsecutive?: boolean }) {
  const isMe = msg.senderId === currentUser.id;
  return (
    <div className={cn("flex gap-2 w-full", isMe ? "justify-end" : "justify-start items-end")}>
      {!isMe && (
        <div className="w-8 shrink-0 flex items-end pb-0.5">
          {contact && !isConsecutive && (
            <img src={avatarUrl(contact.id)} alt={contact.name} className="w-8 h-8 rounded-full object-cover" />
          )}
        </div>
      )}
      <div
        className={cn(
          "relative max-w-[75%] md:max-w-[65%] px-3 pt-2 pb-1 rounded-xl text-[14.5px] leading-relaxed shadow-sm",
          isMe
            ? "bg-[#1099A1] text-white rounded-tr-none"
            : cn("bg-white dark:bg-[#1f3a3d] text-[#111] dark:text-[#e2e8f0]", !isConsecutive ? "rounded-bl-none" : "rounded-xl")
        )}
      >
        {!isMe && contact && !isConsecutive && (
          <div className="text-[13px] font-semibold text-[#1099A1] mb-0.5 leading-tight">{contact.name}</div>
        )}
        <p className="whitespace-pre-wrap break-words pr-12">{msg.text}</p>
        <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
          <span className={cn("text-[11px]", isMe ? "text-white/70" : "text-[#667781] dark:text-[#8696a0]")}>
            {formatTime(msg.timestamp)}
          </span>
          {isMe && (
            <span className="text-white/70">
              <StatusTick status={msg.status} />
            </span>
          )}
        </div>
        {/* Bubble tail */}
        {isMe ? (
          <svg className="absolute -right-[7px] top-0 text-[#1099A1]" width="8" height="13" viewBox="0 0 8 13" fill="currentColor">
            <path d="M5.188.039C5.063-.052 0 0 0 0l.825 5.975C1.813 3.477 4.45 1.109 5.188.039z" />
          </svg>
        ) : (
          !isConsecutive && (
            <svg className="absolute -left-[7px] bottom-0 text-white dark:text-[#1f3a3d]" width="8" height="13" viewBox="0 0 8 13" fill="currentColor">
              <path d="M2.812 12.961C2.937 13.052 8 13 8 13L7.175 7.025C6.187 9.523 3.55 11.891 2.812 12.961z" />
            </svg>
          )
        )}
      </div>
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
export function StudentMessages() {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeConvId, setActiveConvId] = useState<string>(conversations[0].id);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId)!;
  const messageGroups = groupByDay(activeConv.messages);

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, activeConv?.messages.length]);

  function openConversation(convId: string) {
    setActiveConvId(convId);
    setShowProfile(false);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, unreadCount: 0, messages: c.messages.map((m) => m.senderId !== currentUser.id ? { ...m, isRead: true } : m) }
          : c
      )
    );
  }

  function sendMessage() {
    const text = inputText.trim();
    if (!text) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConvId,
      senderId: currentUser.id,
      text,
      timestamp: new Date(),
      status: "sent",
      isRead: false,
    };
    setConversations((prev) =>
      prev.map((c) => c.id === activeConvId ? { ...c, messages: [...c.messages, newMsg] } : c)
    );
    setInputText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const filtered = conversations.filter((c) =>
    c.contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Left Pane ────────────────────────────────────────────── */}
      <div className="w-[340px] flex-shrink-0 flex flex-col bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#2a3942]">

        {/* Search bar only – tall */}
        <div className="px-3 py-3 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-xl px-3 py-2.5">
            <Search size={16} className="text-[#54656f] dark:text-[#aebac1] shrink-0" />
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
                    src={avatarUrl(conv.contact.id)}
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
                    <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate flex-1">
                      {last?.senderId === currentUser.id && (
                        <span className="mr-0.5">
                          <CheckCheck size={14} className={cn("inline-block", last.status === "read" ? "text-[#1099A1]" : "text-[#667781]")} />
                        </span>
                      )}
                      {last?.text}
                    </p>
                    {unread > 0 && <UnreadBadge count={unread} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Chat + Profile ─────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-w-0">

        {/* Chat Pane */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942]">
            <button
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer text-left"
              onClick={() => setShowProfile((v) => !v)}
            >
              <div className="relative">
                <img src={avatarUrl(activeConv.contact.id)} alt={activeConv.contact.name} className="w-10 h-10 rounded-full object-cover" />
                {activeConv.contact.isOnline && (
                  <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-[#97CE9D] border-2 border-[#f0f2f5] dark:border-[#202c33] rounded-full" />
                )}
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-[#111] dark:text-[#e9edef]">{activeConv.contact.name}</h2>
                <p className={cn("text-[12px]", activeConv.contact.isOnline ? "text-[#1099A1]" : "text-[#667781] dark:text-[#8696a0]")}>
                  {activeConv.contact.isOnline ? "online" : `last seen ${formatListDate(activeConv.contact.lastSeen)}`}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-0.5 text-[#54656f] dark:text-[#aebac1]">
              <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><Video size={20} /></button>
              <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><Phone size={20} /></button>
              <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><Search size={20} /></button>
              <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><MoreVertical size={20} /></button>
            </div>
          </div>

          {/* Message History with branded pattern bg */}
          <div
            className="flex-1 overflow-y-auto px-[5%] py-4 space-y-3"
            style={{
              backgroundColor: isDark ? CHAT_BG_DARK : CHAT_BG_LIGHT,
              backgroundImage: isDark ? dotPatternDark : dotPatternLight,
            }}
          >
            {messageGroups.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="flex justify-center my-4">
                  <span className="bg-white/80 dark:bg-[#182229]/80 backdrop-blur text-[#667781] dark:text-[#8696a0] text-[12.5px] font-medium px-3 py-1 rounded-full shadow-sm select-none">
                    {group.label}
                  </span>
                </div>
                {group.messages.map((msg, idx) => {
                  const isConsecutive = idx > 0 && group.messages[idx - 1].senderId === msg.senderId;
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      contact={activeConv.contact}
                      isConsecutive={isConsecutive}
                    />
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33]">
            <button className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors">
              <Smile size={24} />
            </button>
            <button className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors">
              <Paperclip size={24} />
            </button>
            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              rows={1}
              className="flex-1 bg-white dark:bg-[#2a3942] text-[15px] text-[#111] dark:text-white placeholder:text-[#8696a0] rounded-xl px-4 py-2.5 outline-none resize-none leading-[1.4] max-h-[120px] overflow-y-auto"
              style={{ height: "42px" }}
            />
            {inputText.trim() ? (
              <button
                onClick={sendMessage}
                className="w-10 h-10 rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] transition-colors shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 rotate-45 -translate-x-0.5">
                  <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
                </svg>
              </button>
            ) : (
              <button className="w-10 h-10 rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] transition-colors shrink-0">
                <Mic size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Profile Panel */}
        {showProfile && (
          <ContactProfilePanel conv={activeConv} onClose={() => setShowProfile(false)} />
        )}
      </div>
    </div>
  );
}
