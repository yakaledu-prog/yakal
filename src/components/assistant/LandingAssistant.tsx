import { useCallback, useEffect, useRef, useState } from "react";
import { X, Mic, Send, Keyboard, Square, BotMessageSquareIcon } from "lucide-react";

import { cn } from "@/utils/cn";
import { Dropdown } from "@/components/ui/Dropdown";
import { askAssistant, STARTERS, type AssistantTurn } from "@/services/assistantService";
import { speechSupported, takeSentences, useListener, useSpeaker, useVoices } from "./useSpeech";

// ============================================================
// The assistant on the public site.
//
// Two modes over one conversation. Typing is the default because it works
// everywhere and can be read at a glance; voice is a mode you enter, and while
// you are in it the panel shows almost nothing on purpose. A voice assistant
// covered in buttons is a chat window that also talks.
//
// The transcript is kept across the switch, so a question asked out loud can be
// re-read afterwards and a typed conversation can be continued by voice.
// ============================================================

type Phase = "idle" | "listening" | "thinking" | "speaking";

/**
 * Turns addresses and links in an answer into things you can click.
 *
 * The assistant is told to hand out the contact address, and a plain-text
 * address on a phone is a thing you have to memorise and retype. Done at
 * render rather than by asking the model for markdown: markdown would have to
 * be parsed, it would be read aloud by the speech voice as punctuation, and a
 * model that emits links sometimes emits broken ones.
 */
const LINKABLE = /([\w.+-]+@[\w-]+\.[\w.-]+[\w])|(https?:\/\/[^\s<>()]+[^\s<>().,])/g;

function linkify(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(LINKABLE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));

    const [match, email] = m;
    out.push(
      <a
        key={`${at}-${match}`}
        href={email ? `mailto:${email}` : match}
        {...(email ? {} : { target: "_blank", rel: "noreferrer noopener" })}
        className="text-primary underline underline-offset-2 hover:text-primary-hover"
      >
        {match}
      </a>
    );
    last = at + match.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * The classic three dots.
 *
 * A spinner says "loading", which is what a page does. Dots say "writing",
 * which is what this is, and they sit on the same line the answer will appear
 * on so nothing jumps when it does.
 */
function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Thinking">
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#54656f]"
          style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
        />
      ))}
    </span>
  );
}

/**
 * The answer, revealed at a readable pace.
 *
 * The stream was already a stream: tokens are painted as they land. The
 * trouble is that a lite model finishes a short answer about 100ms after it
 * starts one, so "streaming" looked like the paragraph appearing at once.
 *
 * This paces the reveal just behind the arrival and catches up proportionally,
 * so a fast answer reads as typed and a slow one is never held back. It only
 * exists while an answer is in flight; the finished turn renders as plain text.
 */
function StreamingText({ text }: { text: string }) {
  const [shown, setShown] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setShown((prev) => {
        // A new answer never starts with the old one, so this is the reset.
        if (!text.startsWith(prev)) return text;
        if (prev.length >= text.length) return prev;
        // Proportional, so the gap closes rather than growing on a long answer.
        const step = Math.max(2, Math.ceil((text.length - prev.length) / 6));
        return text.slice(0, prev.length + step);
      });
    }, 16);
    return () => clearInterval(id);
  }, [text]);

  return (
    <p className="max-w-[92%] whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#111]">
      {linkify(shown)}
      {shown.length < text.length && (
        <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-primary" />
      )}
    </p>
  );
}

/** The last thing either side said. Array.at is above this project's target. */
function lastOf(turns: AssistantTurn[], role: "user" | "model"): string {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === role) return turns[i].text;
  }
  return "";
}

const lastModelText = (turns: AssistantTurn[]) => lastOf(turns, "model");
const lastUserText = (turns: AssistantTurn[]) => lastOf(turns, "user");

/**
 * Everything before the exchange now on screen.
 *
 * The voice panel shows the current question and answer at full strength and
 * these faded behind them, so it drops the trailing question and, if there is
 * one, the answer to it.
 */
function pastTurns(turns: AssistantTurn[]): AssistantTurn[] {
  let keep = turns.length;
  if (keep > 0 && turns[keep - 1].role === "model") keep -= 1;
  if (keep > 0 && turns[keep - 1].role === "user") keep -= 1;
  return turns.slice(0, keep);
}

/**
 * Grows the composer to fit what has been typed.
 *
 * Height is reset to auto first, or scrollHeight only ever reports the taller
 * of the two and the box grows but never shrinks when a line is deleted. The
 * cap is in CSS as max-h-32 so the overflow scrolls past it.
 */
