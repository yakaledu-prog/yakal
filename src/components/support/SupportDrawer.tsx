import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Mic, Send, Keyboard, Square, ChevronLeft, SquarePen, PanelLeft, ChevronDown, BotMessageSquareIcon, MessagesSquareIcon } from "lucide-react";

import helloImg from "@/assets/images/hello.png";

import { cn } from "@/utils/cn";
import { Dropdown } from "@/components/ui/Dropdown";
import { StreamingText, TypingDots, grow, linkify } from "@/components/assistant/chatParts";
import {
  speechSupported,
  takeSentences,
  useListener,
  useSpeaker,
  useVoices,
} from "@/components/assistant/useSpeech";
import {
  askSupport,
  SUPPORT_STARTERS,
  type SupportChatMessage,
  type SupportChatRole,
} from "@/services/supportChatService";
import {
  listable,
  loadSessions,
  newSession,
  saveSessions,
  titleFor,
  type SupportSession,
} from "./supportSessions";

// ============================================================
// Yali, in a drawer.
//
// A drawer rather than the floating bubble it replaces, because the questions
// asked here are about the page you are looking at. "Where is the reschedule
// button" cannot be answered by something covering the button, and a dedicated
// page would navigate away from it entirely.
//
// Below md it is the whole window instead. Four hundred pixels of a three
// hundred and sixty pixel screen is not a sidebar, and the dashboards already
// show one pane at a time on a phone, so this matches them.
//
// It overlays rather than pushing the layout: reflowing every dashboard on
// open would put the master-detail grids through a resize they were never
// built for, to save a column nobody is reading while they type a question.
// ============================================================

type Phase = "idle" | "listening" | "thinking" | "speaking";

/**
 * The ground behind the conversation.
 *
 * A dot grid was tried first and read as graph paper: at any strength faint
 * enough not to compete with the text it vanished, and at any strength you
 * could see it, it patterned the whole panel.
 *
 * A wash has no such tension. It falls from the top, where the conversation
 * begins, and is gone by the composer, so the drawer has depth without
 * anything to look at. Mixed from the primary token rather than written as a
 * literal, so it follows the theme into dark mode.
 */
const DRAWER_GROUND: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to bottom, color-mix(in oklab, var(--primary) 10%, transparent), transparent 55%)",
};

