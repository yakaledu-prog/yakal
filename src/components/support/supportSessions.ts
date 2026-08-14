import type { SupportChatMessage } from "@/services/supportChatService";

// ============================================================
// Conversations, kept per user for the life of the tab.
//
// sessionStorage rather than localStorage, which is what the single transcript
// used before: a support conversation can name a child, a course or an invoice
// question, and on a shared machine that should not outlive the tab. It is the
// same reasoning that put the auth session there.
// ============================================================

export interface SupportSession {
  id: string;
  /** Derived from the first question, so the list reads like what was asked. */
  title: string;
  messages: SupportChatMessage[];
  updatedAt: number;
}

const KEY = "yakal-support-chats";
/** The old single-transcript key, read once so an open chat survives the change. */
const LEGACY_KEY = "yakal-support-chat";

/** Enough to find yesterday's question, few enough that the list stays scannable. */
const MAX_SESSIONS = 12;
/** What each conversation carries into the model, and so what is worth storing. */
const MAX_MESSAGES = 12;

export const newSession = (): SupportSession => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "New chat",
  messages: [],
  updatedAt: Date.now(),
});

/**
 * A conversation's name, taken from the first thing asked.
 *
 * Not from the answer: the question is what somebody scanning the list is
 * trying to recognise, and it is available immediately rather than after the
 * model has finished.
 */
export function titleFor(messages: SupportChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content.trim();
  if (!first) return "New chat";
  return first.length > 42 ? `${first.slice(0, 42).trimEnd()}...` : first;
}

export function loadSessions(userId: string): SupportSession[] {
  try {
    const stored = sessionStorage.getItem(`${KEY}:${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored) as SupportSession[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // One-time carry-over from the single-transcript format, so anyone mid
    // conversation when this shipped does not lose it.
    const legacy = sessionStorage.getItem(`${LEGACY_KEY}:${userId}`);
    if (legacy) {
      const messages = JSON.parse(legacy) as SupportChatMessage[];
      if (Array.isArray(messages) && messages.length > 0) {
        return [{ ...newSession(), title: titleFor(messages), messages }];
      }
    }
  } catch {
    // Private mode, or something else wrote to the key. An empty list is a
    // working drawer; throwing here would be a blank one.
  }
  return [];
}

export function saveSessions(userId: string, sessions: SupportSession[]) {
  try {
    const trimmed = sessions
      .slice(0, MAX_SESSIONS)
      .map((s) => ({ ...s, messages: s.messages.slice(-MAX_MESSAGES) }));
    sessionStorage.setItem(`${KEY}:${userId}`, JSON.stringify(trimmed));
  } catch {
    // Storage full or unavailable. The conversation still works in memory.
  }
}

/** Newest first, and a conversation nobody ever spoke in is not worth listing. */
export const listable = (sessions: SupportSession[]) =>
  sessions.filter((s) => s.messages.length > 0).sort((a, b) => b.updatedAt - a.updatedAt);