function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function LandingAssistant() {
  const [open, setOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [voiceId, setVoiceId] = useState<string>("");
  // Whether the microphone has been used yet, which is what retires the voice
  // picker. Not derived from the transcript: switching to voice with a typed
  // conversation behind you should still let you choose a voice first.
  const [started, setStarted] = useState(false);

  const abortRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // What has been said aloud already, so the speaker is fed whole sentences
  // once each while the tokens keep arriving.
  const spokenRef = useRef("");

  const voices = useVoices();
  const voice = voices.find((v) => v.voiceURI === voiceId) ?? voices[0] ?? null;
  const { speak, cancel: stopSpeaking, speaking } = useSpeaker(voice);

  // Read once: capability does not change while the page is open, and calling
  // it during render would be a new answer every time.
  const [canTalk] = useState(() => speechSupported());

  const send = useCallback(
    (text: string, spoken: boolean) => {
      const question = text.trim();
      if (!question || busy) return;

      const next: AssistantTurn[] = [...turns, { role: "user", text: question }];
      setTurns(next);
      setDraft("");
      // The box keeps whatever inline height it grew to, so clearing the text
      // is not enough to shrink it back.
      if (composerRef.current) composerRef.current.style.height = "auto";
      setInterim("");
      setStreaming("");
      setError(null);
      setBusy(true);
      spokenRef.current = "";

      let full = "";
      abortRef.current = askAssistant(next, {
        onToken: (t) => {
          full += t;
          setStreaming(full);
          // Speak sentence by sentence rather than at the end. The model writes
          // faster than anyone talks, so the voice never catches up and the
          // wait before the first word is one sentence instead of a paragraph.
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
            setTurns((prev) => [...prev, { role: "model", text: full }]);
            // Whatever was left without a full stop still needs saying.
            if (spoken) {
              const tail = full.slice(spokenRef.current.length).trim();
              if (tail) speak(tail);
            }
          }
        },
      });
    },
    [busy, turns, speak]
  );

  const listener = useListener({
    onFinal: (text) => send(text, true),
    onInterim: setInterim,
  });

  // Follow the conversation as it grows. Only while open, or this fights the
  // page scroll on a closed panel.
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, streaming, open]);

  const stopEverything = useCallback(() => {
    abortRef.current?.();
    listener.stop();
    stopSpeaking();
    setBusy(false);
    setInterim("");
  }, [listener, stopSpeaking]);

  const closePanel = () => {
    stopEverything();
    setOpen(false);
  };

  const leaveVoice = () => {
    stopEverything();
    setVoiceMode(false);
  };

  const phase: Phase = listener.listening
    ? "listening"
    : busy
      ? "thinking"
      : speaking
        ? "speaking"
        : "idle";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask about Yakal"
        className="fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-primary-hover"
      >
        <BotMessageSquareIcon size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex max-h-[min(620px,calc(100vh-2.5rem))] w-[min(390px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
      <header className="flex items-center gap-1.5 border-b border-black/5 px-4 py-3">
        {/* <span className="relative flex h-2 w-2">
          {phase !== "idle" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tertiary opacity-75" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-tertiary" />
        </span> */}
        <BotMessageSquareIcon size={16} className="text-primary p-0" />
        <p className="flex-1 text-[14px] font-medium text-primary">Ask Yakal</p>

        {canTalk && (
          <button
            onClick={() => (voiceMode ? leaveVoice() : setVoiceMode(true))}
            aria-label={voiceMode ? "Switch to typing" : "Switch to voice"}
            title={voiceMode ? "Type instead" : "Talk instead"}
            className="text-[#54656f] transition-colors hover:text-primary"
          >
            {voiceMode ? <Keyboard size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button
          onClick={closePanel}
          aria-label="Close"
          className="text-[#54656f] transition-colors hover:text-[#111]"
        >
          <X size={18} />
        </button>
      </header>

      {voiceMode ? (
        <VoicePanel
          phase={phase}
          interim={interim}
          spokenQuestion={lastUserText(turns)}
          answer={streaming || lastModelText(turns)}
          history={pastTurns(turns)}
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
        />
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <div className="space-y-3">
                <p className="text-[13.5px] leading-relaxed text-[#54656f]">
                  I can explain the tutoring and college counselling, what the tiers include, and
                  how to get started. I cannot see anyone's account.
                </p>
                <div className="space-y-1.5">
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s, false)}
                      className="block w-full rounded-lg border border-black/10 px-3 py-2 text-left text-[13px] text-[#111] transition-colors hover:border-primary hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <Bubble key={i} role={t.role} text={t.text} />
            ))}
            {streaming && <StreamingText text={streaming} />}
            {busy && !streaming && <TypingDots />}
            {error && <p className="text-[13px] text-secondary">{error}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft, false);
            }}
            className="border-t border-black/5 px-3 py-3"
          >
            {/* One box that grows, with the button inside it. The button used
                to sit outside on its own, which meant a second line pushed the
                field taller while the button stayed pinned to the bottom of a
                row that no longer matched it. */}
            <div className="relative rounded-xl border border-black/10 transition-colors focus-within:border-primary">
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
                placeholder="Ask about tutoring or admissions"
                // pr-10 keeps every line clear of the button rather than only
                // the last one, so the right edge stays straight as it wraps.
                className="block max-h-32 w-full resize-none overflow-y-auto bg-transparent py-2.5 pl-3 pr-10 text-[13.5px] leading-relaxed outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send"
                className="absolute bottom-1.5 right-1.5 p-1.5 text-primary transition-colors hover:text-primary-hover disabled:text-[#54656f]/40"
              >
                <Send size={17} />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "model"; text: string }) {
  if (role === "user") {
    return (
      <p className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-[13.5px] leading-relaxed text-white">
        {text}
      </p>
    );
  }
  // Plain text with no container. The assistant is the voice of the page, and
  // wrapping it in a second bubble makes a short answer look like a receipt.
  return (
    <p className="max-w-[92%] whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#111]">
      {linkify(text)}
    </p>
  );
}

