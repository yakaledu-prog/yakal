import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Clock, AlertCircle, Flag, Play, Pause, FileText } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import type { ChatContact, ChatMessage } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { formatTime } from "./format";

/**
 * Delivery state on the sender's own bubbles: a clock while the insert is in
 * flight, one tick once it is stored, two once the recipient has read it.
 */
export function StatusTick({ msg }: { msg: ChatMessage }) {
  if (msg.failed) return <AlertCircle size={12} className="text-[#CAA25F]" />;
  if (msg.pending) return <Clock size={12} className="opacity-60" />;
  if (msg.isRead) return <CheckCheck size={12} className="text-[#97CE9D]" />;
  return <Check size={12} />;
}

/** Locally attached audio (a voice note that has not been uploaded yet). */
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
      waveColor: isMe ? "rgba(255,255,255,0.5)" : "rgba(16,153,161,0.5)",
      progressColor: isMe ? "#ffffff" : "#087b82",
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 30,
      url,
    });

    const clock = (t: number) =>
      `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

    ws.on("ready", () => setDuration(clock(ws.getDuration())));
    ws.on("audioprocess", () => setCurrentTime(clock(ws.getCurrentTime())));
    ws.on("finish", () => setIsPlaying(false));

    waveSurferRef.current = ws;
    return () => ws.destroy();
  }, [url, isMe]);

  return (
    <div className="flex items-center gap-3 w-[200px] md:w-[250px]">
      <button
        onClick={() => {
          waveSurferRef.current?.playPause();
          setIsPlaying(!!waveSurferRef.current?.isPlaying());
        }}
        className="w-10 h-10 shrink-0 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center hover:scale-105 transition-transform"
      >
        {isPlaying ? (
          <Pause size={20} className={isMe ? "text-white" : "text-[#111] dark:text-white"} />
        ) : (
          <Play size={20} className={cn("ml-1", isMe ? "text-white" : "text-[#111] dark:text-white")} />
        )}
      </button>
      <div className="flex-1 overflow-hidden">
        <div ref={containerRef} className="w-full" />
        <div className="text-[11px] mt-1 opacity-70">{isPlaying ? currentTime : duration}</div>
      </div>
    </div>
  );
}

export interface LocalAttachment {
  type: "image" | "video" | "audio" | "file";
  url: string;
  name?: string;
  size?: number;
}

export function MessageBubble({
  msg,
  contact,
  isConsecutive,
  currentUserId,
  attachment,
  report,
}: {
  msg: ChatMessage;
  contact?: ChatContact;
  isConsecutive?: boolean;
  currentUserId?: string;
  attachment?: LocalAttachment;
  /**
   * What the scan picked out of this message. Only ever passed on the parent's
   * monitoring view: the people in the conversation are not told, because
   * somebody who can see which message was caught can work out which word did
   * it and write the next one differently.
   */
  report?: { severity: "high" | "medium"; label: string };
}) {
  const isMe = msg.senderId === currentUserId;
  const isOnlyEmoji =
    !attachment && msg.text.trim().length > 0 && /^[\p{Extended_Pictographic}\s]+$/u.test(msg.text);

  const avatarSlot = !isMe && (
    <div className="w-8 shrink-0 flex items-end pb-0.5">
      {contact && !isConsecutive && (
        <img
          src={contact.avatarUrl}
          alt={contact.name}
          className="w-8 h-8 rounded-full object-cover"
        />
      )}
    </div>
  );

  // A message that is nothing but emoji renders large and unboxed.
  if (isOnlyEmoji) {
    return (
      <div className={cn("flex gap-2 w-full", isMe ? "justify-end" : "justify-start items-end")}>
        {avatarSlot}
        <div className="flex flex-col mb-1 relative group pr-2">
          <div className="text-5xl leading-none">{msg.text}</div>
          <div className="flex justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 right-0">
            <span className="text-[10px] text-[#667781] dark:text-[#aebac1]">
              {formatTime(msg.createdAt)}
            </span>
            {isMe && (
              <span className="text-[#667781] dark:text-[#aebac1]">
                <StatusTick msg={msg} />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2 w-full", isMe ? "justify-end" : "justify-start items-end")}>
      {avatarSlot}
      <div
        className={cn(
          "relative max-w-[75%] md:max-w-[65%] px-3 pt-2 pb-1 rounded-md text-[14.5px] leading-relaxed shadow-sm",
          isMe
            ? "bg-[#1099A1] text-white border-b-[3px] border-[#087b82] rounded-br-sm"
            : "bg-white dark:bg-[#1f3a3d] text-[#111] dark:text-[#e2e8f0] border-b-[3px] border-black/10 dark:border-black/30 rounded-bl-sm",
          msg.failed && "opacity-70 ring-1 ring-[#CAA25F]",
          // Marked rather than hidden or redacted. A parent has to read the
          // words to judge them, and the whole point is that they can.
          report && "ring-2 ring-[#CAA25F]"
        )}
      >
        {!isMe && contact && !isConsecutive && (
          <div className="text-[13px] font-semibold text-[#1099A1] mb-0.5 leading-tight">
            {contact.name}
          </div>
        )}

        {/* Why it was picked out, above the message itself: a parent scrolling
            a long thread needs to know before they read, not after. */}
        {report && (
          <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#CAA25F]">
            <Flag size={11} fill="currentColor" />
            {report.label}
          </div>
        )}

        {attachment && (
          <div className={cn("mb-1", msg.text ? "pb-2" : "")}>
            {attachment.type === "image" && (
              <img src={attachment.url} alt="" className="rounded-md max-h-[250px] object-cover" />
            )}
            {attachment.type === "video" && (
              <video src={attachment.url} controls className="rounded-md max-h-[250px] w-full bg-black" />
            )}
            {attachment.type === "audio" && <AudioPlayer url={attachment.url} isMe={isMe} />}
            {attachment.type === "file" && (
              <div className="flex items-center gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-md min-w-[200px]">
                <div className="p-2 bg-[#1099A1] text-white rounded-full">
                  <FileText size={20} />
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="font-medium text-[13.5px] truncate">{attachment.name || "File"}</div>
                  <div className="text-[11px] opacity-70 mt-0.5">
                    {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : "Unknown size"}
                    {" - "}
                    {attachment.type.toUpperCase()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}

        <div
          className={cn(
            "flex items-center justify-end gap-1 mt-0.5 select-none",
            msg.text ? "float-right relative top-1 ml-3" : ""
          )}
        >
          <span className={cn("text-[10px]", isMe ? "text-white/80" : "text-[#667781] dark:text-[#8696a0]")}>
            {formatTime(msg.createdAt)}
          </span>
          {isMe && (
            <span className="text-white/80">
              <StatusTick msg={msg} />
            </span>
          )}
        </div>
        <div className="clear-both" />
      </div>
    </div>
  );
}
