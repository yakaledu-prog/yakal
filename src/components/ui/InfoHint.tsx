import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/utils/cn";

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(
    null
  );

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

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        className={cn(
          "inline-grid place-items-center align-middle text-[#c2c7d0] transition-colors hover:text-[#1099A1] focus:text-[#1099A1] focus:outline-none dark:text-[#5a6b75]",
          className
        )}
      >
        <Info size={size} strokeWidth={2} />
      </button>

      {open && pos && createPortal(
        <div
          role="tooltip"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: 240,
            transform: pos.flip ? "translateY(-100%)" : undefined,
          }}
          className="pointer-events-none z-[110] rounded-lg bg-[#111b21] px-3 py-2 text-[12px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl dark:bg-[#2a3942]"
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

  const cls = cn(
    "mb-1.5 flex items-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[#717182]",
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
