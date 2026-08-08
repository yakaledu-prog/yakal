import { useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { askRoadmapAssistant, type ChatTurn } from "@/services/aiService";
import { cn } from "@/utils/cn";

/**
 * A conversation about this student's application, not about applications.
 *
 * The context is assembled on the server from what the app already holds:
 * their stage, intended major, graduation year, the colleges on their list
 * with those colleges' own deadlines, and what is still outstanding. That is
 * the whole reason for this existing rather than a link to a general chatbot,
 * which has to ask all of it and gets told half of it wrong.
 *
 * Nothing is persisted. A roadmap question is asked and answered, and keeping
 * a transcript would mean deciding who else may read it, which is a bigger
 * question than this tab is worth.
 */
const OPENERS = [
  "What should I be doing this month?",
  "Which of my deadlines is closest?",
  "How do I choose between Early Decision and Early Action?",
  "What does a strong personal statement look like?",
];

export function RoadmapAssistant({ studentId }: { studentId?: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;

    setError(null);
    setInput("");
    const next: ChatTurn[] = [...turns, { role: "user", text: message }];
    setTurns(next);
    setBusy(true);

    const res = await askRoadmapAssistant(message, turns, studentId);
    setBusy(false);

    if (res.error || !res.reply) {
      setError(res.error ?? "No answer came back.");
      return;
    }
    setTurns([...next, { role: "model", text: res.reply }]);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div className="flex flex-col">
      {turns.length === 0 ? (
        <div className="py-6">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-[#1099A1]" />
            <p className="text-[14px] text-foreground">
              Ask about your roadmap. It already knows your stage, your list and your deadlines.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OPENERS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void send(q)}
                className="rounded-lg border border-[#e9edef] px-3.5 py-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground dark:border-[#2a3942]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-h-[420px] space-y-4 overflow-y-auto py-4">
          {turns.map((t, i) => (
            <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
                  t.role === "user"
                    ? "bg-[#1099A1] text-white"
                    : "bg-muted/50 text-foreground"
                )}
              >
                {t.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 size={14} className="animate-spin" /> Thinking
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {error && <p className="pb-2 text-[12.5px] text-[#CAA25F]">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-[#e9edef] pt-4 dark:border-[#2a3942]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your applications..."
          className="h-10 flex-1 rounded-xl border border-[#e9edef] bg-transparent px-3 text-[13.5px] outline-none transition-colors focus:border-[#1099A1] dark:border-[#2a3942]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1099A1] text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </form>

      {/* Said plainly, because a family will otherwise treat a confident answer
          about a deadline as authoritative and only find out in April. */}
      <p className="pt-2 text-[12px] text-muted-foreground">
        Answers come from your roadmap and can be wrong. Confirm dates on the college's own page,
        and talk to your counselor about anything that matters.
      </p>
    </div>
  );
}
