import { useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Users, X } from "lucide-react";

import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import type { CoursePackage } from "@/services/packageService";
import { DEMO_AVAILABILITY } from "../demoFixtures";

// ============================================================
// Pieces the billing designs share.
//
// The designs differ in how they organise things, not in what a slot count or
// a child row looks like, so those live here and the comparison stays about
// the layout rather than about incidental styling.
//
// ChildSidebar, BillingHeader, Money, Spinner and Empty are used by the real
// billing page too. SlotMeter, PackageActions, SessionWeekGrid and
// AddSlotsModal belong to the alternatives only, and go when they do.
// ============================================================

export interface ChildOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
  grade_level?: string | null;
}

/** The list of children, plus an "everyone" entry. */
export function ChildSidebar({
  children,
  activeId,
  onSelect,
  countFor,
  /**
   * Off where the page is about one child at a time. A roadmap for "all
   * children" is not a thing: the timeline, the stage and the graduation year
   * all belong to one person.
   */
  showAll = true,
  /** What the line under each name counts. Billing counts plans. */
  countLabel = ["plan", "plans"],
  /**
   * The line under a name, when a count is the wrong thing to put there. The
   * roadmap has nothing to count, so it says which grade they are in.
   */
  sublineFor,
}: {
  children: ChildOption[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  countFor: (childId: string | null) => number;
  showAll?: boolean;
  countLabel?: [string, string];
  sublineFor?: (child: ChildOption) => string;
}) {
  return (
    <aside className="w-full shrink-0 border-b border-border bg-card md:h-full md:w-[260px] md:border-b-0 md:border-r">
      <p className="px-4 pb-2 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Children
      </p>

      {showAll && (
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
          activeId === null
            ? "border-l-primary bg-primary/5"
            : "border-l-transparent hover:bg-muted/40"
        )}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <Users size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-[14px] font-medium",
              activeId === null ? "text-primary" : "text-foreground"
            )}
          >
            All children
          </span>
          <span className="block text-[12px] text-muted-foreground">
            {countFor(null)} {countFor(null) === 1 ? countLabel[0] : countLabel[1]}
          </span>
        </span>
      </button>
      )}

      {children.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
              active ? "border-l-primary bg-primary/5" : "border-l-transparent hover:bg-muted/40"
            )}
          >
            <img
              src={c.avatar_url || dicebearUrl(c.full_name)}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-[14px] font-medium",
                  active ? "text-primary" : "text-foreground"
                )}
              >
                {c.full_name}
              </span>
              <span className="block text-[12px] text-muted-foreground">
                {sublineFor
                  ? sublineFor(c)
                  : `${countFor(c.id)} ${countFor(c.id) === 1 ? countLabel[0] : countLabel[1]}`}
              </span>
            </span>
          </button>
        );
      })}
    </aside>
  );
}

/**
 * How much of a package has been used.
 *
 * It used to lead with "left to schedule", which is bought minus scheduled.
 * Slots are picked at checkout, so everything bought is scheduled the moment
 * it is paid for and that number is always zero. It is only meaningful if
 * slots can be bought without times, which is what a package or monthly plan
 * would introduce.
 *
 * What is true today is simpler: some sessions have happened and some are
 * still to come.
 */
export function SlotMeter({ pkg, className }: { pkg: CoursePackage; className?: string }) {
  const total = Math.max(pkg.slotsPurchased, 1);
  const done = (pkg.slotsCompleted / total) * 100;
  const booked = (pkg.slotsUpcoming / total) * 100;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-foreground">
          <span className="text-[18px] font-medium">{pkg.slotsUpcoming}</span>
          <span className="text-muted-foreground">
            {" "}
            of {pkg.slotsPurchased} sessions still to come
          </span>
        </p>
        <p className="text-[12px] text-muted-foreground">
          {pkg.slotsCompleted} completed
          {pkg.slotsUnscheduled > 0 && `, ${pkg.slotsUnscheduled} not booked yet`}
        </p>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-primary" style={{ width: `${done}%` }} title="Completed" />
        <div className="bg-tertiary" style={{ width: `${booked}%` }} title="Still to come" />
      </div>
    </div>
  );
}

export function Money({ cents }: { cents: number }) {
  return <span className="tabular-nums">{money(cents)}</span>;
}

