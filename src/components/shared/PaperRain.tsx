import { FileText, NotebookPen, Paperclip, PencilLine, Sigma } from "lucide-react";

import { cn } from "@/utils/cn";

// ============================================================
// Waiting for the work to arrive.
//
// A spinner says something is happening. This says what: paper, coming from
// somewhere else. Fetching a class from Google is slower than a database read
// and the wait is long enough to notice, which is exactly when a screen should
// be doing something rather than nothing.
//
// Outlines on the page's own background, no plates and no fills, so it reads
// as a texture rather than a second interface arriving before the first.
// ============================================================

/** Enough variety that no two neighbours match, few enough to stay quiet. */
const ICONS = [FileText, NotebookPen, PencilLine, Paperclip, Sigma];

/**
 * Fixed rather than random.
 *
 * A fresh Math.random() on every render restarts every animation whenever the
 * parent redraws, so the sheets jump. These are chosen once and by hand: left
 * position, the delay before it starts, how long it falls, and its size.
 */
const SHEETS = [
  { left: 8, delay: 0, duration: 2.6, size: 22, icon: 0 },
  { left: 24, delay: 0.55, duration: 3.1, size: 17, icon: 1 },
  { left: 39, delay: 1.15, duration: 2.4, size: 26, icon: 2 },
  { left: 53, delay: 0.3, duration: 3.4, size: 19, icon: 3 },
  { left: 68, delay: 1.5, duration: 2.8, size: 23, icon: 4 },
  { left: 82, delay: 0.85, duration: 3.0, size: 16, icon: 0 },
  { left: 92, delay: 1.9, duration: 2.5, size: 20, icon: 2 },
];

export function PaperRain({
  label = "Fetching the work set on this course",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center py-16", className)}
      role="status"
      aria-live="polite"
    >
      <div className="relative h-[120px] w-full max-w-[320px] overflow-hidden">
        {SHEETS.map((s, i) => {
          const Icon = ICONS[s.icon];
          return (
            <span
              key={i}
              className="paper-sheet absolute top-0 text-[#1099A1]"
              style={{
                left: `${s.left}%`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            >
              <Icon size={s.size} strokeWidth={1.5} />
            </span>
          );
        })}
      </div>

      <p className="mt-1 text-[13px] text-muted-foreground">{label}</p>
    </div>
  );
}
