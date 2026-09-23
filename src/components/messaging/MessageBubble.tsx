import { Check, CheckCheck, Clock, AlertCircle, Flag } from "lucide-react";
import type { ChatContact, ChatMessage } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { formatTime } from "./format";

/**
 * Delivery state on the sender's own bubbles: a clock while the insert is in
 * flight, one tick once it is stored, two once the recipient has read it.
 */
export function StatusTick({ msg }: { msg: ChatMessage }) {
  if (msg.failed) return <AlertCircle size={12} className="text-secondary" />;
  if (msg.pending) return <Clock size={12} className="opacity-60" />;
  if (msg.isRead) return <CheckCheck size={12} className="text-tertiary" />;
  return <Check size={12} />;
}

export function MessageBubble({
  msg,
  contact,
  isConsecutive,
  currentUserId,
  report,
}: {
  msg: ChatMessage;
  contact?: ChatContact;
  isConsecutive?: boolean;
  currentUserId?: string;
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
    msg.text.trim().length > 0 && /^[\p{Extended_Pictographic}\s]+$/u.test(msg.text);

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
            ? "bg-primary text-white border-b-[3px] border-[#087b82] rounded-br-sm"
            : "bg-white dark:bg-[#1f3a3d] text-[#111] dark:text-[#e2e8f0] border-b-[3px] border-black/10 dark:border-black/30 rounded-bl-sm",
          msg.failed && "opacity-70 ring-1 ring-secondary",
          // Marked rather than hidden or redacted. A parent has to read the
          // words to judge them, and the whole point is that they can.
          report && "ring-2 ring-secondary"
        )}
      >
        {!isMe && contact && !isConsecutive && (
          <div className="text-[13px] font-medium text-primary mb-0.5 leading-tight">
            {contact.name}
          </div>
        )}

        {/* Why it was picked out, above the message itself: a parent scrolling
            a long thread needs to know before they read, not after. */}
        {report && (
          <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-secondary">
            <Flag size={11} fill="currentColor" />
            {report.label}
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
