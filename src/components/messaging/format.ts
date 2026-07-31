import type { ChatMessage } from "@/services/messageService";

/** 4:05 PM */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Timestamp for a conversation row: time today, weekday this week, else a date. */
export function formatListDate(date: Date | null | undefined): string {
  if (!date) return "";
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return formatTime(date);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/**
 * How long ago someone was last around, phrased the way a person would say it.
 *
 * The heartbeat runs every minute, so anything fresher than that is rounded to
 * "just now" rather than claiming a precision it does not have.
 */
export function formatLastSeen(date: Date | null | undefined): string | null {
  if (!date) return null;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 90) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return `yesterday at ${formatTime(date)}`;
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

/** Heading for a day separator inside the history. */
export function formatDaySeparator(date: Date): string {
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export interface DayGroup {
  label: string;
  messages: ChatMessage[];
}

/** Split a history into consecutive same-day runs. */
export function groupByDay(messages: ChatMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let current = "";
  for (const msg of messages) {
    const label = formatDaySeparator(msg.createdAt);
    if (label !== current) {
      groups.push({ label, messages: [] });
      current = label;
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

/** The most recent message, if there is one. */
export function lastMessage(messages: ChatMessage[]): ChatMessage | undefined {
  return messages[messages.length - 1];
}

/**
 * Unread messages in a thread, from the other person's side.
 *
 * The old helper compared against a hardcoded "current-user" id left over from
 * the mock data, so it counted the signed-in user's own messages as unread and
 * every badge was wrong.
 */
export function countUnread(messages: ChatMessage[], currentUserId: string | undefined): number {
  if (!currentUserId) return 0;
  return messages.filter((m) => m.senderId !== currentUserId && !m.isRead).length;
}

/** One-line preview for a conversation row. */
export function previewText(msg: ChatMessage | undefined): string {
  if (!msg) return "";
  if (msg.type && msg.type !== "text") {
    const kind = msg.type.charAt(0).toUpperCase() + msg.type.slice(1);
    return kind;
  }
  return msg.text.replace(/\s+/g, " ").trim();
}
