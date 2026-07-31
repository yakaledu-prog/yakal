import { useId, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";

// ============================================================
// A tooltip.
//
// The native `title` attribute was doing this job, badly: it waits about a
// second, cannot be styled, never appears on touch, and is invisible to a
// screen reader unless the element has no other label.
//
// This one shows on hover and on keyboard focus, and is wired up with
// aria-describedby so it is announced rather than merely drawn.
//
// It is deliberately not a portal. Every use so far sits inside a normal
// document flow, and a portal would need scroll and resize listeners to stay
// attached. If one ever has to escape an `overflow: hidden` ancestor, that is
// the point to add it, not before.
// ============================================================

type Side = "top" | "bottom" | "left" | "right";

const SIDE: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const ARROW: Record<Side, string> = {
  top: "top-full left-1/2 -translate-x-1/2 -mt-1",
  bottom: "bottom-full left-1/2 -translate-x-1/2 -mb-1",
  left: "left-full top-1/2 -translate-y-1/2 -ml-1",
  right: "right-full top-1/2 -translate-y-1/2 -mr-1",
};

export function Tooltip({
  content,
  side = "top",
  /** Caps the bubble width so a sentence wraps instead of running off screen. */
  width = 240,
  className,
  contentClassName,
  children,
}: {
  content: ReactNode;
  side?: Side;
  width?: number;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!content) return <>{children}</>;

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // Focus and blur bubble from the wrapped control, so a tooltip on a
      // button or a link works from the keyboard without extra wiring.
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}

      {open && (
        <span
          id={id}
          role="tooltip"
          style={{ maxWidth: width }}
          className={cn(
            "pointer-events-none absolute z-50 w-max rounded-lg bg-[#111b21] px-2.5 py-1.5",
            "text-left text-[12.5px] font-normal leading-snug text-white shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            "dark:bg-[#2a3942]",
            SIDE[side],
            contentClassName
          )}
        >
          {content}
          <span
            aria-hidden="true"
            className={cn("absolute h-2 w-2 rotate-45 bg-[#111b21] dark:bg-[#2a3942]", ARROW[side])}
          />
        </span>
      )}
    </span>
  );
}
