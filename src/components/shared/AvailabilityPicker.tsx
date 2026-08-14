import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { getTutorAvailability } from "@/services/availability";
import { getSlotConflicts, slotKey } from "@/services/slotService";
import { cn } from "@/utils/cn";

// ============================================================
// A tutor's free hours, week by week.
//
// This grid existed once, inside the course booking page, and the reschedule
// dialog had its own copy wired to four hard-coded November dates. Two calendars
// that disagree about when a tutor works is worse than one that is wrong.
//
// So it is shared, and it fetches for itself: give it a tutor and it draws the
// hours they published, minus the hours already sold, minus the hours that have
// gone. Whoever is picking decides what to do with the result.
// ============================================================

/** The grid is stored 8 AM to 8 PM, thirteen rows, Sunday first. */
const HOUR_START = 8;
const HOUR_COUNT = 13;

/** How far ahead to ask about clashes. Half a year covers any booking. */
const CONFLICT_WEEKS = 26;

/** Local parts, never toISOString: that shifts the day either side of midnight. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface PickedSlot {
  /** "date|HH:MM", the same key the conflict map uses. */
  key: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM", 24 hour. */
  startTime: string;
  /** Midnight-anchored Date for the day, with the hour applied. */
  at: Date;
}

function hourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:00 ${period}`;
}

/** Sunday to Saturday of the week `offset` weeks from this one. */
function weekOf(offset: number): Date[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay() + offset * 7);
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function AvailabilityPicker({
  tutorId,
  studentId,
  selected,
  onToggle,
  /** One slot for a reschedule, many for a booking. */
  multiple = false,
  /** The hour a session already holds, when one is being moved. */
  currentSlot,
  className,
}: {
  tutorId: string | null;
  studentId?: string | null;
  selected: PickedSlot[];
  onToggle: (slot: PickedSlot) => void;
  multiple?: boolean;
  currentSlot?: { date: string; startTime: string } | null;
  className?: string;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: availability, isLoading } = useQuery({
    queryKey: ["tutor-availability", tutorId],
    queryFn: () => getTutorAvailability(tutorId!),
    enabled: !!tutorId,
  });

  const window = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + CONFLICT_WEEKS * 7);
    return { from: isoDay(from), to: isoDay(to) };
  }, []);

  const { data: conflicts } = useQuery({
    queryKey: ["slot-conflicts", studentId, tutorId, window.from],
    queryFn: () => getSlotConflicts({ studentId: studentId ?? null, tutorId, ...window }),
    enabled: !!(tutorId || studentId),
  });

  const days = weekOf(weekOffset);
  const hours = Array.from({ length: HOUR_COUNT }).map((_, i) => i + HOUR_START);
  const timeGrid = availability?.time_grid ?? [];
  const offDays = availability?.disabled_days ?? [];

  const isOffered = (dayIndex: number, hourIndex: number) =>
    !offDays.includes(dayIndex) && (timeGrid[hourIndex]?.[dayIndex] || 0) > 0;

  // By Friday most of this week is behind us, so opening on it shows an empty
  // grid and reads as a tutor with no hours. Skip to the next one instead.
  useEffect(() => {
    if (!availability || weekOffset !== 0) return;
    const anyLeft = weekOf(0).some((day, dIndex) =>
      hours.some((hour, hIndex) => {
        if (!isOffered(dIndex, hIndex)) return false;
        const start = new Date(day);
        start.setHours(hour, 0, 0, 0);
        return start.getTime() > Date.now();
      })
    );
    if (!anyLeft) setWeekOffset(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  const isCurrent = (date: string, time: string) =>
    currentSlot?.date === date && currentSlot.startTime.slice(0, 5) === time;

  const takenAt = (day: Date, hour: number): string | null => {
    const date = isoDay(day);
    const time = `${String(hour).padStart(2, "0")}:00`;
    // The session being moved holds its own hour. Drawing that as taken would
    // tell someone their session clashes with itself; it is drawn as current
    // instead.
    if (isCurrent(date, time)) return null;
    return conflicts?.byKey.get(slotKey(date, time)) ?? null;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!tutorId || !availability) {
    return (
      <p className="py-12 text-center text-[14px] text-muted-foreground">
        This tutor has not published any hours yet.
      </p>
    );
  }

  return (
    <div className={cn("min-w-[560px]", className)}>
      <div className="mb-5 flex items-center gap-2 px-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={weekOffset <= 0}
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setWeekOffset((w) => w + 1)}
        >
          <ChevronRight size={16} />
        </Button>
        <span className="ml-2 text-[14px] font-semibold text-foreground">
          {days[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} -{" "}
          {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, dIndex) => {
          const dayGone = new Date(day).setHours(23, 59, 59, 999) < Date.now();
          const openHours = hours.filter((hour, hIndex) => {
            if (!isOffered(dIndex, hIndex)) return false;
            const start = new Date(day);
            start.setHours(hour, 0, 0, 0);
            return start.getTime() > Date.now();
          });

          return (
            <div key={dIndex} className="text-center">
              <div className="mb-3 border-b-2 border-secondary pb-3">
                <div className="text-[12px] font-bold uppercase text-muted-foreground">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div className="mt-1 text-[18px] text-foreground">{day.getDate()}</div>
              </div>

              <div className="space-y-2">
                {offDays.includes(dIndex) ? (
                  <div className="rounded bg-muted py-4 text-[12px] text-muted-foreground">Off</div>
                ) : dayGone || openHours.length === 0 ? (
                  <div className="py-4 text-[12px] text-muted-foreground">-</div>
                ) : (
                  openHours.map((hour) => {
                    const date = isoDay(day);
                    const time = `${String(hour).padStart(2, "0")}:00`;
                    const key = slotKey(date, time);
                    const isSelected = selected.some((s) => s.key === key);

                    // Drawn, not hidden. Someone looking for Monday at four
                    // needs to see it is gone, not wonder why it vanished.
                    const taken = takenAt(day, hour);

                    // Where the session sits now. Marked and locked: picking a
                    // new time and then picking the old one back is a way to
                    // end up thinking something moved when nothing did.
                    const current = isCurrent(date, time);

                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={!!taken || current}
                        title={current ? "This session is booked for this time" : (taken ?? undefined)}
                        onClick={() => {
                          const at = new Date(day);
                          at.setHours(hour, 0, 0, 0);
                          onToggle({ key, date, startTime: time, at });
                        }}
                        className={cn(
                          "w-full rounded py-2 text-[13px] font-semibold transition-colors",
                          current
                            ? "cursor-default border border-secondary bg-secondary/10 text-secondary"
                            : taken
                              ? "cursor-not-allowed border border-border bg-muted text-muted-foreground line-through"
                              : isSelected
                                ? "border border-primary bg-primary text-white"
                                : "border border-primary/30 text-primary hover:bg-primary/10"
                        )}
                      >
                        {hourLabel(hour)}
                        {current && (
                          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wider">
                            Current
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!multiple && selected.length > 1 && (
        // Guarded rather than assumed: a caller that forgets to replace instead
        // of append would otherwise silently book several.
        <p className="mt-4 text-[13px] text-secondary">Only one time can be chosen here.</p>
      )}
    </div>
  );
}
