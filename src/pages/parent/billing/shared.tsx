import { useState } from "react";
import { Loader2, Users } from "lucide-react";

import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import type { CoursePackage } from "@/services/packageService";

// ============================================================
// Pieces the three billing designs share.
//
// The designs differ in how they organise things, not in what a slot count or
// a child row looks like, so those live here and the comparison stays about
// the layout rather than about incidental styling.
// ============================================================

export interface ChildOption {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/** The list of children, plus an "everyone" entry. */
export function ChildSidebar({
  children,
  activeId,
  onSelect,
  countFor,
}: {
  children: ChildOption[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  countFor: (childId: string | null) => number;
}) {
  return (
    <aside className="w-full shrink-0 border-b border-border bg-card md:h-full md:w-[260px] md:border-b-0 md:border-r">
      <p className="px-4 pb-2 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Children
      </p>

      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
          activeId === null
            ? "border-l-[#1099A1] bg-[#1099A1]/5"
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
              activeId === null ? "text-[#1099A1]" : "text-foreground"
            )}
          >
            All children
          </span>
          <span className="block text-[12px] text-muted-foreground">
            {countFor(null)} {countFor(null) === 1 ? "plan" : "plans"}
          </span>
        </span>
      </button>

      {children.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors",
              active ? "border-l-[#1099A1] bg-[#1099A1]/5" : "border-l-transparent hover:bg-muted/40"
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
                  active ? "text-[#1099A1]" : "text-foreground"
                )}
              >
                {c.full_name}
              </span>
              <span className="block text-[12px] text-muted-foreground">
                {countFor(c.id)} {countFor(c.id) === 1 ? "plan" : "plans"}
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
        <div className="bg-[#1099A1]" style={{ width: `${done}%` }} title="Completed" />
        <div className="bg-[#97CE9D]" style={{ width: `${booked}%` }} title="Still to come" />
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
      <Loader2 className="animate-spin text-[#1099A1]" />
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-20 text-center">
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
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
        className={cn(base, "bg-[#1099A1] font-semibold text-white hover:bg-[#0d7f86]")}
      >
        Add slots
      </button>
      {/* Only offered when there is something paid for that has no time yet.
          With slots picked at checkout that never happens, so it stays hidden
          until packages exist. */}
      {pkg.slotsUnscheduled > 0 && (
        <button className={cn(base, "border border-border font-medium hover:bg-muted/60")}>
          Book a time
        </button>
      )}
      {!pkg.recurring && (
        <button
          className={cn(
            base,
            "border border-[#CAA25F] font-medium text-[#8a6a2a] hover:bg-[#CAA25F]/10 dark:text-[#CAA25F]"
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
  children,
}: {
  subtitle: string;
  stats: { label: string; value: string | number }[];
  /** Anything that belongs under the stats, e.g. tabs. */
  children?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-[#1099A1] px-6 pt-6 text-white md:px-8 md:pt-8">
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

/**
 * The sessions in a package, with what has happened to each.
 *
 * The answer to "what did I actually book". Everything else on the page is a
 * count; this is the list behind it.
 */
export function SlotAccordion({ pkg }: { pkg: CoursePackage }) {
  if (pkg.sessions.length === 0) {
    return <p className="py-3 text-[13px] text-muted-foreground">No sessions booked yet.</p>;
  }

  const fmt = (s: { date: string; startTime: string }) => {
    const [h, m] = s.startTime.split(":").map(Number);
    const d = new Date(`${s.date}T00:00:00`);
    d.setHours(h, m ?? 0);
    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <ul className="divide-y divide-border">
      {pkg.sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
          <span className="text-[13.5px] text-foreground">{fmt(s)}</span>
          <span
            className={cn(
              "text-[12.5px] font-medium capitalize",
              s.status === "completed" ? "text-[#1099A1]" : "text-muted-foreground"
            )}
          >
            {s.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every session as a square, oldest first.
 *
 * The same information as the meter, read differently: a run of filled squares
 * is a course being attended, and a gap is one that stalled. Useful once there
 * are enough sessions for a shape to exist, which is the open question about
 * whether it earns its place.
 */
export function CoverageHeatmap({ pkg }: { pkg: CoursePackage }) {
  const cells = [
    ...pkg.sessions.map((s) => s.status),
    ...Array.from({ length: pkg.slotsUnscheduled }, () => "unbooked"),
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {cells.map((status, i) => (
          <span
            key={i}
            title={status}
            className={cn(
              "h-4 w-4 rounded-[3px]",
              status === "completed"
                ? "bg-[#1099A1]"
                : status === "upcoming"
                  ? "bg-[#97CE9D]"
                  : "border border-dashed border-border bg-transparent"
            )}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-[#1099A1]" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px] bg-[#97CE9D]" /> Still to come
        </span>
        {pkg.slotsUnscheduled > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[3px] border border-dashed border-border" /> Not booked
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Buying more sessions on a plan that already exists.
 *
 * A modal rather than a trip back to the course page: the parent is looking at
 * the plan, and sending them away to buy more of it loses their place.
 */
export function AddSlotsModal({
  pkg,
  onClose,
}: {
  pkg: CoursePackage;
  onClose: () => void;
}) {
  const [count, setCount] = useState(1);
  const unit = pkg.pricePerSlotCents ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Add sessions to ${pkg.courseTitle}`}
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
      >
        <h2 className="text-[17px] font-medium text-foreground">{pkg.courseTitle}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {pkg.studentName}
          {pkg.tutorName && ` with ${pkg.tutorName}`}
        </p>

        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="text-[13px] text-muted-foreground">Sessions to add</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              <Money cents={unit} /> each
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCount((n) => Math.max(1, n - 1))}
              aria-label="One fewer"
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-[18px] transition-colors hover:bg-muted/60"
            >
              -
            </button>
            <span className="w-8 text-center text-[18px] font-medium tabular-nums text-foreground">
              {count}
            </span>
            <button
              onClick={() => setCount((n) => Math.min(20, n + 1))}
              aria-label="One more"
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-[18px] transition-colors hover:bg-muted/60"
            >
              +
            </button>
          </div>
        </div>

        <p className="mt-4 text-[13px] text-muted-foreground">
          Times are chosen next, from {pkg.tutorName ?? "the tutor"}'s calendar.
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-[15px] font-medium text-foreground">
            <Money cents={unit * count} />
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
            >
              Cancel
            </button>
            <button className="rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86]">
              Choose times
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