export function SupportDrawer({
  role,
  userId,
  userName,
  open,
  onClose,
}: {
  role: SupportChatRole;
  userId: string;
  /** Only for the greeting. Absent is fine; it just goes unnamed. */
  userName?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  // First name only. "Hello Tigist Worku, I am Yali" reads like a form letter.
  const firstName = userName?.trim().split(/\s+/)[0] ?? "";
  const [sessions, setSessions] = useState<SupportSession[]>(() => {
    const stored = loadSessions(userId);
    return stored.length > 0 ? stored : [newSession()];
  });
  // Derived from the list above, which has already been initialised: calling
  // loadSessions a second time would read the same storage twice and could
  // disagree with it.
  const [activeId, setActiveId] = useState(() => sessions[0].id);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Collapsed once a conversation is under way: the openers are scaffolding
  // for an empty drawer, and pinned above the composer they would push the
  // answer being read off the top.
  const [tipsOpen, setTipsOpen] = useState(() => sessions[0].messages.length === 0);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [started, setStarted] = useState(false);

  const abortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const spokenRef = useRef("");

  const voices = useVoices();
  const voice = voices.find((v) => v.voiceURI === voiceId) ?? voices[0] ?? null;
  const { speak, cancel: stopSpeaking, speaking } = useSpeaker(voice);
  const [canTalk] = useState(() => speechSupported());

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];
  // Memoised: the `?? []` minted a new array every render, which made the
  // dependencies of everything reading it change on every render too.
  const messages = useMemo(() => active?.messages ?? [], [active]);
  const past = listable(sessions);

  /** Writes into the open conversation and leaves the others alone. */
  const setMessages = useCallback(
    (update: (prev: SupportChatMessage[]) => SupportChatMessage[]) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId
            ? (() => {
              const next = update(s.messages);
              return { ...s, messages: next, title: titleFor(next), updatedAt: Date.now() };
            })()
            : s
        )
      );
    },
    [activeId]
  );

  useEffect(() => {
    saveSessions(userId, sessions);
  }, [sessions, userId]);

  const send = useCallback(
    (text: string, spoken: boolean) => {
      const question = text.trim();
      if (!question || busy) return;

      const next: SupportChatMessage[] = [
        ...messages,
        { id: `${Date.now()}-user`, role: "user", content: question },
      ];
      setMessages(() => next);
      setDraft("");
      if (composerRef.current) composerRef.current.style.height = "auto";
      setInterim("");
      setStreaming("");
      setError(null);
      setBusy(true);
      spokenRef.current = "";

      let full = "";
      abortRef.current = askSupport(next, {
        onToken: (t) => {
          full += t;
          setStreaming(full);
          // Sentence by sentence, so the voice starts while the model is still
          // writing rather than after the paragraph is done.
          if (spoken) {
            const { ready, rest } = takeSentences(full.slice(spokenRef.current.length));
            for (const sentence of ready) speak(sentence);
            spokenRef.current = full.slice(0, full.length - rest.length);
          }
        },
        onError: (message) => setError(message),
        onDone: () => {
          setBusy(false);
          setStreaming("");
          if (full) {
            setMessages((prev) => [
              ...prev,
              { id: `${Date.now()}-assistant`, role: "assistant", content: full },
            ]);
            if (spoken) {
              const tail = full.slice(spokenRef.current.length).trim();
              if (tail) speak(tail);
            }
          }
        },
      });
    },
    [busy, messages, speak, setMessages]
  );

  const listener = useListener({ onFinal: (t) => send(t, true), onInterim: setInterim });

  const stopEverything = useCallback(() => {
    abortRef.current?.();
    listener.stop();
    stopSpeaking();
    setBusy(false);
    setInterim("");
  }, [listener, stopSpeaking]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming, open]);

  // No outside-click handler: the rail has a scrim of its own, and a mousedown
  // listener alongside it made the toggle button unable to close the rail.
  // Mousedown closed it, then the click that followed toggled it straight back
  // open again.

  // Escape closes, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopEverything();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, stopEverything]);

  if (!open) return null;

  const phase: Phase = listener.listening
    ? "listening"
    : busy
      ? "thinking"
      : speaking
        ? "speaking"
        : "idle";

  const close = () => {
    stopEverything();
    onClose();
  };

  /**
   * A fresh conversation, reusing an empty one if it is already open.
   *
   * Pressing new chat twice should not leave two blank sessions behind, and
   * the model is sent only the open conversation, so this is also how you drop
   * context that has stopped being relevant.
   */
  const startNewChat = () => {
    stopEverything();
    setHistoryOpen(false);
    // Open again for a fresh chat, which is the one time they are scaffolding
    // rather than clutter.
    setTipsOpen(true);
    if (messages.length === 0) return;
    const fresh = newSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
  };

  return (
    <>
      {/* The scrim is desktop only. On a phone the drawer is the whole window,
          so there is nothing behind it to dim or to click through to. */}
      <div
        onClick={close}
        aria-hidden
        className="fixed inset-0 z-[95] hidden bg-black/20 md:block"
      />

      <aside
        role="dialog"
        aria-label="AI support"
        className={cn(
          "fixed inset-0 z-[96] flex flex-col overflow-hidden bg-card",
          "md:inset-y-0 md:left-auto md:right-0 md:w-[400px] md:border-l md:border-border md:shadow-2xl"
        )}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          {/* A back arrow on a phone, where this is a page, and a close cross on
              a desktop, where it is a panel beside one. */}
          <button
            onClick={close}
            aria-label="Close support"
            className="text-muted-foreground transition-colors hover:text-foreground md:hidden"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Toggle and new chat sit together on the left, the way every
              chat app puts them, and the title moves into the rail: a panel
              this narrow does not need to name itself twice. */}
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
            aria-label="Chats"
            title="Chats"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <PanelLeft size={18} />
          </button>

          <button
            onClick={startNewChat}
            aria-label="New chat"
            title="New chat"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <SquarePen size={18} />
          </button>

          <span className="min-w-0 flex-1" />

          <button
            onClick={close}
            aria-label="Close support"
            className="hidden text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            <X size={18} />
          </button>
        </header>

        {/* Full height inside the drawer, over the conversation rather than
            beside it: at 400px there is no room for two columns, and on a
            phone the drawer is already the whole window. */}
        {historyOpen && (
          <>
            <div
              onClick={() => setHistoryOpen(false)}
              aria-hidden
              className="absolute inset-0 z-20 bg-black/20"
            />
            <div
              className="absolute inset-y-0 left-0 z-30 flex w-[260px] max-w-[80%] flex-col border-r border-border bg-card shadow-xl"
            >
              {/* The name lives here rather than in the main header, so the
                  conversation itself is not topped by a label you have already
                  read a hundred times. */}
              <div className="flex items-center gap-2 px-4 py-3 justify-between   ">
                <div className="flex items-center justify-start text-primary gap-1 text-[12.5px] ">
                  <BotMessageSquareIcon className="" strokeWidth={2} size={16} />
                  <p className="flex-1 font-semibold tracking-wider">Yali Chatbot</p>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Hide chats"
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <PanelLeft size={18} />
                </button>
              </div>

              <div className="px-2 pb-2">
                <button
                  onClick={startNewChat}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium text-foreground transition-colors hover:bg-muted/60"
                >
                  <SquarePen size={16} /> New chat
                </button>
              </div>

              <div className="mx-4 border-t border-border" />

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {past.length === 0 ? (
                  <p className="px-3 py-2 text-[12.5px] text-muted-foreground">
                    Nothing earlier yet.
                  </p>
                ) : (
                  past.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => {
                        stopEverything();
                        setActiveId(session.id);
                        setHistoryOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                        session.id === activeId ? "bg-primary/10" : "hover:bg-muted/60"
                      )}
                    >
                      <MessagesSquareIcon
                        size={14}
                        className={cn(
                          "mt-0.5 shrink-0",
                          session.id === activeId ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-[13px]",
                            session.id === activeId
                              ? "font-medium text-primary"
                              : "text-foreground"
                          )}
                        >
                          {session.title}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                          {new Date(session.updatedAt).toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {voiceMode ? (
          <VoicePane
            phase={phase}
            interim={interim}
            messages={messages}
            streaming={streaming}
            started={started}
            error={error ?? listener.error}
            voices={voices}
            voiceId={voice?.voiceURI ?? ""}
            onVoice={setVoiceId}
            onStart={() => {
              stopSpeaking();
              setStarted(true);
              listener.start();
            }}
            onStop={stopEverything}
            onType={() => {
              stopEverything();
              setVoiceMode(false);
            }}
          />
        ) : (
          <>
            <div
              ref={scrollRef}
              style={DRAWER_GROUND}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4"
            >
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                  <img
                    src={helloImg}
                    alt=""
                    className="mb-4 h-28 w-28 object-contain"
                    // Decorative, and the largest thing in the drawer: nothing
                    // above the fold waits on it.
                    loading="lazy"
                  />
                  <h2 className="text-[19px] font-medium text-foreground">
                    {firstName ? `Hello ${firstName}, I am Yali` : "Hello, I am Yali"}
                  </h2>
                  <p className="mt-2 max-w-[280px] text-[13.5px] leading-relaxed text-muted-foreground">
                    Ask me how anything on Yakal works. I cannot see your account, your
                    schedule or your grades, so for those the page itself is the place.
                  </p>
                </div>
              )}

              {messages.map((m) =>
                m.role === "user" ? (
                  <p
                    key={m.id}
                    className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-[13.5px] leading-relaxed text-white"
                  >
                    {m.content}
                  </p>
                ) : (
                  <p
                    key={m.id}
                    className="max-w-[92%] whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground"
                  >
                    {linkify(m.content)}
                  </p>
                )
              )}

              {streaming && (
                <StreamingText
                  text={streaming}
                  className="max-w-[92%] whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground"
                />
              )}
              {busy && !streaming && <TypingDots />}
              {error && <p className="text-[13px] text-secondary">{error}</p>}
            </div>

            {/* Still offered once the conversation has started, but folded
                away: useful when you have run out of things to ask, noise
                while you are reading an answer. */}
            {/* Offered whether or not the conversation has started. Open on a
                fresh chat, where they are scaffolding, and collapsed once
                there is an answer to read. */}
            <div className="border-t border-border px-3 pt-2">
              <button
                onClick={() => setTipsOpen((o) => !o)}
                aria-expanded={tipsOpen}
                className="flex w-full items-center gap-1 py-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDown
                  size={14}
                  className={cn("transition-transform", !tipsOpen && "-rotate-90")}
                />
                Suggestions
              </button>

              {tipsOpen && (
                <div className="space-y-1.5 pb-2 pt-1">
                  {SUPPORT_STARTERS[role].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setTipsOpen(false);
                        send(s, false);
                      }}
                      disabled={busy}
                      className="block w-full rounded-lg border border-border px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft, false);
              }}
              className={cn("px-3 py-3", messages.length === 0 && "border-t border-border")}
            >
              <div className="relative rounded-xl border border-border transition-colors focus-within:border-primary">
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    grow(e.currentTarget);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft, false);
                    }
                  }}
                  rows={1}
                  placeholder="Ask how something works"
                  className="block max-h-32 w-full resize-none overflow-y-auto bg-transparent py-2.5 pl-3 pr-10 text-[13.5px] leading-relaxed outline-none"
                />
                {/* Both live in the box, so the two ways of asking sit
                    together instead of one being a header control and the
                    other a composer one. */}
                <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
                  {canTalk && (
                    <button
                      type="button"
                      onClick={() => {
                        stopEverything();
                        setVoiceMode(true);
                      }}
                      aria-label="Talk instead"
                      title="Talk instead"
                      className="p-1.5 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Mic size={17} />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!draft.trim() || busy}
                    aria-label="Send"
                    className="p-1.5 text-primary transition-colors hover:text-primary-hover disabled:text-muted-foreground/40"
                  >
                    <Send size={17} />
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </aside>
    </>
  );
}

