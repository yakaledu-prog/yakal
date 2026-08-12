// ============================================================
// Talking to the landing assistant.
//
// Hand rolled rather than the Vercel AI SDK. That SDK earns its place when you
// want tool calls, generative UI and a provider you can swap; here it would add
// two dependencies and a wire protocol in order to read a token stream, which
// is the forty lines below. The repository has already had one round of pulling
// packages back out, so this is the shape that keeps.
// ============================================================

export interface AssistantTurn {
  role: "user" | "model";
  text: string;
}

export interface StreamHandlers {
  onToken: (text: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

/**
 * Streams one answer.
 *
 * Returns an abort function. Voice mode uses it when somebody starts talking
 * over the answer: the sentence being spoken stops and the request behind it
 * stops too, rather than arriving later and speaking on its own.
 */
export function askAssistant(messages: AssistantTurn[], handlers: StreamHandlers): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch("/api/ai?action=chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // A non-streaming failure answers as JSON, which is where the real
        // reason lives. Falling back to the status code alone made every
        // failure look identical from the panel.
        const detail = await res.json().catch(() => null);
        handlers.onError(detail?.error ?? "The assistant is unavailable right now.");
        return handlers.onDone();
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        // Normalised for the same reason the server does it: a proxy between
        // here and there may pass CRLF through untouched.
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
      // An abort is the caller's own doing, so it is not an error to report.
      if (err?.name !== "AbortError") {
        handlers.onError("Could not reach the assistant. Check your connection.");
      }
      handlers.onDone();
    }
  })();

  return () => controller.abort();
}

/** What the panel offers before anyone has typed. Questions the page can answer. */
export const STARTERS = [
  "What does Yakal offer?",
  "How does college counselling work?",
  "How much does it cost?",
  "How do I book a tutor?",
];
