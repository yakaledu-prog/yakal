import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Search, MoreVertical, Phone, Video,
  Paperclip, Smile, Mic, Check, CheckCheck,
  FileText, Send, Play, Pause, Trash2, ExternalLink
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { LiveAudioVisualizer } from 'react-audio-visualize';
import WaveSurfer from 'wavesurfer.js';
import {
  type Conversation,
  type Message,
} from "@/mock/chatData";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage as dbSendMessage, getOrCreateConversation } from "@/services/messageService";
import { cn } from "@/utils/cn";

// --- Brand Colors -------------------------------------------------------------
const CHAT_BG_LIGHT = "#f0faf0";
const CHAT_BG_DARK = "#0d2528";
const dotPatternLight = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='1.4' fill='%2397CE9D' opacity='0.35'/%3E%3C/svg%3E")`;
const dotPatternDark = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='1.4' fill='%231099A1' opacity='0.25'/%3E%3C/svg%3E")`;

const AVATAR_MAP: Record<string, string> = {
  "u1": "https://i.pravatar.cc/96?img=11",
  "u2": "https://i.pravatar.cc/96?img=16",
  "u3": "https://i.pravatar.cc/96?img=33",
  "u4": "https://i.pravatar.cc/96?img=47",
  "u5": "https://i.pravatar.cc/96?img=53",
  "current-user": "https://i.pravatar.cc/96?img=5",
  "ai-assistant": "https://api.dicebear.com/7.x/bottts/svg?seed=yakal",
};

