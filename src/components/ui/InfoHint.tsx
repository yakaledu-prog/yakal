import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Tooltips should feel instant, so these are short. The exit is quicker than
 * the entrance: once you have moved away you have stopped caring about it, and
 * a slow fade out reads as lag.
 */
const ENTER_MS = 140;
const EXIT_MS = 110;
/** Hover intent, so sweeping the cursor across a row of icons does not flash. */
const OPEN_DELAY_MS = 120;

/**
 * Small info affordance next to a field label.
 *
 * Exists so the form can stay short. Anything that would otherwise be a line of
 * helper text under every input goes in here instead, which keeps the default
 * view clean for people who already know what a field means.
 *
 * Opens on hover and on focus, so it is reachable by keyboard and not only by
 * mouse. Portalled so a modal cannot clip it.
 */
export function InfoHint({
  text,
  className,
  size = 13,
}: {
  text: string;
  className?: string;
  size?: number;
}) {
  /** Intent: the pointer is on the icon, or it has focus. */
  const [open, setOpen] = useState(false);
  /** In the DOM. Stays true through the exit transition so it can play out. */
  const [mounted, setMounted] = useState(false);
  /** Drives the transition classes, flipped a frame after mounting. */
  const [shown, setShown] = useState(false);

  const ref = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(
    null
  );

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const H = 90;
    const W = 240;
    const flip = window.innerHeight - r.bottom < H && r.top > H;
    setPos({
      top: flip ? r.top - 8 : r.bottom + 8,
      left: Math.max(8, Math.min(r.left - W / 2 + r.width / 2, window.innerWidth - W - 8)),
      flip,
    });
  }, []);

  /**
   * Enter and exit both need a frame where the element exists but is not yet in
   * its final state, so the transition has something to animate between.
   *
   * Opening: mount, measure, then flip `shown` on the next frame.
   * Closing: flip `shown` off first and only unmount once the transition has
   * finished, which is the part a plain conditional render cannot do.
   */
  useLayoutEffect(() => {
    clearTimers();

    if (open) {
      setMounted(true);
      measure();
      // Two frames: one for the browser to paint the initial state, one to
      // change it. A single rAF is occasionally coalesced and the entry snaps.
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShown(true))
      );
      return () => cancelAnimationFrame(raf);
    }

    setShown(false);
    timers.current.push(
      window.setTimeout(() => setMounted(false), EXIT_MS)
    );
  }, [open, measure]);

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!mounted) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [mounted]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        // Hover waits out the intent delay. Focus, click and leaving are all
        // deliberate, so they act at once.
        onMouseEnter={() => {
          clearTimers();
          timers.current.push(window.setTimeout(() => setOpen(true), OPEN_DELAY_MS));
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={cn(
          "inline-grid place-items-center align-middle text-[#c2c7d0] transition-colors hover:text-primary focus:text-primary focus:outline-none dark:text-[#5a6b75]",
          className
        )}
      >
        <Info size={size} strokeWidth={2} />
      </button>

      {mounted && pos && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: 240,
            // The flip offset and the animation share one transform, so they
            // are composed here rather than fighting over the property.
            transform: [
              pos.flip ? "translateY(-100%)" : "translateY(0)",
              shown ? "translateY(0)" : `translateY(${pos.flip ? "6px" : "-6px"})`,
              shown ? "scale(1)" : "scale(0.96)",
            ].join(" "),
            // Grow out of the edge nearest the icon rather than the centre.
            transformOrigin: pos.flip ? "bottom center" : "top center",
            opacity: shown ? 1 : 0,
            transitionProperty: "opacity, transform",
            transitionDuration: `${shown ? ENTER_MS : EXIT_MS}ms`,
            // Slight overshoot on the way in, plain ease on the way out.
            transitionTimingFunction: shown
              ? "cubic-bezier(0.16, 1, 0.3, 1)"
              : "cubic-bezier(0.4, 0, 1, 1)",
          }}
          className="pointer-events-none z-[110] rounded-lg bg-[#111b21] px-3 py-2 text-[12px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl motion-reduce:transition-none dark:bg-[#2a3942]"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
}

/** Label with an optional hint, so the pairing stays consistent everywhere. */
export function FieldLabel({
  children,
  hint,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  htmlFor?: string;
  className?: string;
}) {
  const content = (
    <>
      {children}
      {hint && <InfoHint text={hint} className="ml-1" />}
    </>
  );

  // Sentence case at medium weight. Uppercase + bold on every label makes a
  // form shout, and once everything is emphasised nothing is.
  const cls = cn(
    "mb-1.5 flex items-center text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]",
    className
  );

  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {content}
    </label>
  ) : (
    <span className={cls}>{content}</span>
  );
}
