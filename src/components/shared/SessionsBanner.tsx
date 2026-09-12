import React from "react";
import { CalendarRange } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * The head of a sessions page: what you are looking at, how much of it there
 * is, and which half of it to show.
 *
 * Shared because the counsellor and the student are looking at the same
 * sessions from opposite ends, and two pages built to look alike drift. The
 * student's advising page was a stacked pair of headed sections while the
 * counsellor's had a banner, stats and tabs; the same booking rendered two
 * different ways depending on who opened it.
 *
 * Presentational only. Which sessions, and what may be done to them, stays
 * with the page.
 */
export interface SessionsTab {
  id: string;
  label: string;
}

export function SessionsBanner({
  title,
  total,
  completed,
  upcoming,
  tabs,
  activeTab,
  onTab,
  /** The page's own control, such as Book a session. */
  action,
  /** Shown under the title, for a phone's back button. */
  leading,
}: {
  title: string;
  total: number;
  completed: number;
  upcoming: number;
  tabs: SessionsTab[];
  activeTab: string;
  onTab: (id: string) => void;
  action?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-primary px-4 pt-6 text-white md:px-8">
      <svg
        className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
        <path
          d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.3"
        />
      </svg>

      <div className="relative z-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-4 text-[13px] text-white/80">
              <span className="flex items-center gap-1.5">
                <CalendarRange size={13} /> {total} Total Sessions
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-start gap-6 border-t border-white/20 pt-4 sm:flex-row sm:items-center xl:gap-10 xl:border-t-0 xl:pt-0 xl:justify-end">
          <div className="flex w-full items-center justify-between gap-6 sm:w-auto sm:gap-12 xl:justify-end">
            <MinimalStat label="Total" value={total} />
            <MinimalStat label="Completed" value={completed} />
            <MinimalStat label="Upcoming" value={upcoming} />
          </div>
          {action}
        </div>
      </div>

      <div className="relative z-10 mt-8 flex items-center gap-6 overflow-x-auto border-b border-white/20">
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            label={t.label}
            active={activeTab === t.id}
            onClick={() => onTab(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MinimalStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-left">
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-white/70">{label}</p>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // relative, not a negative margin. The row scrolls sideways on a phone,
      // and an overflow container clips a child pulled outside its content
      // box, which took the active tab's underline off the screen entirely.
      className={cn(
        "relative top-px shrink-0 whitespace-nowrap border-b-2 px-1 pb-3 text-[14px] outline-none transition-colors",
        active
          ? "border-white font-medium text-white"
          : "border-transparent text-white/60 hover:border-white/30 hover:text-white/90"
      )}
    >
      {label}
    </button>
  );
}
