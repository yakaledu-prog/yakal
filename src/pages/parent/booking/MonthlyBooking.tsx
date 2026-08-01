import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";
import { money } from "@/services/billingService";
import { getTutorAvailability } from "@/services/availability";
import { getCatalogCourses, getCourseForBooking } from "@/services/courseApplicationService";
import { getLinkedChildren } from "@/services/parentService";

// ============================================================
// Two ways to buy a month of lessons, so they can be compared.
//
// Both start from the same premise: a tutor publishes the times they are free
// in a normal week, and that pattern holds for the month. A lesson is a slot,
// and a slot has a price.
//
//   "weekly"  pick a time in the week. It becomes that time every week, so one
//             pick is four lessons. The parent is choosing a routine.
//
//   "dates"   pick individual dates across the month. Ten picks is ten
//             lessons. The parent is choosing occasions.
//
// The difference is not cosmetic. Weekly is a commitment a family can plan
// around and a tutor can hold, and it is what makes "4 lessons a month" a
// sentence rather than an accident. Dates is honest about a life that does not
// repeat, but it makes the parent do the arithmetic every month and gives the
// tutor nothing to reserve.
// ============================================================

const HOUR_START = 8;
const HOUR_COUNT = 13;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The Mondays-to-Sundays covered by the next `weeks` weeks, from today. */
function upcomingWeeks(weeks: number): Date[][] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      return day;
    })
  );
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const hourLabel = (h: number) =>
  new Date(0, 0, 0, h).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function MonthlyBooking({ mode }: { mode: "weekly" | "dates" }) {
  const { courseId } = useParams();
  const { user } = useAuth();

  // Falls back to the first bookable course so the page can be opened from the
  // nav without hunting for an id.
  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog-courses"],
    queryFn: getCatalogCourses,
  });
  const id = courseId ?? catalog[0]?.id;

  const { data: course } = useQuery({
    queryKey: ["course-for-booking", id],
    queryFn: () => getCourseForBooking(id!),
    enabled: !!id,
  });

  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const { data: availability } = useQuery({
    queryKey: ["tutor-availability", course?.tutor?.id],
    queryFn: () => getTutorAvailability(course!.tutor!.id),
    enabled: !!course?.tutor?.id,
  });

  // weekly: "dayIndex|hour". dates: "YYYY-MM-DD|hour".
  const [picked, setPicked] = useState<string[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);

  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => i + HOUR_START);
  const weeks = upcomingWeeks(4);
  const unit = course?.priceCents ?? 0;

  const toggle = (key: string) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  /** Every real date a selection produces over the next four weeks. */
  const generated = useMemo(() => {
    if (mode === "dates") return picked.slice().sort();
    const out: string[] = [];
    for (const week of weeks) {
      for (const key of picked) {
        const [d, h] = key.split("|");
        const day = week[Number(d)];
        const start = new Date(day);
        start.setHours(Number(h), 0, 0, 0);
        if (start.getTime() > Date.now()) out.push(`${iso(day)}|${h}`);
      }
    }
    return out.sort();
  }, [picked, mode, weeks]);

  const lessonsPerMonth = generated.length;
  const total = unit * lessonsPerMonth;

  const free = (dayIndex: number, hourIndex: number) =>
    !availability?.disabled_days?.includes(dayIndex) &&
    !!(availability?.time_grid?.[hourIndex]?.[dayIndex] || 0);

  const visibleWeek = weeks[weekOffset] ?? weeks[0];

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-full bg-background pb-12">
        <header className="relative overflow-hidden bg-[#1099A1] px-6 pt-6 text-white md:px-8 md:pt-8">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[40%] text-white/5"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>
          <div className="relative z-10 pb-6">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {course?.title ?? "Book a course"}
            </h1>
            <p className="mt-1 text-[14px] text-white/80">
              {mode === "weekly"
                ? "Choose the times you want every week. They repeat for the month."
                : "Choose each lesson you want this month."}
            </p>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1150px] gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <div>
            {/* Weekly shows one week and means every week. Dates pages through
                the month, because each one is its own decision. */}
            {mode === "dates" && (
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                  disabled={weekOffset <= 0}
                  aria-label="Previous week"
                  className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted/60 disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => setWeekOffset((w) => Math.min(3, w + 1))}
                  disabled={weekOffset >= 3}
                  aria-label="Next week"
                  className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted/60 disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
                <p className="text-[13.5px] font-medium text-foreground">
                  Week {weekOffset + 1} of 4
                  <span className="ml-2 font-normal text-muted-foreground">
                    {visibleWeek[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    {" - "}
                    {visibleWeek[6].toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </span>
                </p>
              </div>
            )}

            {mode === "weekly" && (
              <p className="mb-4 rounded-xl border border-[#CAA25F]/40 bg-[#CAA25F]/10 px-4 py-2.5 text-[13px] text-[#8a6a2a] dark:text-[#CAA25F]">
                Anything you pick here happens every week for the next four weeks.
              </p>
            )}

            <div className="grid grid-cols-7 gap-2">
              {(mode === "weekly" ? weeks[0] : visibleWeek).map((day, di) => (
                <div key={di} className="text-center">
                  <div className="mb-2 border-b-2 border-[#CAA25F] pb-2">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground">
                      {WEEKDAYS[di]}
                    </p>
                    {mode === "dates" && (
                      <p className="mt-0.5 text-[16px] text-foreground">{day.getDate()}</p>
                    )}
                    {mode === "weekly" && (
                      <p className="mt-0.5 text-[12px] text-muted-foreground">every week</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {hours.map((h, hi) => {
                      if (!free(di, hi)) return null;

                      const key = mode === "weekly" ? `${di}|${h}` : `${iso(day)}|${h}`;
                      if (mode === "dates") {
                        const start = new Date(day);
                        start.setHours(h, 0, 0, 0);
                        if (start.getTime() <= Date.now()) return null;
                      }
                      const on = picked.includes(key);

                      return (
                        <button
                          key={h}
                          onClick={() => toggle(key)}
                          className={cn(
                            "w-full rounded py-2 text-[12.5px] font-bold transition-colors",
                            on
                              ? "bg-[#1099A1] text-white"
                              : "bg-[#1099A1]/10 text-[#1099A1] hover:bg-[#1099A1]/20"
                          )}
                        >
                          {hourLabel(h)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What it adds up to. The number that matters is lessons a month. */}
          <aside className="h-fit rounded-2xl border border-border bg-card p-5">
            {course?.tutor && (
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <img
                  src={course.tutor.avatarUrl || dicebearUrl(course.tutor.name)}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-medium text-foreground">
                    {course.tutor.name}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">{course.subject}</p>
                </div>
              </div>
            )}

            <div className="py-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Your plan
              </p>
              <p className="mt-1 text-[26px] font-medium leading-none text-foreground">
                {lessonsPerMonth}
                <span className="ml-1.5 text-[14px] font-normal text-muted-foreground">
                  lessons a month
                </span>
              </p>
              {mode === "weekly" && picked.length > 0 && (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {picked.length} {picked.length === 1 ? "time" : "times"} a week:{" "}
                  {picked
                    .slice()
                    .sort()
                    .map((k) => {
                      const [d, h] = k.split("|");
                      return `${WEEKDAYS[Number(d)]} ${hourLabel(Number(h))}`;
                    })
                    .join(", ")}
                </p>
              )}
            </div>

            {children.length > 0 && (
              <p className="border-t border-border pt-3 text-[13px] text-muted-foreground">
                For <span className="font-medium text-foreground">{children[0].full_name}</span>
              </p>
            )}

            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-[13px] text-muted-foreground">
                {money(unit)} a lesson
              </span>
              <span className="text-[20px] font-medium text-foreground">{money(total)}</span>
            </div>

            <button
              disabled={lessonsPerMonth === 0}
              className="mt-4 w-full rounded-xl bg-[#1099A1] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
            >
              {mode === "weekly" ? "Start monthly plan" : "Pay for these lessons"}
            </button>
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              {mode === "weekly"
                ? "Renews each month. Cancel any time."
                : "One payment. Nothing repeats."}
            </p>

            {/* Showing the actual dates is the point: a parent should not have
                to work out what "4 a month" means on a calendar. */}
            {mode === "weekly" && generated.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  First month
                </p>
                <ul className="space-y-1">
                  {generated.slice(0, 8).map((g) => {
                    const [d, h] = g.split("|");
                    return (
                      <li key={g} className="text-[12.5px] text-muted-foreground">
                        {new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                        {" at "}
                        {hourLabel(Number(h))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    </PageWrapper>
  );
}