export function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin text-primary" />
    </div>
  );
}

export function Empty({
  title,
  body,
  /** The way out of the empty state, when there is one. */
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-20 text-center">
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** The actions every design offers on a package, so they read the same. */
export function PackageActions({
  pkg,
  size = "md",
  onAddSlots,
}: {
  pkg: CoursePackage;
  size?: "sm" | "md";
  onAddSlots?: () => void;
}) {
  const base =
    size === "sm"
      ? "rounded-lg px-3 py-1.5 text-[12.5px]"
      : "rounded-xl px-4 py-2 text-[13px]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onAddSlots}
        className={cn(base, "bg-primary font-semibold text-white hover:bg-primary-hover")}
      >
        Add slots
      </button>
      {!pkg.recurring && (
        <button
          className={cn(
            base,
            "border border-secondary font-medium text-[#8a6a2a] hover:bg-secondary/10 dark:text-secondary"
          )}
        >
          Go monthly
        </button>
      )}
    </div>
  );
}

/** The teal page header the rest of the app uses, with stats on the right. */
export function BillingHeader({
  subtitle,
  stats,
  leading,
  children,
}: {
  subtitle: string;
  stats: { label: string; value: string | number }[];
  /** Above the title. A back link belongs there, not under the stats. */
  leading?: React.ReactNode;
  /** Anything that belongs under the stats, e.g. tabs. */
  children?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-primary px-6 pt-6 text-white md:px-8 md:pt-8">
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

      <div className="relative z-10">
        {leading}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Billing</h1>
            <p className="mt-1 text-[14px] text-white/80">{subtitle}</p>
          </div>
          <div className="flex items-center gap-8 pb-1">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">
                  {s.label}
                </p>
                <p className="mt-0.5 text-2xl font-medium">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
        {children}
      </div>
    </header>
  );
}

/** Sunday of the week `offset` weeks from today. */
function weekOf(offset: number): Date[] {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - d.getDay());
  sunday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    return day;
  });
}

const HOUR_START = 8;
const HOUR_COUNT = 13;

/**
 * A package's sessions laid out as the week they were booked into.
 *
 * The same shape the parent chose them in, which is the point: a list of dates
 * makes you reconstruct the week in your head, and the calendar is what they
 * were looking at when they picked.
 *
 * Nothing extra is stored for this. A session already carries its date, its
 * time and its status, and past or future is a comparison against today, so
 * the grid is drawn from what is there.
 */