/**
 * Voice mode.
 *
 * One control and one thing moving. What the assistant is doing has to be
 * readable from across a room, so state is carried by the orb rather than by
 * words: still when idle, rings when listening, a slow sweep when thinking, and
 * a level meter when speaking.
 */
function VoicePanel({
  phase,
  interim,
  spokenQuestion,
  answer,
  history,
  started,
  error,
  voices,
  voiceId,
  onVoice,
  onStart,
  onStop,
}: {
  phase: Phase;
  /** What is being said right now, before the engine has committed to it. */
  interim: string;
  /** The last thing the visitor asked out loud. */
  spokenQuestion: string;
  /** The answer, streaming or finished. */
  answer: string;
  /** Everything before the current exchange, oldest first. */
  history: AssistantTurn[];
  /** Whether the microphone has been used yet this session. */
  started: boolean;
  error: string | null;
  voices: SpeechSynthesisVoice[];
  voiceId: string;
  onVoice: (id: string) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const CAPTION: Record<Phase, string> = {
    idle: "Tap to talk",
    listening: "Listening",
    thinking: "Thinking",
    speaking: "Speaking",
  };

  const busy = phase !== "idle";

  // Keep the newest exchange in view as the faded history grows above it.
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history.length, spokenQuestion, answer]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between px-5 py-6">
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
              // Three bars is enough to read as a voice. A real level meter
              // would need the audio graph, and SpeechSynthesis does not
              // expose one, so an honest animation beats a fake waveform.
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

        <p className="text-[13px] text-[#54656f]">{CAPTION[phase]}</p>

        {/* The conversation as it happens, teal for the person and plain for
            the assistant, so who said what is readable without labels.
            Everything before the current exchange is faded: it is context for
            where you are, not something to read, and the full transcript is
            waiting under the keyboard button. */}
        <div
          ref={transcriptRef}
          className="min-h-[4.5rem] w-full flex-1 space-y-2 overflow-y-auto text-center"
        >
          {history.map((t, i) => (
            <p
              key={i}
              className={cn(
                "text-[13px] leading-relaxed opacity-35",
                t.role === "user" ? "text-primary" : "text-[#111]"
              )}
            >
              {t.text}
            </p>
          ))}

          {spokenQuestion && (
            <p className="text-[13.5px] leading-relaxed text-primary">{spokenQuestion}</p>
          )}
          {interim && <p className="text-[13.5px] leading-relaxed text-primary/50">{interim}</p>}
          {answer && (
            <p className="text-[13.5px] leading-relaxed text-[#111]">{linkify(answer)}</p>
          )}
        </div>

        {error && <p className="text-center text-[13px] text-secondary">{error}</p>}
      </div>

      {/* Gone once the conversation starts. Choosing a voice is a thing you do
          before you begin, and a dropdown under a live transcript is a control
          competing with the thing it was set up for. */}
      {!started && voices.length > 1 && (
        <Dropdown
          value={voiceId}
          onChange={onVoice}
          options={voices.slice(0, 12).map((v) => ({ value: v.voiceURI, label: v.name }))}
          size="sm"
          ariaLabel="Choose a voice"
          className="w-full"
          buttonClassName="text-[#54656f]"
        />
      )}
    </div>
  );
}