/** The last thing either side said. Array.at is above this project's target. */
function lastOf(messages: SupportChatMessage[], role: "user" | "assistant"): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === role) return messages[i].content;
  }
  return "";
}

/** Everything before the exchange now on screen, shown faded behind it. */
function pastOf(messages: SupportChatMessage[]): SupportChatMessage[] {
  let keep = messages.length;
  if (keep > 0 && messages[keep - 1].role === "assistant") keep -= 1;
  if (keep > 0 && messages[keep - 1].role === "user") keep -= 1;
  return messages.slice(0, keep);
}

/**
 * Voice mode.
 *
 * One control and one thing moving. What the assistant is doing has to be
 * readable at a glance, so state is carried by the orb rather than by words.
 */
function VoicePane({
  phase,
  interim,
  messages,
  streaming,
  started,
  error,
  voices,
  voiceId,
  onVoice,
  onStart,
  onStop,
  onType,
}: {
  phase: Phase;
  interim: string;
  messages: SupportChatMessage[];
  streaming: string;
  started: boolean;
  error: string | null;
  voices: SpeechSynthesisVoice[];
  voiceId: string;
  onVoice: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
  onType: () => void;
}) {
  const CAPTION: Record<Phase, string> = {
    idle: "Tap to talk",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
  };

  const busy = phase !== "idle";
  const question = lastOf(messages, "user");
  const answer = streaming || lastOf(messages, "assistant");
  const history = pastOf(messages);

  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history.length, question, answer]);

  return (
    <div
      style={DRAWER_GROUND}
      className="flex min-h-0 flex-1 flex-col items-center justify-between px-5 py-6"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6">
        <button
          onClick={busy ? onStop : onStart}
          aria-label={busy ? "Stop" : "Start talking"}
          className="relative flex h-28 w-28 items-center justify-center"
        >
          {phase === "listening" && (
            <>
              <span className="absolute h-full w-full animate-ping rounded-full bg-primary/20" />
              <span className="absolute h-[80%] w-[80%] animate-pulse rounded-full bg-primary/15" />
            </>
          )}
          {phase === "thinking" && (
            <span className="absolute h-full w-full animate-spin rounded-full border-2 border-transparent border-t-primary border-r-tertiary" />
          )}

          <span
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-full transition-colors",
              busy ? "bg-primary" : "bg-primary/10"
            )}
          >
            {phase === "speaking" ? (
              // Three bars is enough to read as a voice. SpeechSynthesis does
              // not expose an audio graph, so an honest animation beats a fake
              // waveform.
              <span className="flex items-end gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 animate-pulse rounded-full bg-white"
                    style={{ height: delay === 150 ? 26 : 16, animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            ) : busy ? (
              <Square size={22} className="text-white" fill="currentColor" />
            ) : (
              <Mic size={26} className="text-primary" />
            )}
          </span>
        </button>

        <p className="text-[13px] text-muted-foreground">{CAPTION[phase]}</p>

        <button
          onClick={onType}
          className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Keyboard size={14} /> Type instead
        </button>

        {/* Teal for the person, plain for the assistant, and everything before
            the current exchange faded: context for where you are, not
            something to read. */}
        <div
          ref={transcriptRef}
          className="min-h-[4.5rem] w-full flex-1 space-y-2 overflow-y-auto text-center"
        >
          {history.map((m) => (
            <p
              key={m.id}
              className={cn(
                "text-[13px] leading-relaxed opacity-35",
                m.role === "user" ? "text-primary" : "text-foreground"
              )}
            >
              {m.content}
            </p>
          ))}
          {question && <p className="text-[13.5px] leading-relaxed text-primary">{question}</p>}
          {interim && <p className="text-[13.5px] leading-relaxed text-primary/50">{interim}</p>}
          {answer && (
            <p className="text-[13.5px] leading-relaxed text-foreground">{linkify(answer)}</p>
          )}
        </div>

        {error && <p className="text-center text-[13px] text-secondary">{error}</p>}
      </div>

      {/* Gone once the microphone has been used. Choosing a voice is something
          you do before you begin, not under a live transcript. */}
      {!started && voices.length > 1 && (
        <Dropdown
          value={voiceId}
          onChange={onVoice}
          options={voices.slice(0, 12).map((v) => ({ value: v.voiceURI, label: v.name }))}
          size="sm"
          ariaLabel="Choose a voice"
          className="w-full"
          buttonClassName="text-muted-foreground"
        />
      )}
    </div>
  );
}