export function avatarUrl(id: string): string {
  return AVATAR_MAP[id] ?? `https://i.pravatar.cc/96?u=${id}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatListDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return formatTime(date);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function formatDaySeparator(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export function groupByDay(messages: Message[]): { label: string; messages: Message[] }[] {
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

export function StatusTick({ status }: { status: Message["status"] }) {
  if (status === "sending") return <Check size={12} className="opacity-50" />;
  if (status === "sent") return <Check size={12} />;
  return <CheckCheck size={12} className="text-[#97CE9D]" />;
}

// Telegram-style welcome for a chat with no history yet: a quiet animated
// typing-bubble figure and a short prompt, on the chat's patterned background.
export function EmptyChatWelcome({ name }: { name: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 bg-white/85 dark:bg-[#182229]/85 backdrop-blur rounded-2xl px-8 py-7 max-w-xs text-center select-none">
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true">
          <rect x="8" y="14" width="54" height="36" rx="12" className="fill-[#1099A1]/10 stroke-[#1099A1]" strokeWidth="2" />
          <circle cx="25" cy="32" r="3" className="fill-[#1099A1] animate-pulse" />
          <circle cx="35" cy="32" r="3" className="fill-[#1099A1] animate-pulse [animation-delay:300ms]" />
          <circle cx="45" cy="32" r="3" className="fill-[#1099A1] animate-pulse [animation-delay:600ms]" />
          <rect x="40" y="54" width="40" height="26" rx="10" className="fill-transparent stroke-[#8696a0]" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
        <div>
          <p className="text-[15px] font-semibold text-[#111] dark:text-white">No messages here yet</p>
          <p className="text-[13px] text-[#667781] dark:text-[#8696a0] mt-1">
            Send a message to start the conversation with {name}.
          </p>
        </div>
      </div>
    </div>
  );
}

export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="min-w-[20px] h-5 px-1.5 bg-[#1099A1] text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none">
      {count}
    </span>
  );
}

function AudioPlayer({ url, isMe }: { url: string; isMe: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState("0:00");
  const [currentTime, setCurrentTime] = useState("0:00");

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isMe ? 'rgba(255,255,255,0.5)' : 'rgba(16,153,161,0.5)',
      progressColor: isMe ? '#ffffff' : '#087b82',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 30,
      url,
    });

    ws.on('ready', () => {
      const d = ws.getDuration();
      setDuration(`${Math.floor(d / 60)}:${Math.floor(d % 60).toString().padStart(2, '0')}`);
    });

    ws.on('audioprocess', () => {
      const t = ws.getCurrentTime();
      setCurrentTime(`${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`);
    });

    ws.on('finish', () => setIsPlaying(false));

    waveSurferRef.current = ws;
    return () => ws.destroy();
  }, [url, isMe]);

  const togglePlay = () => {
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause();
      setIsPlaying(waveSurferRef.current.isPlaying());
    }
  };

  return (
    <div className="flex items-center gap-3 w-[200px] md:w-[250px]">
      <button onClick={togglePlay} className="w-10 h-10 shrink-0 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center hover:scale-105 transition-transform">
        {isPlaying ? <Pause size={20} className={isMe ? "text-white" : "text-[#111] dark:text-white"} /> : <Play size={20} className={isMe ? "text-white ml-1" : "text-[#111] dark:text-white ml-1"} />}
      </button>
      <div className="flex-1 overflow-hidden">
        <div ref={containerRef} className="w-full" />
        <div className="text-[11px] mt-1 opacity-70">
          {isPlaying ? currentTime : duration}
        </div>
      </div>
    </div>
  );
}

export function MessageBubble({ msg, contact, isConsecutive, currentUserId }: { msg: Message; contact?: Conversation["contact"]; isConsecutive?: boolean; currentUserId?: string }) {
  const isMe = msg.senderId === currentUserId;
  const isOnlyEmoji = !msg.attachment && /^[\p{Extended_Pictographic}\s]+$/u.test(msg.text || "");

  if (isOnlyEmoji && msg.text.trim().length > 0) {
    return (
      <div className={cn("flex gap-2 w-full", isMe ? "justify-end" : "justify-start items-end")}>
        {!isMe && (
          <div className="w-8 shrink-0 flex items-end pb-0.5">
            {contact && !isConsecutive && (
              <img src={avatarUrl(contact.id)} alt={contact.name} className="w-8 h-8 rounded-full object-cover" />
            )}
          </div>
        )}
        <div className="flex flex-col mb-1 relative group pr-2">
          <div className="text-5xl leading-none">{msg.text}</div>
          <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 right-0">
            <span className="text-[10px] text-[#667781] dark:text-[#aebac1] drop-shadow-sm">{formatTime(msg.timestamp)}</span>
            {isMe && <span className="text-[#667781] dark:text-[#aebac1] drop-shadow-sm"><StatusTick status={msg.status} /></span>}
          </div>
        </div>
      </div>
    );
  }

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
          "relative max-w-[75%] md:max-w-[65%] px-3 pt-2 pb-1 rounded-md text-[14.5px] leading-relaxed shadow-sm",
          isMe
            ? "bg-[#1099A1] text-white border-b-[3px] border-[#087b82] rounded-br-sm"
            : "bg-white dark:bg-[#1f3a3d] text-[#111] dark:text-[#e2e8f0] border-b-[3px] border-black/10 dark:border-black/30 rounded-bl-sm"
        )}
      >
        {!isMe && contact && !isConsecutive && (
          <div className="text-[13px] font-semibold text-[#1099A1] mb-0.5 leading-tight">{contact.name}</div>
        )}

        {msg.attachment && (
          <div className={cn("mb-1", msg.text ? "pb-2" : "")}>
            {msg.attachment.type === 'image' && (
              <img src={msg.attachment.url} alt="Attachment" className="rounded-md max-h-[250px] object-cover" />
            )}
            {msg.attachment.type === 'video' && (
              <video src={msg.attachment.url} controls className="rounded-md max-h-[250px] w-full bg-black" />
            )}
            {msg.attachment.type === 'audio' && (
              <AudioPlayer url={msg.attachment.url} isMe={isMe} />
            )}
            {msg.attachment.type === 'file' && (
              <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-md min-w-[200px]">
                <div className="p-2 bg-[#1099A1] text-white rounded-full"><FileText size={20} /></div>
                <div className="overflow-hidden flex-1">
                  <div className="font-medium text-[13.5px] truncate">{msg.attachment.name || 'File'}</div>
                  <div className="text-[11px] opacity-70 mt-0.5">
                    {msg.attachment.size ? `${(msg.attachment.size / 1024).toFixed(1)} KB` : 'Unknown size'} • {msg.attachment.type.toUpperCase()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

        <div className={cn("flex items-center justify-end gap-1 mt-0.5 select-none", msg.text ? "float-right relative top-1 ml-3" : "")}>
          <span className={cn("text-[10px]", isMe ? "text-white/80" : "text-[#667781] dark:text-[#8696a0]")}>
            {formatTime(msg.timestamp)}
          </span>
          {isMe && (
            <span className="text-white/80">
              <StatusTick status={msg.status} />
            </span>
          )}
        </div>
        <div className="clear-both" />
      </div>
    </div>
  );
}

export function ChatPane({
  activeConv,
  setConversations,
  showHeader = false,
  onProfileClick,
  onExpandChat,
  isTyping = false,
  onTyping,
  initialInputText = "",
}: {
  activeConv: Conversation;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  showHeader?: boolean;
  onProfileClick?: () => void;
  onExpandChat?: () => void;
  isTyping?: boolean;
  onTyping?: () => void;
  initialInputText?: string;
}) {
  const { user } = useAuth();
  const [inputText, setInputText] = useState(initialInputText);

  useEffect(() => {
    if (initialInputText) {
      setInputText(initialInputText);
    }
  }, [initialInputText]);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isDark, setIsDark] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const messageGroups = groupByDay(activeConv.messages || []);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv.id, activeConv.messages?.length]);

  async function sendMessage() {
    const text = inputText.trim();
    if (!text || !user) return;
    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConv.id,
      senderId: user.id,
      text,
      timestamp: new Date(),
      status: "sending",
      isRead: false,
    };
    
    setConversations((prev) =>
      prev.map((c) => c.id === activeConv.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c)
    );
    setInputText("");

    if (activeConv.id !== "conv-ai") {
      try {
        let conversationId = activeConv.id;
        if (conversationId.startsWith("conv-")) {
          conversationId = await getOrCreateConversation(user.id, activeConv.contact.id);
        }
        await dbSendMessage(conversationId, user.id, text, 'text');
        setConversations((prev) =>
          prev.map((c) => c.id === activeConv.id
            ? { ...c, messages: (c.messages || []).map((m) => m.id === newMsg.id ? { ...m, status: "sent" as const } : m) }
            : c)
        );
      } catch (err) {
        console.error("Failed to send message", err);
      }
    }

    if (activeConv.id === "conv-ai") {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
      if (!apiKey) {
        setTimeout(() => {
          setConversations((prev) => prev.map((c) => c.id === activeConv.id ? {
            ...c,
            messages: [...c.messages, {
              id: `msg-ai-${Date.now()}`,
              conversationId: activeConv.id,
              senderId: "ai-assistant",
              text: "I am currently running in offline mode. To use my full AI capabilities, please configure the system settings by adding GEMINI_API_KEY.",
              timestamp: new Date(),
              status: "delivered",
              isRead: true,
            }]
          } : c));
        }, 1000);
        return;
      }

      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text }] }]
          })
        });
        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that.";

        setConversations((prev) => prev.map((c) => c.id === activeConv.id ? {
          ...c,
          messages: [...c.messages, {
            id: `msg-ai-${Date.now()}`,
            conversationId: activeConv.id,
            senderId: "ai-assistant",
            text: aiText,
            timestamp: new Date(),
            status: "delivered",
            isRead: true,
          }]
        } : c));
      } catch (err) {
        console.error(err);
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const handleEmojiClick = (emojiObj: any) => {
    setInputText((prev) => prev + emojiObj.emoji);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    let type: "image" | "video" | "audio" | "file" = "file";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("audio/")) type = "audio";

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConv.id,
      senderId: user?.id || "",
      text: "",
      timestamp: new Date(),
      status: "sent",
      isRead: false,
      attachment: { type, url, name: file.name, size: file.size }
    };
    setConversations((prev) =>
      prev.map((c) => c.id === activeConv.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c)
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access denied", err);
      // Fallback if no mic
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopTracks = () => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const cancelRecording = () => {
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
    setRecordingSeconds(0);
  };

  const sendRecording = () => {
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);

        const newMsg: Message = {
          id: `msg-${Date.now()}`,
          conversationId: activeConv.id,
          senderId: user?.id || "",
          text: "",
          timestamp: new Date(),
          status: "sent",
          isRead: false,
          attachment: { type: 'audio', url, duration: recordingSeconds }
        };
        setConversations((prev) =>
          prev.map((c) => c.id === activeConv.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c)
        );
        stopTracks();
      };
      mediaRecorderRef.current.stop();
    } else {
      // Mock sending if no mic
      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        conversationId: activeConv.id,
        senderId: user?.id || "",
        text: `🎤 [Audio Message: ${Math.floor(recordingSeconds / 60)}:${recordingSeconds % 60}]`,
        timestamp: new Date(),
        status: "sent",
        isRead: false,
      };
      setConversations((prev) =>
        prev.map((c) => c.id === activeConv.id ? { ...c, messages: [...(c.messages || []), newMsg] } : c)
      );
      stopTracks();
    }
    setRecordingSeconds(0);
  };

  const formatListDate = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    if (diffDays === 0) return formatTime(date);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-transparent h-full">
      {/* Optional Header */}
      {showHeader && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942]">
          <button
            className="flex-1 flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer text-left"
            onClick={onProfileClick}
          >
            <div className="relative">
              <img src={avatarUrl(activeConv.contact.id)} alt={activeConv.contact.name} className="w-10 h-10 rounded-full object-cover" />
              {activeConv.contact.isOnline && (
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-[#97CE9D] border-2 border-[#f0f2f5] dark:border-[#202c33] rounded-full" />
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#111] dark:text-[#e9edef] truncate">{activeConv.contact.name}</h2>
              <p className={cn("text-[12px]", isTyping || activeConv.contact.isOnline ? "text-[#1099A1]" : "text-[#667781] dark:text-[#8696a0]")}>
                {isTyping ? "typing…" : activeConv.contact.isOnline ? "online" : `last seen ${formatListDate(activeConv.contact.lastSeen)}`}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-0.5 text-[#54656f] dark:text-[#aebac1] shrink-0">
            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><Search size={20} /></button>
            <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"><MoreVertical size={20} /></button>
          </div>
        </div>
      )}

      {/* Message History with branded pattern bg */}
      <div
        className="flex-1 overflow-y-auto px-[5%] py-4 space-y-3"
        style={{
          backgroundColor: isDark ? CHAT_BG_DARK : CHAT_BG_LIGHT,
          backgroundImage: isDark ? dotPatternDark : dotPatternLight,
        }}
      >
        {messageGroups.length === 0 && <EmptyChatWelcome name={activeConv.contact.name} />}
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
                  currentUserId={user?.id}
                />
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="relative flex items-center gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942]">
        {showEmojiPicker && (
          <div className="absolute bottom-[60px] left-4 z-50 shadow-lg rounded-xl overflow-hidden">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={isDark ? Theme.DARK : Theme.LIGHT}
            />
          </div>
        )}

        {!isRecording ? (
          <>
            {onExpandChat && (
              <button
                onClick={onExpandChat}
                className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors shrink-0"
                title="Expand chat"
              >
                <ExternalLink size={24} />
              </button>
            )}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn("p-2 transition-colors", showEmojiPicker ? "text-[#1099A1]" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1]")}
            >
              <Smile size={24} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors"
            >
              <Paperclip size={24} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <textarea
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                onTyping?.();
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowEmojiPicker(false)}
              placeholder="Type a message"
              rows={1}
              className="flex-1 bg-white dark:bg-[#2a3942] text-[15px] text-[#111] dark:text-white placeholder:text-[#8696a0] rounded-xl px-4 py-2.5 outline-none resize-none leading-[1.4] max-h-[120px] overflow-y-auto"
              style={{ height: "42px" }}
            />

            {inputText.trim() ? (
              <button
                onClick={sendMessage}
                className="w-[42px] h-[42px] rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] active:scale-95 transition-all shrink-0"
              >
                <Send size={18} className="text-white -ml-0.5 mt-0.5" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="w-10 h-10 rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] transition-colors shrink-0"
              >
                <Mic size={20} />
              </button>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center gap-3">
            <button
              onClick={cancelRecording}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
            >
              <Trash2 size={24} />
            </button>

            <div className="flex-1 flex items-center gap-3 bg-white dark:bg-[#2a3942] rounded-xl py-2 px-4 overflow-hidden">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[#111] dark:text-white font-medium text-[15px]">
                  {Math.floor(recordingSeconds / 60)}:{recordingSeconds % 60 < 10 ? '0' : ''}{recordingSeconds % 60}
                </span>
              </div>

              {mediaRecorderRef.current && (
                <div className="h-6 flex-1 overflow-hidden hidden sm:flex items-center">
                  <LiveAudioVisualizer
                    mediaRecorder={mediaRecorderRef.current}
                    width={400}
                    height={24}
                    barWidth={2}
                    gap={2}
                    barColor="#f87171"
                  />
                </div>
              )}
            </div>

            <button
              onClick={sendRecording}
              className="w-[42px] h-[42px] rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] active:scale-95 transition-all shrink-0"
            >
              <Send size={18} className="text-white -ml-0.5 mt-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
