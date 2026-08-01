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
 * How much of a package is left.
 *
 * Three numbers matter and they are not the same question: what has happened,
 * what is booked, and what is paid for but not yet scheduled. The last one is
 * the actionable one, so it leads.
 */
export function SlotMeter({ pkg, className }: { pkg: CoursePackage; className?: string }) {
  const total = Math.max(pkg.slotsPurchased, 1);
  const done = (pkg.slotsCompleted / total) * 100;
  const booked = (pkg.slotsUpcoming / total) * 100;

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-foreground">
          <span className="text-[18px] font-medium">{pkg.slotsUnscheduled}</span>
          <span className="text-muted-foreground"> of {pkg.slotsPurchased} left to schedule</span>
        </p>
        <p className="text-[12px] text-muted-foreground">
          {pkg.slotsCompleted} done, {pkg.slotsUpcoming} booked
        </p>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-[#1099A1]" style={{ width: `${done}%` }} title="Completed" />
        <div className="bg-[#97CE9D]" style={{ width: `${booked}%` }} title="Booked" />
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
}: {
  pkg: CoursePackage;
  size?: "sm" | "md";
}) {
  const base =
    size === "sm"
      ? "rounded-lg px-3 py-1.5 text-[12.5px]"
      : "rounded-xl px-4 py-2 text-[13px]";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={cn(base, "bg-[#1099A1] font-semibold text-white hover:bg-[#0d7f86]")}>
        Add slots
      </button>
      <button className={cn(base, "border border-border font-medium hover:bg-muted/60")}>
        Book a time
      </button>
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
