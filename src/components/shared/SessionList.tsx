import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, Star, XCircle } from "lucide-react";

import { getSessionExtras } from "@/services/sessions";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

// ============================================================
// A list of sessions.
//
// Every role looks at the same rows and asks the same three things: when, with
// whom, and is there anything to do about it. So the list is shared, and what
// differs is only which person is named and which action is offered.
//
// Three pieces, because every page shows the same two lists in a different
// frame: SessionList draws the rows, UpcomingSessions and PastSessions decide
// which rows belong in which and what can be done about them. A page that
// wants tabs renders the two separately; a page that wants one column renders
// them one after the other.
//
// The split is by clock, not by the status column. A session still marked
// upcoming an hour after it ended has not been confirmed by anybody, so it
// belongs in the past list with something to do about it, not in the upcoming
// one pretending it is still to come.
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
  /** Stars the student gave, once the session has been rated. */
  rating?: number | null;
  /** Minutes actually spent in the meeting, where we recorded it. */
  attendedMinutes?: number | null;
}

export function startsAt(item: SessionListItem): Date {
  const [h, m] = item.startTime.split(":").map(Number);
  const d = new Date(`${item.date}T00:00:00`);
  d.setHours(h, m ?? 0, 0, 0);
  return d;
}

function endsAt(item: SessionListItem): Date {
  return new Date(startsAt(item).getTime() + (item.durationMinutes || 60) * 60_000);
}

/**
 * The session has been and gone and nobody has said what happened.
 *
 * This is the state the tutor's Mark as done acts on, and the only reason the
 * split is by clock rather than by status.
 */
export function isAwaitingConfirmation(item: SessionListItem): boolean {
  return item.status === "upcoming" && endsAt(item).getTime() < Date.now();
}

/** Still to come: not yet finished, and not cancelled. */
export function isStillToCome(item: SessionListItem): boolean {
  return item.status === "upcoming" && !isAwaitingConfirmation(item);
}

/**
 * Joining is only useful on the day. A link offered a fortnight early invites
 * somebody to click it and find an empty room, so what a later session offers
 * instead is a way to move it.
 */
export function isJoinable(item: SessionListItem): boolean {
  if (!isStillToCome(item)) return false;
  return startsAt(item).toDateString() === new Date().toDateString();
}

