import { accessToken } from "@/lib/authedFetch";

export type SupportChatRole = 'parent' | 'student' | 'tutor' | 'counselor';

/** Admin is absent on purpose: the knowledge base has no guide for that role. */
export const SUPPORT_ROLES: SupportChatRole[] = ['parent', 'student', 'tutor', 'counselor'];
export type SupportChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export interface SupportStreamHandlers {
  onToken: (text: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

/**
 * Streams one support answer.
 *
 * Not authedPost, which reads the whole body before returning and so cannot
 * surface a token until the model has finished. The token handling here is the
 * same, including the one retry on a stale session: the endpoint requires a
 * signed-in user and a JWT that expired between the check and the request
 * landing would otherwise read as a server fault.
 *
 * Returns an abort function, used when somebody talks over the answer in voice
 * mode or closes the drawer mid-reply.
 */
export function askSupport(
  messages: SupportChatMessage[],
  handlers: SupportStreamHandlers
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const body = JSON.stringify({
        messages: messages.slice(-12).map(({ role, content }) => ({ role, content })),
      });

      const send = (token: string) =>
        fetch("/api/support-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body,
          signal: controller.signal,
        });

      let token = await accessToken();
      if (!token) {
        handlers.onError("You must be signed in.");
        return handlers.onDone();
      }

      let res = await send(token);
      if (res.status === 401) {
        const fresh = await accessToken(true);
        if (fresh) {
          token = fresh;
          res = await send(fresh);
        }
      }

      if (!res.ok || !res.body) {
        // Everything before the stream opens still answers as JSON, so the
        // real reason is in the body rather than only in the status.
        const detail = await res.json().catch(() => null);
        handlers.onError(detail?.error ?? "AI support is unavailable right now.");
        return handlers.onDone();
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        const frames = buffer.split("\n\n");
        // The tail is a partial frame until the next chunk proves otherwise.
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const event = frame.match(/^event: (.+)$/m)?.[1];
          const data = frame.match(/^data: (.+)$/m)?.[1];
          if (!event || !data) continue;

          let payload: any;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }

          if (event === "token") handlers.onToken(payload.text ?? "");
          else if (event === "error") handlers.onError(payload.message ?? "Something went wrong.");
        }
      }
      handlers.onDone();
    } catch (err: any) {
      // An abort is the caller's own doing, not a failure to report.
      if (err?.name !== "AbortError") {
        handlers.onError("Could not reach AI support. Check your connection.");
      }
      handlers.onDone();
    }
  })();

  return () => controller.abort();
}

/** Openers, so an empty drawer suggests what it can actually answer. */
export const SUPPORT_STARTERS: Record<SupportChatRole, string[]> = {
  parent: ["How do I book a course?", "Where do I see my invoices?", "How do I link a child?"],
  student: ["Where are my assignments?", "How do I join a session?", "How do I reschedule?"],
  tutor: ["How do I set my availability?", "When do I get paid?", "How do I add a course?"],
  counselor: ["Where are my assigned students?", "How do I review an essay?", "How do I log a session?"],
};
