import { useEffect, useState } from "react";

// ============================================================
// The pieces both assistants draw with.
//
// They are deliberately shared while the assistants themselves are not: the
// landing one answers strangers about the product from public text, the portal
// one answers signed-in people about the app from role-scoped text, and they
// run on different providers. None of that changes what a typing indicator or
// a clickable address looks like, so those live here and the two widgets stay
// about their own behaviour.
// ============================================================

/**
 * Turns addresses and links in an answer into things you can click.
 *
 * Done at render rather than by asking the model for markdown: markdown would
 * have to be parsed, the speech voice would read the punctuation aloud, and a
 * model that emits links sometimes emits broken ones. A regex over plain text
 * can only ever link something that is genuinely there.
 */
const LINKABLE = /([\w.+-]+@[\w-]+\.[\w.-]+[\w])|(https?:\/\/[^\s<>()]+[^\s<>().,])/g;

export function linkify(text: string): React.ReactNode[] {
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
 * which is what this is, and they sit on the line the answer will occupy so
 * nothing jumps when it arrives.
 */
export function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Thinking">
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
        />
      ))}
    </span>
  );
}

/**
 * The answer, revealed at a readable pace.
 *
 * Tokens are painted as they land, but a fast model finishes a short answer
 * about a hundred milliseconds after starting it, so the paragraph appears at
 * once and the streaming is wasted on the eye. This paces the reveal just
 * behind the arrival and catches up proportionally, so a quick answer reads as
 * typed and a slow one is never held back.
 *
 * Only mounted while an answer is in flight; a finished turn renders as plain
 * text, which is what stops the interval running forever.
 */
export function StreamingText({ text, className }: { text: string; className?: string }) {
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
    <p className={className}>
      {linkify(shown)}
      {shown.length < text.length && (
        <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-primary" />
      )}
    </p>
  );
}

/**
 * Grows a composer to fit what has been typed.
 *
 * Height is reset to auto first, or scrollHeight only ever reports the taller
 * of the two and the box grows but never shrinks when a line is deleted. The
 * ceiling belongs in CSS, as a max-height, so the overflow scrolls past it.
 */
export function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}
