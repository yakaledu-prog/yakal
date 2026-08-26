import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Check, Loader2, Star, XCircle } from "lucide-react";

import { getSessionExtras } from "@/services/sessions";
import { dicebearUrl } from "@/utils/avatar";
import { useNow } from "@/hooks/useNow";
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

/** How soon a booked session is, relative to a given moment. */
export type SessionPhase = "live" | "soon" | "overdue" | "later";

/** A session counts as starting soon this many minutes out. */
const SOON_MINUTES = 15;

/**
 * Where a session sits against the clock.
 *
 * Taking `now` as an argument rather than reading it keeps this pure, which is
 * what lets a row be rendered from a ticking value in state instead of the
 * component reaching for the clock partway through a render.
 */
export function sessionPhase(item: SessionListItem, now: number): SessionPhase {
  if (item.status !== "upcoming") return "later";

  const start = startsAt(item).getTime();
  const end = start + (item.durationMinutes || 60) * 60_000;

  if (now >= end) return "overdue";
  if (now >= start) return "live";
  if (start - now <= SOON_MINUTES * 60_000) return "soon";
  return "later";
}

/** "in 12 min", "in 2 h", or how long ago it should have started. */
export function countdownLabel(item: SessionListItem, now: number): string {
  const start = startsAt(item).getTime();
  const minutes = Math.round((start - now) / 60_000);

  if (minutes > 0) {
    if (minutes < 60) return `in ${minutes} min`;
    const hours = Math.round(minutes / 60);
    return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }

  const since = Math.abs(minutes);
  if (since < 1) return "starting now";
  if (since < 60) return `started ${since} min ago`;
  const hours = Math.round(since / 60);
  return `started ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/**
 * A rating as five slots rather than one star and a number.
 *
 * Five slots say "out of five" without a caption, and the fill can land
 * part-way through a star, which a single star and "4.3" cannot show at all.
 * Two stacked rows, the filled one clipped to a percentage.
 */
function Stars({ value }: { value: number }) {
  const slots = [0, 1, 2, 3, 4];
  return (
    <span
      className="relative inline-flex shrink-0"
      role="img"
      aria-label={`${value.toFixed(1)} out of 5`}
    >
      <span className="flex gap-[3px]">
        {slots.map((i) => (
          <Star key={i} size={13} className="shrink-0 text-border" aria-hidden="true" />
        ))}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex gap-[3px] overflow-hidden"
        style={{ width: `${Math.max(0, Math.min(value, 5)) * 20}%` }}
        aria-hidden="true"
      >
        {slots.map((i) => (
          <Star key={i} size={13} className="shrink-0 fill-secondary text-secondary" />
        ))}
      </span>
    </span>
  );
}

/**
 * "Today", "Tomorrow", or the status.
 *
 * A date already sits in the left column, so repeating it here would say the
 * same thing twice. What is worth saying is how soon it is.
 */
function whenLabel(item: SessionListItem, showAwaiting = true): string {
  if (item.status !== "upcoming") {
    return item.status.charAt(0).toUpperCase() + item.status.slice(1);
  }
  // Not "Missed": nobody knows yet whether it happened, which is the point.
  //
  // Withheld from a student on purpose. What is being confirmed is whether the
  // lesson is billable and payable, which is a question for whoever paid and
  // whoever gets paid. A student has nothing to do about it and no stake in the
  // answer, so for them the row simply says Today until it completes.
  if (showAwaiting && isAwaitingConfirmation(item)) return "Awaiting confirmation";

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
  /**
   * Whether to say a finished session is still being confirmed.
   *
   * False for a student: what is being confirmed is whether the lesson is
   * billable and payable, which is a question for whoever paid and whoever gets
   * paid, not for the person who sat in it.
   */
  showAwaitingConfirmation = true,
  className,
}: {
  sessions: SessionListItem[];
  isLoading?: boolean;
  emptyText?: string;
  renderAction?: (session: SessionListItem) => React.ReactNode;
  onRate?: (session: SessionListItem) => void;
  compact?: boolean;
  showAwaitingConfirmation?: boolean;
  className?: string;
}) {
  // Ticks, so a countdown moves without the row reading the clock mid-render.
  const now = useNow();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
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
        const label = whenLabel(s, showAwaitingConfirmation);
        const cancelled = s.status === "cancelled" || s.status === "no-show";
        const phase = sessionPhase(s, now);
        const imminent = phase === "live" || phase === "soon";

        return (
          <div
            key={s.id}
            className={cn(
              compact ? "py-4" : "py-6 md:py-8",
              // A lesson happening now is the one thing on this page worth
              // finding at a glance, so it gets a rail rather than a badge.
              imminent && "-mx-3 border-l-2 border-primary bg-primary/5 px-3",
              phase === "overdue" && "-mx-3 border-l-2 border-destructive px-3"
            )}
          >
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
                  <p className="text-[11px] font-medium uppercase tracking-wider text-primary">
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
                {/* The rating sits before the status, not after.
                    Reading order is what happened, then how it went, then what
                    you can do about it, and the answer occupies the same slot
                    the invitation did. */}
                {completed && (
                  <div className="shrink-0">
                    {s.rating != null ? (
                      <Stars value={s.rating} />
                    ) : onRate ? (
                      <button
                        type="button"
                        onClick={() => onRate(s)}
                        className="rounded-md border border-secondary bg-secondary/10 px-3 py-1.5 text-[12.5px] font-semibold text-[#8a6a2a] transition-colors hover:bg-secondary/20 dark:text-secondary"
                      >
                        Rate
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-muted-foreground">Not rated</span>
                    )}
                  </div>
                )}

                <div className="shrink-0">
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-[13.5px] font-medium",
                      cancelled || phase === "overdue"
                        ? "text-destructive"
                        : imminent
                          ? "text-primary"
                          : isAwaitingConfirmation(s)
                            ? "text-secondary"
                            : upcoming
                              ? "text-primary"
                              : "text-muted-foreground"
                    )}
                  >
                    <StatusIcon item={s} />
                    {/* A countdown beats a date the moment one is close: "in 8
                        min" is what somebody needs, "Today" is not. */}
                    {imminent || phase === "overdue" ? countdownLabel(s, now) : label}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {timeRange(s)}
                    {completed && s.attendedMinutes != null && ` \u00b7 ${s.attendedMinutes} min attended`}
                  </p>
                </div>

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
  rescheduleAs = "client",
  onRequestChange,
  onCancel,
  compact = false,
  /** Show only the first few, for a home page agenda with a View all beside it. */
  limit,
  /** False for a student. See the prop of the same name on SessionList. */
  showAwaitingConfirmation = true,
  className,
}: {
  sessions: SessionListItem[];
  isLoading?: boolean;
  emptyText?: string;
  /** For a page that runs both lists together and owns the empty state itself. */
  hideIfEmpty?: boolean;
  compact?: boolean;
  limit?: number;
  showAwaitingConfirmation?: boolean;
  /** Omitted, and no session offers Join: a parent watches, they do not attend. */
  onJoin?: (session: SessionListItem) => void;
  onReschedule?: (session: SessionListItem) => void;
  /**
   * Who is looking. A tutor may move a session at any time, because their
   * alternative is cancelling or not turning up. A client may move it only
   * while it is more than 24 hours away, which is what the published
   * cancellation policy has always said; inside that they ask instead.
   */
  rescheduleAs?: "client" | "tutor";
  /** Offered to a client inside the 24 hours, in place of Reschedule. */
  onRequestChange?: (session: SessionListItem) => void;
  /**
   * Calling it off entirely. Offered alongside whatever the main action is,
   * and at any notice: the published policy handles a late cancellation with a
   * fee rather than by refusing one, and a family who cannot cancel simply
   * fails to turn up, which is worse for the tutor.
   */
  onCancel?: (session: SessionListItem) => void;
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
      showAwaitingConfirmation={showAwaitingConfirmation}
      renderAction={(s) => {
        // A finished lesson has no action left.
        //
        // It cannot be joined and cannot be moved, so offering either is a
        // button that does nothing or, worse, one that errors. The only thing
        // left to do about it is rate it, and that invitation already sits in
        // the rating slot beside the status.
        if (s.status !== "upcoming") return null;

        // Always in the same place, whatever the main action turns out to be,
        // so a column of rows does not have its buttons at three different
        // widths depending on how far away each lesson is.
        const cancel = onCancel ? (
          <button
            type="button"
            onClick={() => onCancel(s)}
            className="h-10 rounded-md border border-border px-4 text-[14px] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            Cancel
          </button>
        ) : null;

        const withCancel = (main: React.ReactNode) =>
          cancel ? (
            <div className="flex items-center gap-1">
              {main}
              {cancel}
            </div>
          ) : (
            main
          );

        if (onJoin && isJoinable(s)) {
          // Solid only once it is nearly time. A lesson booked for six this
          // evening should not be shouting Join at eight in the morning, but
          // the moment it is close it should be the loudest thing on the row.
          const near = sessionPhase(s, Date.now());
          const live = near === "live" || near === "soon";
          return withCancel(
            <button
              type="button"
              onClick={() => onJoin(s)}
              className={cn(
                "h-10 rounded-md px-6 text-[14px] font-semibold transition-all",
                live
                  ? "bg-primary text-white shadow-sm hover:opacity-90"
                  : "border border-primary/40 text-primary hover:border-primary hover:bg-primary/5"
              )}
            >
              Join
            </button>
          );
        }
        // The clock is read here rather than in the component body on purpose:
        // isJoinable above does the same, and a row deciding its own button
        // partway through a render is the thing the purity rule guards against.
        const mayMove = rescheduleAs === "tutor" || canClientReschedule(s, new Date());

        if (onReschedule && mayMove) {
          return withCancel(
            <button
              type="button"
              onClick={() => onReschedule(s)}
              className="h-10 rounded-md border border-primary px-5 text-[14px] font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Reschedule
            </button>
          );
        }

        // Inside the window the move stops being self-serve. The tutor has
        // held the hour and turned other work away, so it becomes a request.
        if (onRequestChange) {
          return withCancel(
            <button
              type="button"
              onClick={() => onRequestChange(s)}
              title="Less than 24 hours away. Ask your tutor."
              className="h-10 rounded-md border border-border px-5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Request change
            </button>
          );
        }
        return cancel;
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

/**
 * How long before a session a client may still move it themselves.
 *
 * The published cancellation policy has always said 24 hours. This is the
 * same number, in the one place the UI reads it, so the button and the
 * database rule cannot drift apart.
 */
export const RESCHEDULE_NOTICE_HOURS = 24;

/**
 * Whether a student or parent can still move this themselves.
 *
 * `now` is a parameter rather than read here: the compiler rules count a clock
 * call during render as impure, and a row that changes its own buttons partway
 * through a render is worse than one a minute out of date.
 */
export function canClientReschedule(item: SessionListItem, now: Date): boolean {
  if (!isStillToCome(item)) return false;
  return startsAt(item).getTime() - now.getTime() > RESCHEDULE_NOTICE_HOURS * 3_600_000;
}
