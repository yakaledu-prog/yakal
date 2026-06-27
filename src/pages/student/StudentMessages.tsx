import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Search, MoreVertical, Phone, Video,
  Paperclip, Smile, Mic, Check, CheckCheck,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatListDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return formatTime(date);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7)
    return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDaySeparator(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/** Group messages by day for day-separator rendering */
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

// ─── Sub-components ───────────────────────────────────────────────────────────

/** The read-receipt / status tick rendered inside sent messages */
function StatusTick({ status }: { status: Message["status"] }) {
  if (status === "sending") return <Check size={12} className="opacity-50" />;
  if (status === "sent") return <Check size={12} />;
  if (status === "delivered") return <CheckCheck size={12} />;
  // "read" → blue double-tick
  return <CheckCheck size={12} className="text-blue-400" />;
}

/** Single message bubble */
function MessageBubble({ msg }: { msg: Message }) {
  const isMe = msg.senderId === currentUser.id;
  return (
    <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[75%] md:max-w-[65%] px-3 pt-2 pb-1 rounded-lg text-[14.5px] leading-relaxed shadow-sm",
          isMe
            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111] dark:text-white rounded-tr-none"
            : "bg-white dark:bg-[#202c33] text-[#111] dark:text-white rounded-tl-none"
        )}
      >
        <p className="whitespace-pre-wrap break-words pr-10">{msg.text}</p>
        {/* Timestamp + read receipt row — floated to bottom-right inside bubble */}
        <div className="flex items-center justify-end gap-1 mt-0.5 select-none">
          <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">
            {formatTime(msg.timestamp)}
          </span>
          {isMe && (
            <span className="text-[#667781] dark:text-[#8696a0]">
              <StatusTick status={msg.status} />
            </span>
          )}
        </div>
        {/* Corner tail */}
        {isMe ? (
          <svg
            className="absolute -right-[7px] top-0 text-[#d9fdd3] dark:text-[#005c4b]"
            width="8" height="13" viewBox="0 0 8 13" fill="currentColor"
          >
            <path d="M5.188.039C5.063-.052 0 0 0 0l.825 5.975C1.813 3.477 4.45 1.109 5.188.039z" />
          </svg>
        ) : (
          <svg
            className="absolute -left-[7px] top-0 text-white dark:text-[#202c33]"
            width="8" height="13" viewBox="0 0 8 13" fill="currentColor"
          >
            <path d="M2.812.039C2.937-.052 8 0 8 0L7.175 5.975C6.187 3.477 3.55 1.109 2.812.039z" />
          </svg>
        )}
      </div>
    </div>
  );
}

/** Unread count badge */
function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="min-w-[18px] h-[18px] px-1 bg-[#25d366] text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
      {count}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StudentMessages() {
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const [activeConvId, setActiveConvId] = useState<string>(conversations[0].id);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId)!;

  // Scroll to bottom whenever the active conversation or messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvId, activeConv?.messages.length]);

  // Mark messages as read when switching conversations
  function openConversation(convId: string) {
    setActiveConvId(convId);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              unreadCount: 0,
              messages: c.messages.map((m) =>
                m.senderId !== currentUser.id ? { ...m, isRead: true } : m
              ),
            }
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
      prev.map((c) =>
        c.id === activeConvId ? { ...c, messages: [...c.messages, newMsg] } : c
      )
    );
    setInputText("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const filtered = conversations.filter((c) =>
    c.contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const messageGroups = groupByDay(activeConv.messages);

  return (
    // Full-height container that fills the parent's scrollable content area
    <div className="flex flex-1 overflow-hidden bg-[#f0f2f5] dark:bg-[#111b21]">

      {/* ── Left Pane ─────────────────────────────────────────── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#2a3942]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33]">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-10 h-10 rounded-full object-cover cursor-pointer"
          />
          <div className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]">
            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5">
            <Search size={16} className="text-[#54656f] dark:text-[#aebac1] shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or start new chat"
              className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
            />
          </div>
        </div>

        {/* Conversation list */}
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
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                  isActive
                    ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
                    : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
                )}
              >
                {/* Avatar + online dot */}
                <div className="relative shrink-0">
                  <img
                    src={conv.contact.avatar}
                    alt={conv.contact.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {conv.contact.isOnline && (
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-[#25d366] border-2 border-white dark:border-[#111b21] rounded-full" />
                  )}
                </div>

                {/* Name + snippet */}
                <div className="flex-1 min-w-0 border-b border-[#e9edef] dark:border-[#2a3942] pb-3">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-[15px] font-medium text-[#111] dark:text-[#e9edef] truncate">
                      {conv.contact.name}
                    </span>
                    <span
                      className={cn(
                        "text-[12px] shrink-0",
                        unread > 0
                          ? "text-[#25d366] font-medium"
                          : "text-[#667781] dark:text-[#8696a0]"
                      )}
                    >
                      {last ? formatListDate(last.timestamp) : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">
                      {last?.senderId === currentUser.id && (
                        <span className="mr-0.5 text-[#667781]">
                          <CheckCheck size={14} className={cn("inline-block", last.status === "read" ? "text-blue-400" : "")} />
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

      {/* ── Right Pane ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={activeConv.contact.avatar}
                alt={activeConv.contact.name}
                className="w-10 h-10 rounded-full object-cover"
              />
              {activeConv.contact.isOnline && (
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-[#25d366] border-2 border-[#f0f2f5] dark:border-[#202c33] rounded-full" />
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#111] dark:text-[#e9edef]">
                {activeConv.contact.name}
              </h2>
              <p className="text-[12px] text-[#667781] dark:text-[#8696a0]">
                {activeConv.contact.isOnline
                  ? "online"
                  : `last seen ${formatListDate(activeConv.contact.lastSeen)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[#54656f] dark:text-[#aebac1]">
            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Video size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Phone size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Search size={20} />
            </button>
            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Message history – WhatsApp tiled background */}
        <div
          className="flex-1 overflow-y-auto px-[5%] py-4 space-y-1"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23e5ddd5'/%3E%3C/svg%3E\")",
            backgroundSize: "auto",
          }}
        >
          <div className="dark:hidden absolute inset-0 pointer-events-none" style={{ background: "#e5ddd5" }} />

          {messageGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              {/* Day separator */}
              <div className="flex justify-center my-4">
                <span className="bg-white dark:bg-[#182229] text-[#667781] dark:text-[#8696a0] text-[12.5px] font-medium px-3 py-1 rounded-full shadow-sm select-none">
                  {group.label}
                </span>
              </div>

              {group.messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>
          ))}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33]">
          <button className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white transition-colors">
            <Smile size={24} />
          </button>
          <button className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white transition-colors">
            <Paperclip size={24} />
          </button>

          {/* Single-line textarea that grows with content like WhatsApp */}
          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              // Auto-resize: reset then set to scrollHeight (capped at ~120px)
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            rows={1}
            className="flex-1 bg-white dark:bg-[#2a3942] text-[15px] text-[#111] dark:text-white placeholder:text-[#8696a0] rounded-lg px-4 py-2.5 outline-none resize-none leading-[1.4] max-h-[120px] overflow-y-auto"
            style={{ height: "40px" }}
          />

          {inputText.trim() ? (
            <button
              onClick={sendMessage}
              className="w-10 h-10 rounded-full bg-[#00a884] dark:bg-[#00a884] flex items-center justify-center text-white hover:bg-[#02926f] transition-colors shrink-0"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 rotate-45 -translate-x-0.5">
                <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z" />
              </svg>
            </button>
          ) : (
            <button className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white hover:bg-[#02926f] transition-colors shrink-0">
              <Mic size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
