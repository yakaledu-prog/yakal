import { CalendarDays, CheckCircle2, Loader2, Star, XCircle } from "lucide-react";

import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

// ============================================================
// A list of sessions.
//
// Every role looks at the same rows and asks the same three things: when, with
// whom, and is there anything to do about it. So the list is shared, and what
// differs is only which person is named and which action is offered.
//
// Used in the student's course Sessions tab for now. It is written to be used
// elsewhere, but only wired in one place until the shape has settled.
// ============================================================

export interface SessionListItem {
  id: string;
  /** ISO date, e.g. "2026-08-17". */
  date: string;
  /** 24 hour "HH:MM". */
  startTime: string;
  durationMinutes: number;
  status: string;
  /** What the session is about. */
  title: string;
  /** The other party: the tutor for a student, the student for a tutor. */
  personName: string | null;
  personAvatarUrl?: string | null;
  /** Written afterwards by the tutor. */
  note?: string | null;
  rating?: number | null;
}

function startsAt(item: SessionListItem): Date {
  const [h, m] = item.startTime.split(":").map(Number);
  const d = new Date(`${item.date}T00:00:00`);
  d.setHours(h, m ?? 0, 0, 0);
  return d;
}

function timeRange(item: SessionListItem): string {
  const from = startsAt(item);
  const to = new Date(from.getTime() + (item.durationMinutes || 60) * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${fmt(from)} - ${fmt(to)}`;
}

/**
 * "Today", "Tomorrow", or the status.
 *
 * A date already sits in the left column, so repeating it here would say the
 * same thing twice. What is worth saying is how soon it is.
 */
function whenLabel(item: SessionListItem): string {
  if (item.status !== "upcoming") return item.status;

  const start = startsAt(item);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((start.getTime() - midnight.getTime()) / 86_400_000);

  if (days < 0) return "Missed";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "Upcoming";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 size={15} />;
  if (status === "cancelled" || status === "no-show") return <XCircle size={15} />;
  return <CalendarDays size={15} />;
}

export function SessionList({
  sessions,
  isLoading = false,
  emptyText = "No sessions yet.",
  /** Rendered on the right of a row, for whatever this role can do about it. */
  renderAction,
  className,
}: {
  sessions: SessionListItem[];
  isLoading?: boolean;
  emptyText?: string;
  renderAction?: (session: SessionListItem) => React.ReactNode;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-[#1099A1]" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return <p className="py-16 text-center text-[14px] text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className={cn("divide-y divide-border", className)}>
      {sessions.map((s) => {
        const start = startsAt(s);
        const upcoming = s.status === "upcoming";
        const completed = s.status === "completed";
        const label = whenLabel(s);

        return (
          <div key={s.id} className="flex flex-wrap items-center gap-4 py-5 md:flex-nowrap">
            {/* Date, as its own column so the eye can run down it */}
            <div className="w-12 shrink-0 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#1099A1]">
                {start.toLocaleDateString(undefined, { month: "short" })}
              </p>
              <p className="text-[24px] font-medium leading-none tabular-nums text-foreground">
                {String(start.getDate()).padStart(2, "0")}
              </p>
            </div>

            <img
              src={s.personAvatarUrl || dicebearUrl(s.personName ?? "Yakal")}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-foreground">{s.title}</p>
              {s.personName && (
                <p className="truncate text-[13px] text-muted-foreground">{s.personName}</p>
              )}
              {completed && s.note && (
                <div className="mt-1.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Session note
                  </p>
                  <p className="text-[13px] text-foreground">{s.note}</p>
                </div>
              )}
            </div>

            <div className="shrink-0">
              <p
                className={cn(
                  "flex items-center gap-1.5 text-[13.5px] font-medium capitalize",
                  upcoming ? "text-[#1099A1]" : "text-muted-foreground"
                )}
              >
                <StatusIcon status={s.status} />
                {label}
              </p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">{timeRange(s)}</p>
            </div>

            {/* A rating only exists once a session has happened. */}
            {completed && s.rating != null && (
              <div className="flex shrink-0 items-center gap-1 text-[13.5px] text-foreground">
                <Star size={14} className="fill-[#CAA25F] text-[#CAA25F]" />
                {s.rating.toFixed(1)}
              </div>
            )}

            {renderAction && <div className="shrink-0">{renderAction(s)}</div>}
          </div>
        );
      })}
    </div>
  );
}
