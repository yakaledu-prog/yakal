import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================
// Voice, entirely in the browser.
//
// Why not Edge TTS, which was the first idea. edge-tts is a websocket to a
// Microsoft endpoint that is not a public API: it needs a token derived from a
// clock skew trick, it breaks when Microsoft changes it, and on a serverless
// plan it costs a socket per sentence plus the round trip to open it. In
// exchange it gives voices the browser already has, because Edge's own
// SpeechSynthesis exposes the same neural voices that edge-tts pulls.
//
// So this uses SpeechSynthesis. It is free, it needs no backend, no key and no
// function slot, it starts speaking in milliseconds rather than after a network
// round trip, and it degrades to whatever voices the machine has. For a
// conversation the latency matters more than the timbre.
//
// SpeechRecognition is Chrome, Edge and Safari. Firefox has neither the flag
// nor an implementation, so voice mode is offered only when it is really there
// rather than failing on click.
// ============================================================

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () =>
  recognitionCtor() !== null && typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * Best available voice for a language.
 *
 * Named voices beat the default: "Natural" and "Neural" are the modern ones on
 * Windows and Edge, and the difference between those and the old formant
 * voices is the difference between a conversation and a train announcement.
 */
function rankVoice(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  let score = 0;
  if (/natural|neural|online/.test(n)) score += 100;
  if (/google/.test(n)) score += 60;
  if (v.localService) score += 5;
  if (v.default) score += 3;
  return score;
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // getVoices() is empty on first call in Chrome and fills in asynchronously,
    // which is why this listens as well as reads.
    const read = () => {
      const all = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(all.sort((a, b) => rankVoice(b) - rankVoice(a)));
    };
    read();
    window.speechSynthesis.addEventListener("voiceschanged", read);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", read);
  }, []);

  return voices;
}

/**
 * Speaking, one sentence at a time.
 *
 * Answers arrive as a token stream, and waiting for the full paragraph before
 * saying a word wastes the whole benefit of streaming. `speak` is called with
 * complete sentences as they finish, and the browser queues them, so the voice
 * starts while the model is still writing.
 */
export function useSpeaker(voice: SpeechSynthesisVoice | null) {
  const [speaking, setSpeaking] = useState(false);
  // Utterances are held so the garbage collector cannot take one mid-sentence,
  // which in Chrome silently truncates the speech.
  const pending = useRef<SpeechSynthesisUtterance[]>([]);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    pending.current = [];
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const u = new SpeechSynthesisUtterance(trimmed);
      if (voice) u.voice = voice;
      u.rate = 1.05;
      u.pitch = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        pending.current = pending.current.filter((p) => p !== u);
        if (pending.current.length === 0) setSpeaking(false);
      };
      u.onerror = () => {
        pending.current = pending.current.filter((p) => p !== u);
        if (pending.current.length === 0) setSpeaking(false);
      };

      pending.current.push(u);
      window.speechSynthesis.speak(u);
    },
    [voice]
  );

  useEffect(() => cancel, [cancel]);

  return { speak, cancel, speaking };
}

/**
 * How long a pause is allowed before a question counts as finished.
 *
 * Long enough to think mid-sentence, short enough that finishing a question
 * does not feel like waiting for a machine to notice.
 */
const SILENCE_MS = 1400;

/**
 * Listening.
 *
 * `continuous` is on, and that is the fix for being cut off mid-question.
 * With it off the engine ends the session at the first pause it considers a
 * sentence boundary, which is any breath in the middle of "what does the, um,
 * Premier tier include" - and it ends the whole turn, not just the phrase.
 *
 * So the engine now stays open and the pause is timed here instead. Every
 * final phrase is appended, and a turn is only sent after SILENCE_MS with
 * nothing new. That keeps tap-to-talk, rather than making people hold a button
 * down while they think.
 *
 * `interimResults` is on so the panel can show words as they are said. Only
 * final text is ever sent: interim text is a guess the engine revises, and
 * sending it would ask the model about a sentence nobody finished.
 */
export function useListener({
  onFinal,
  onInterim,
}: {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SpeechRecognitionLike | null>(null);

  // Held in refs so restarting recognition does not need the callbacks in the
  // dependency list, which would tear down the recogniser on every render of
  // the panel above it.
  //
  // Written in an effect rather than during render: a ref assigned while
  // rendering is a side effect in a function React may run twice or throw away,
  // and the compiler rules flag it. No dependency array, so they stay current
  // after every commit.
  const finalCb = useRef(onFinal);
  const interimCb = useRef(onInterim);
  useEffect(() => {
    finalCb.current = onFinal;
    interimCb.current = onInterim;
  });

  // The phrases heard so far this turn, and the timer that decides the turn is
  // over. Refs rather than state: they change on every syllable and nothing
  // renders from them directly.
  const heard = useRef("");
  const silence = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearSilence = () => {
    if (silence.current) clearTimeout(silence.current);
    silence.current = undefined;
  };

  const stop = useCallback(() => {
    clearSilence();
    ref.current?.stop();
    setListening(false);
    // Anything already said still counts. Tapping stop mid-question should
    // send the question, not bin it.
    const pending = heard.current.trim();
    heard.current = "";
    if (pending) finalCb.current(pending);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return setError("This browser cannot listen. Chrome, Edge and Safari can.");

    // A previous session that has not fully ended will throw on start().
    ref.current?.abort();
    clearSilence();
    heard.current = "";

    const rec = new Ctor();
    rec.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    const armSilence = () => {
      clearSilence();
      silence.current = setTimeout(() => {
        const question = heard.current.trim();
        heard.current = "";
        rec.stop();
        setListening(false);
        if (question) finalCb.current(question);
      }, SILENCE_MS);
    };

    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) heard.current = `${heard.current} ${String(result[0].transcript)}`.trim();
        else interim += result[0].transcript;
      }
      // Both kinds of result mean somebody is still talking, so both push the
      // deadline out. Timing only the final ones would cut off anyone with a
      // long sentence, which is the bug this replaced.
      armSilence();
      interimCb.current(`${heard.current} ${interim}`.trim());
    };

    rec.onerror = (e: any) => {
      // "aborted" is what stopping deliberately looks like, and "no-speech" is
      // somebody thinking. Neither is worth an error message.
      if (e?.error === "aborted" || e?.error === "no-speech") return;
      setError(
        e?.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser to talk."
          : "The microphone stopped working."
      );
      setListening(false);
    };

    rec.onend = () => {
      clearSilence();
      setListening(false);
    };

    ref.current = rec;
    setError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(
    () => () => {
      if (silence.current) clearTimeout(silence.current);
      ref.current?.abort();
    },
    []
  );

  return { start, stop, listening, error };
}

/**
 * Splits a growing string into whole sentences.
 *
 * Feeding the speech queue on every token gives a stuttering word-by-word
 * voice; waiting for the whole answer gives a silent pause. This returns the
 * sentences that have completed since last time and keeps the rest back.
 */
export function takeSentences(buffer: string): { ready: string[]; rest: string } {
  const ready: string[] = [];
  let rest = buffer;

  for (;;) {
    // A sentence end followed by a space, so "hello@yakal.me" and "$1,200.00"
    // do not get cut in half.
    const m = rest.match(/^([\s\S]*?[.!?])(\s+)/);
    if (!m) break;
    const sentence = m[1].trim();
    if (sentence) ready.push(sentence);
    rest = rest.slice(m[0].length);
  }

  return { ready, rest };
}