/** Soonest first for what is coming, most recent first for what has been. */
export function splitSessions(sessions: SessionListItem[]) {
  const byTime = (a: SessionListItem, b: SessionListItem) =>
    startsAt(a).getTime() - startsAt(b).getTime();

  return {
    upcoming: sessions.filter(isStillToCome).sort(byTime),
    past: sessions.filter((s) => !isStillToCome(s)).sort((a, b) => byTime(b, a)),
  };
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
  if (item.status !== "upcoming") {
    return item.status.charAt(0).toUpperCase() + item.status.slice(1);
  }
  // Not "Missed": nobody knows yet whether it happened, which is the point.
  if (isAwaitingConfirmation(item)) return "Awaiting confirmation";

  const start = startsAt(item);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.floor((start.getTime() - midnight.getTime()) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "Upcoming";
}

function StatusIcon({ item }: { item: SessionListItem }) {
  // Waiting on somebody carries no icon. The words say it, and the colour
  // already sets it apart from the rows that are settled.
  if (isAwaitingConfirmation(item)) return null;
  if (item.status === "completed") return <Check size={15} />;
  if (item.status === "cancelled" || item.status === "no-show") return <XCircle size={15} />;
  return <CalendarDays size={15} />;
}

export function SessionList({
  sessions,
  isLoading = false,
  emptyText = "No sessions yet.",
  /** Rendered on the right of a row, for whatever this role can do about it. */
  renderAction,
  /** Given, an unrated finished session invites the student to rate it. */
  onRate,
  /** Stays stacked at every width, for a narrow column like the home agenda. */
  compact = false,
  className,
}: {
  sessions: SessionListItem[];
  isLoading?: boolean;
  emptyText?: string;
  renderAction?: (session: SessionListItem) => React.ReactNode;
  onRate?: (session: SessionListItem) => void;
  compact?: boolean;
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
        const upcoming = isStillToCome(s);
        const completed = s.status === "completed";
        const label = whenLabel(s);

        return (
          <div key={s.id} className={compact ? "py-4" : "py-6 md:py-8"}>
            {/* Two lines on a phone and one on a desktop. Squeezed onto a
                single line, a narrow screen truncates the subject and the
                person to initials, which is everything worth reading. */}
            <div
              className={cn(
                "flex flex-col gap-3",
                !compact && "md:flex-row md:items-center md:gap-4"
              )}
            >
              <div className={cn("flex min-w-0 items-center gap-4", !compact && "md:flex-1")}>
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
                </div>
              </div>

              {/* On a phone this is the second line, indented to sit under the
                  subject rather than under the date. */}
              <div
                className={cn(
                  "flex items-center justify-between gap-4 pl-16",
                  !compact && "md:justify-end md:gap-4 md:pl-0"
                )}
              >
                <div className="shrink-0">
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-[13.5px] font-medium",
                      isAwaitingConfirmation(s)
                        ? "text-[#CAA25F]"
                        : upcoming
                          ? "text-[#1099A1]"
                          : "text-muted-foreground"
                    )}
                  >
                    <StatusIcon item={s} />
                    {label}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {timeRange(s)}
                    {completed && s.attendedMinutes != null && ` \u00b7 ${s.attendedMinutes} min attended`}
                  </p>
                </div>

                {/* A rating only exists once a session has happened. The column
                    is kept even when unrated, so the ones that are line up. */}
                {completed && (
                  <div className="w-20 shrink-0 text-right">
                    {s.rating != null ? (
                      <span className="inline-flex items-center gap-1 text-[13.5px] text-foreground">
                        <Star size={14} className="fill-[#CAA25F] text-[#CAA25F]" />
                        {s.rating.toFixed(1)}
                      </span>
                    ) : onRate ? (
                      // The invitation lives in the rating column rather than
                      // as another button on the right: it is the same slot
                      // the answer will occupy.
                      <button
                        type="button"
                        onClick={() => onRate(s)}
                        className="text-[12.5px] font-medium text-[#1099A1] hover:underline"
                      >
                        Rate
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-muted-foreground">Not rated</span>
                    )}
                  </div>
                )}

                {renderAction && <div className="shrink-0">{renderAction(s)}</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// The two lists every page shows.
//
// Both take the whole set of sessions and choose their own rows, so a page
// never has to know that "upcoming" in the status column and upcoming on the
// clock are different things.
// ============================================================

/**
 * What is still to come.
 *
 * Today's session offers Join because that is the only day the link works.
 * Everything later offers Reschedule, which is the useful thing to do with a
 * session that is a fortnight away.
 */
export function UpcomingSessions({
  sessions,
  isLoading,
  emptyText = "Nothing booked yet.",
  hideIfEmpty = false,
  onJoin,
  onReschedule,
  compact = false,
  /** Show only the first few, for a home page agenda with a View all beside it. */
  limit,
  className,
}: {
  sessions: SessionListItem[];
  isLoading?: boolean;
  emptyText?: string;
  /** For a page that runs both lists together and owns the empty state itself. */
  hideIfEmpty?: boolean;
  compact?: boolean;
  limit?: number;
  /** Omitted, and no session offers Join: a parent watches, they do not attend. */
  onJoin?: (session: SessionListItem) => void;
  onReschedule?: (session: SessionListItem) => void;
  className?: string;
}) {
  const { upcoming } = splitSessions(sessions);
  if (hideIfEmpty && upcoming.length === 0) return null;

  return (
    <SessionList
      compact={compact}
      sessions={limit ? upcoming.slice(0, limit) : upcoming}
      isLoading={isLoading}
      emptyText={emptyText}
      className={className}
      renderAction={(s) => {
        if (onJoin && isJoinable(s)) {
          return (
            <button
              type="button"
              onClick={() => onJoin(s)}
              className="h-10 rounded-md bg-[#1099A1] px-6 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Join
            </button>
          );
        }
        if (onReschedule) {
          return (
            <button
              type="button"
              onClick={() => onReschedule(s)}
              className="h-10 rounded-md border border-[#1099A1] px-5 text-[14px] font-medium text-[#1099A1] transition-colors hover:bg-[#1099A1]/10"
            >
              Reschedule
            </button>
          );
        }
        return null;
      }}
    />
  );
}

/**
 * What has been.
 *
 * Completed, cancelled, and the ones that have run their hour without anybody
 * saying so. That last group is why renderAction is here at all: it is where
 * the tutor's Mark as done belongs, and only the tutor's page passes it.
 */
export function PastSessions({
  sessions,
  isLoading,
  emptyText = "No past sessions.",
  hideIfEmpty = false,
  renderAction,
  onRate,
  compact = false,
  limit,
  className,
}: {
  sessions: SessionListItem[];
  isLoading?: boolean;
  emptyText?: string;
  hideIfEmpty?: boolean;
  compact?: boolean;
  limit?: number;
  renderAction?: (session: SessionListItem) => React.ReactNode;
  onRate?: (session: SessionListItem) => void;
  className?: string;
}) {
  const { past } = splitSessions(sessions);
  if (hideIfEmpty && past.length === 0) return null;

  return (
    <SessionList
      compact={compact}
      sessions={limit ? past.slice(0, limit) : past}
      isLoading={isLoading}
      emptyText={emptyText}
      className={className}
      renderAction={renderAction}
      onRate={onRate}
    />
  );
}

/**
 * Ratings and attended minutes for a list of sessions.
 *
 * Every page that shows past sessions wants both, and neither belongs on the
 * sessions row itself: one is written by the student afterwards, the other is
 * accumulated while the meeting runs. Asked for the whole list at once, and
 * keyed on the ids so switching a filter does not refetch what is unchanged.
 */
export function useSessionExtras(sessions: { id: string }[]) {
  const ids = sessions.map((s) => s.id).sort();
  return useQuery({
    queryKey: ["session-extras", ids.join(",")],
    queryFn: () => getSessionExtras(ids),
    enabled: ids.length > 0,
  });
}
