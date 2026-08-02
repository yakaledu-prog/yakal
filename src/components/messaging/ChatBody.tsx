import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Paperclip, Smile, Mic, Send, Trash2, ExternalLink, Info, Flag } from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { LiveAudioVisualizer } from "react-audio-visualize";
import type { ChatConversation, ChatMessage } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import { groupByDay } from "./format";
import { MessageBubble, type LocalAttachment } from "./MessageBubble";

// ============================================================
// The conversation itself: history plus composer, and nothing else.
//
// Deliberately free of any sidebar or header, so it can be dropped into a
// context where who you are talking to is already obvious - the tutor's
// student detail page, or a course page - as well as into the full messages
// screen underneath a ChatHeader.
// ============================================================

const CHAT_BG_LIGHT = "#f0faf0";
const CHAT_BG_DARK = "#0d2528";
const dotPatternLight = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='1.4' fill='%2397CE9D' opacity='0.35'/%3E%3C/svg%3E")`;
const dotPatternDark = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='1.4' fill='%231099A1' opacity='0.25'/%3E%3C/svg%3E")`;

/** Quiet placeholder for a thread with no history yet. */
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

function TypingBubble() {
  return (
    <div className="flex gap-2 w-full justify-start items-end">
      <div className="w-8 shrink-0" />
      <div className="bg-white dark:bg-[#1f3a3d] rounded-md rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-[#8696a0] animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Tracks the app's light/dark class so the canvas and emoji picker follow it. */
function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export function ChatBody({
  conversation,
  currentUserId,
  onSendText,
  onTyping,
  onExpand,
  onOpenContactInfo,
  onFlag,
  isFlagged = false,
  messageReports,
  isPeerTyping = false,
  draft,
  readOnly = false,
  readOnlyNotice,
  readOnlyTooltip,
  className,
}: {
  conversation: ChatConversation;
  currentUserId?: string;
  onSendText?: (text: string) => void | Promise<void>;
  onTyping?: () => void;
  /** Shows a button to open this thread on the full messages page. */
  onExpand?: () => void;
  /**
   * Opens the contact panel from the composer. Used where the chat header is
   * hidden, so there is nothing else to click to see who this is.
   */
  onOpenContactInfo?: () => void;
  /** Opens the report dialog. Omit to hide the flag entirely. */
  onFlag?: () => void;
  /** Whether this person has already reported the conversation. */
  isFlagged?: boolean;
  /**
   * What the scan picked out, keyed by message id. Only the parent's
   * monitoring view passes this; for everyone else it stays undefined and no
   * bubble is marked.
   */
  messageReports?: Map<string, { severity: "high" | "medium"; label: string }>;
  isPeerTyping?: boolean;
  /** Pre-fills the composer, e.g. a message started from another page. */
  draft?: string;
  /** Hides the composer. Used for a parent viewing a child's chat. */
  readOnly?: boolean;
  readOnlyNotice?: string;
  /** Explains the restriction on hover, since the label has to stay short. */
  readOnlyTooltip?: string;
  className?: string;
}) {
  const isDark = useIsDark();
  const [inputText, setInputText] = useState(draft ?? "");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Attachments are held in the browser only: they are object URLs, and there
  // is no upload pipeline for chat media yet. They vanish on reload, which is
  // why they are kept apart from the persisted history rather than faked into
  // it.
  const [localAttachments, setLocalAttachments] = useState<
    { msg: ChatMessage; attachment: LocalAttachment }[]
  >([]);

  const historyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    setLocalAttachments([]);
    setInputText(draft ?? "");
  }, [conversation.id, draft]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [inputText]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Something the scan caught that this reader has not reported yet. Once they
  // have, the flag settles to solid gold and stops moving: it has done its job.
  const unreportedConcern = !!messageReports?.size && !isFlagged;
  const flagTitle = isFlagged
    ? "You reported this conversation"
    : unreportedConcern
      ? "We picked something out here. Have a look and report it."
      : "Report this conversation";

  const attachmentById = useMemo(
    () => new Map(localAttachments.map((l) => [l.msg.id, l.attachment])),
    [localAttachments]
  );

  const allMessages = useMemo(() => {
    const merged = [...conversation.messages, ...localAttachments.map((l) => l.msg)];
    return merged.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [conversation.messages, localAttachments]);

  const groups = useMemo(() => groupByDay(allMessages), [allMessages]);

  // Scroll the history itself rather than calling scrollIntoView on a bottom
  // marker: that walks up the tree and will scroll any scrollable ancestor
  // too, which pushed the contact header off the top of the page.
  useEffect(() => {
    const el = historyRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [conversation.id, allMessages.length, isPeerTyping]);

  async function submit() {
    const text = inputText.trim();
    if (!text || !onSendText) return;
    setInputText("");
    setShowEmojiPicker(false);
    await onSendText(text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  function addLocalAttachment(attachment: LocalAttachment, text = "") {
    const msg: ChatMessage = {
      id: `local-${Date.now()}`,
      conversationId: conversation.id,
      senderId: currentUserId ?? "",
      text,
      type: attachment.type,
      isRead: false,
      createdAt: new Date(),
    };
    setLocalAttachments((prev) => [...prev, { msg, attachment }]);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const type: LocalAttachment["type"] = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "file";
    addLocalAttachment({ type, url: URL.createObjectURL(file), name: file.name, size: file.size });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function beginTimer() {
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.start(100);
      beginTimer();
    } catch (err) {
      // No microphone, or permission refused. Still run the timer so the UI is
      // explorable; sendRecording falls back to a text placeholder.
      console.warn("Microphone unavailable", err);
      beginTimer();
    }
  }

  function stopTracks() {
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
  }

  function endRecording() {
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    recordingIntervalRef.current = null;
  }

  function cancelRecording() {
    endRecording();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
    setRecordingSeconds(0);
  }

  function sendRecording() {
    const seconds = recordingSeconds;
    endRecording();
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        addLocalAttachment({ type: "audio", url: URL.createObjectURL(blob) });
        stopTracks();
      };
      recorder.stop();
    } else {
      const mm = Math.floor(seconds / 60);
      const ss = (seconds % 60).toString().padStart(2, "0");
      void onSendText?.(`[Voice note, ${mm}:${ss}]`);
      stopTracks();
    }
    setRecordingSeconds(0);
  }

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden min-w-0 h-full", className)}>
      <div
        ref={historyRef}
        className="flex-1 overflow-y-auto px-[5%] py-4 space-y-3"
        style={{
          backgroundColor: isDark ? CHAT_BG_DARK : CHAT_BG_LIGHT,
          backgroundImage: isDark ? dotPatternDark : dotPatternLight,
        }}
      >
        {groups.length === 0 && !isPeerTyping && <EmptyChatWelcome name={conversation.contact.name} />}

        {groups.map((group) => (
          <div key={group.label} className="space-y-3">
            <div className="flex justify-center my-4">
              <span className="bg-white/80 dark:bg-[#182229]/80 backdrop-blur text-[#667781] dark:text-[#8696a0] text-[12.5px] font-medium px-3 py-1 rounded-full shadow-sm select-none">
                {group.label}
              </span>
            </div>
            {group.messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                contact={conversation.contact}
                isConsecutive={idx > 0 && group.messages[idx - 1].senderId === msg.senderId}
                currentUserId={currentUserId}
                attachment={attachmentById.get(msg.id)}
                report={messageReports?.get(msg.id)}
              />
            ))}
          </div>
        ))}

        {isPeerTyping && <TypingBubble />}
      </div>

      {readOnly ? (
        <div className="flex items-center gap-1 px-3 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942]">
          {onOpenContactInfo && (
            <button
              onClick={onOpenContactInfo}
              title="Contact info"
              aria-label="Contact info"
              className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors shrink-0"
            >
              <Info size={20} />
            </button>
          )}
          {onFlag && (
            <button
              onClick={onFlag}
              title={flagTitle}
              aria-label={flagTitle}
              className={cn(
                "p-2 transition-colors shrink-0",
                isFlagged || unreportedConcern
                  ? "text-[#CAA25F]"
                  : "text-[#54656f] dark:text-[#aebac1] hover:text-[#CAA25F]",
                unreportedConcern && "concern-pulse"
              )}
            >
              <Flag size={20} fill={isFlagged ? "currentColor" : "none"} />
            </button>
          )}
          <span className="flex flex-1 justify-end pr-1">
            <Tooltip
              side="top"
              content={
                readOnlyTooltip ??
                "You can read this conversation and report anything of concern, but not take part in it."
              }
            >
              <span
                tabIndex={0}
                className="cursor-help text-[12.5px] text-[#667781] underline decoration-dotted underline-offset-4 outline-none focus-visible:text-[#1099A1] dark:text-[#8696a0]"
              >
                {readOnlyNotice ?? "This conversation is read only."}
              </span>
            </Tooltip>
          </span>
        </div>
      ) : (
        <div className="relative flex items-center gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942]">
          {showEmojiPicker && (
            <div className="absolute bottom-[60px] left-4 z-50 shadow-lg rounded-xl overflow-hidden">
              <EmojiPicker
                onEmojiClick={(emoji: any) => setInputText((prev) => prev + emoji.emoji)}
                theme={isDark ? Theme.DARK : Theme.LIGHT}
              />
            </div>
          )}

          {!isRecording ? (
            <>
              {onExpand && (
                <button
                  onClick={onExpand}
                  title="Open in Messages"
                  className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors shrink-0"
                >
                  <ExternalLink size={22} />
                </button>
              )}
              {onOpenContactInfo && (
                <button
                  onClick={onOpenContactInfo}
                  title="Contact info"
                  aria-label="Contact info"
                  className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors shrink-0"
                >
                  <Info size={22} />
                </button>
              )}
              {onFlag && (
                <button
                  onClick={onFlag}
                  title={flagTitle}
                  aria-label={flagTitle}
                  className={cn(
                    "p-2 transition-colors shrink-0",
                    isFlagged || unreportedConcern
                      ? "text-[#CAA25F]"
                      : "text-[#54656f] dark:text-[#aebac1] hover:text-[#CAA25F]",
                    unreportedConcern && "concern-pulse"
                  )}
                >
                  <Flag size={22} fill={isFlagged ? "currentColor" : "none"} />
                </button>
              )}
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                title="Emoji"
                className={cn(
                  "p-2 transition-colors",
                  showEmojiPicker ? "text-[#1099A1]" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1]"
                )}
              >
                <Smile size={22} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Attach"
                className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-[#1099A1] transition-colors"
              >
                <Paperclip size={22} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  onTyping?.();
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder="Type a message"
                rows={1}
                className="flex-1 bg-white dark:bg-[#2a3942] text-[15px] text-[#111] dark:text-white placeholder:text-[#8696a0] rounded-xl px-4 py-2.5 outline-none resize-none leading-[1.4] max-h-[120px] overflow-y-auto"
              />

              {inputText.trim() ? (
                <button
                  onClick={() => void submit()}
                  title="Send"
                  className="w-[42px] h-[42px] rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] active:scale-95 transition-all shrink-0"
                >
                  <Send size={18} className="-ml-0.5 mt-0.5" />
                </button>
              ) : (
                <button
                  onClick={() => void startRecording()}
                  title="Record a voice note"
                  className="w-[42px] h-[42px] rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] transition-colors shrink-0"
                >
                  <Mic size={20} />
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center gap-3">
              <button
                onClick={cancelRecording}
                title="Discard"
                className="p-2 text-[#CAA25F] hover:bg-[#CAA25F]/10 rounded-full transition-colors"
              >
                <Trash2 size={22} />
              </button>

              <div className="flex-1 flex items-center gap-3 bg-white dark:bg-[#2a3942] rounded-xl py-2 px-4 overflow-hidden">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2.5 h-2.5 bg-[#CAA25F] rounded-full animate-pulse" />
                  <span className="text-[#111] dark:text-white font-medium text-[15px]">
                    {Math.floor(recordingSeconds / 60)}:
                    {(recordingSeconds % 60).toString().padStart(2, "0")}
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
                      barColor="#CAA25F"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={sendRecording}
                title="Send voice note"
                className="w-[42px] h-[42px] rounded-full bg-[#1099A1] flex items-center justify-center text-white hover:bg-[#0d7f86] active:scale-95 transition-all shrink-0"
              >
                <Send size={18} className="-ml-0.5 mt-0.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