export function SessionWeekGrid({ pkg }: { pkg: CoursePackage }) {
  const [offset, setOffset] = useState(0);
  const days = weekOf(offset);
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => i + HOUR_START);

  const sessionAt = (day: Date, hour: number) => {
    const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    return pkg.sessions.find(
      (x) => x.date === iso && Number(x.startTime.split(":")[0]) === hour
    );
  };

  // Only draw rows that hold something, or an empty week is 13 blank rows.
  const usedHours = hours.filter((h) => days.some((d) => sessionAt(d, h)));
  const inThisWeek = pkg.sessions.filter((x) =>
    days.some(
      (d) =>
        x.date ===
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    )
  ).length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <button
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Previous week"
          className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted/60"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Next week"
          className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted/60"
        >
          <ChevronRight size={15} />
        </button>
        <p className="text-[13.5px] font-medium text-foreground">
          {days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })}
          {" - "}
          {days[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </p>
        <p className="ml-auto text-[12.5px] text-muted-foreground">
          {inThisWeek === 0 ? "Nothing this week" : `${inThisWeek} this week`}
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day, di) => {
          const isToday = day.toDateString() === new Date().toDateString();
          return (
            <div key={di} className="text-center">
              <div className="mb-2 border-b-2 border-secondary pb-2">
                <p className="text-[11px] font-bold uppercase text-muted-foreground">
                  {day.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[16px]",
                    isToday ? "font-bold text-primary" : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </p>
              </div>

              <div className="space-y-2">
                {usedHours.length === 0 && <span className="text-[12px] text-[#c2c7d0]">-</span>}
                {usedHours.map((h) => {
                  const s = sessionAt(day, h);
                  if (!s) return <div key={h} className="h-[34px]" />;
                  const label = new Date(0, 0, 0, h).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={h}
                      title={s.status}
                      className={cn(
                        "rounded py-2 text-[12.5px] font-bold",
                        s.status === "completed"
                          ? "bg-primary text-white"
                          : s.status === "upcoming"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground line-through"
                      )}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-primary" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-primary/10" /> Still to come
        </span>
      </div>
    </div>
  );
}

/**
 * Adding sessions to a plan that already exists.
 *
 * A stepper asked for a number, which is not the decision being made. The
 * parent is choosing times, and the count falls out of what they pick, so this
 * is the tutor's real availability with the slots they already hold marked as
 * taken.
 */
export function AddSlotsModal({ pkg, onClose }: { pkg: CoursePackage; onClose: () => void }) {
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);

  const availability = DEMO_AVAILABILITY;
  const isLoading = false;

  const days = weekOf(offset);
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => i + HOUR_START);
  const unit = pkg.pricePerSlotCents ?? 0;

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const key = (d: Date, h: number) => `${iso(d)}|${String(h).padStart(2, "0")}:00`;
  const taken = (d: Date, h: number) =>
    pkg.sessions.some((s) => s.date === iso(d) && Number(s.startTime.split(":")[0]) === h);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Add sessions to ${pkg.courseTitle}`}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-2xl bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <h2 className="text-[17px] font-medium text-foreground">{pkg.courseTitle}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {pkg.studentName}
              {pkg.tutorName && ` with ${pkg.tutorName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - 1))}
              disabled={offset <= 0}
              aria-label="Previous week"
              className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted/60 disabled:opacity-40"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setOffset((o) => o + 1)}
              aria-label="Next week"
              className="rounded-lg border border-border p-1.5 transition-colors hover:bg-muted/60"
            >
              <ChevronRight size={15} />
            </button>
            <p className="text-[13.5px] font-medium text-foreground">
              {days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              {" - "}
              {days[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>

          {isLoading ? (
            <Spinner />
          ) : !availability ? (
            <p className="py-10 text-center text-[13.5px] text-muted-foreground">
              {pkg.tutorName ?? "This tutor"} has not published any times yet.
            </p>
          ) : (
            <div className="grid grid-cols-7 gap-2 pb-4">
              {days.map((day, di) => (
                <div key={di} className="text-center">
                  <div className="mb-2 border-b-2 border-secondary pb-2">
                    <p className="text-[11px] font-bold uppercase text-muted-foreground">
                      {day.toLocaleDateString(undefined, { weekday: "short" })}
                    </p>
                    <p className="mt-0.5 text-[16px] text-foreground">{day.getDate()}</p>
                  </div>

                  <div className="space-y-2">
                    {availability.disabled_days?.includes(di) ? (
                      <span className="text-[12px] text-muted-foreground">Off</span>
                    ) : (
                      hours.map((h, hi) => {
                        if (!(availability.time_grid[hi]?.[di] || 0)) return null;
                        const start = new Date(day);
                        start.setHours(h, 0, 0, 0);
                        if (start.getTime() <= Date.now()) return null;

                        const k = key(day, h);
                        const already = taken(day, h);
                        const on = picked.includes(k);
                        const label = new Date(0, 0, 0, h).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        });

                        return (
                          <button
                            key={h}
                            disabled={already}
                            onClick={() =>
                              setPicked((prev) =>
                                prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
                              )
                            }
                            title={already ? "Already booked" : undefined}
                            className={cn(
                              "w-full rounded py-2 text-[12.5px] font-bold transition-colors",
                              already
                                ? "cursor-not-allowed bg-muted text-muted-foreground"
                                : on
                                  ? "bg-primary text-white"
                                  : "bg-primary/10 text-primary hover:bg-primary/20"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-6 pt-4">
          <p className="text-[13.5px] text-muted-foreground">
            {picked.length === 0 ? (
              "Pick the times you want"
            ) : (
              <>
                <span className="font-medium text-foreground">{picked.length}</span> selected
                {" - "}
                <span className="font-medium text-foreground">
                  <Money cents={unit * picked.length} />
                </span>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
            >
              Cancel
            </button>
            <button
              disabled={picked.length === 0}
              className="rounded-xl bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {picked.length === 0 ? "Pay" : <>Pay <Money cents={unit * picked.length} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
