import { ArrowDownUpIcon, ArrowUpDownIcon } from "lucide-react";
import { cn } from "@/utils/cn";

// ============================================================
// A column header you can sort by.
//
// Shared, because the tutor's earnings table and the admin's invoice table are
// the same kind of table and a person moving between them should not have to
// learn two different affordances.
//
// The column key is a plain string rather than a union: each table names its
// own columns, and the comparison lives with the data it understands.
// ============================================================

export interface Sort<C extends string = string> {
  col: C;
  dir: "asc" | "desc";
}

export function SortHeader<C extends string>({
  label,
  col,
  sort,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  col: C;
  sort: Sort<C>;
  onSort: (s: Sort<C>) => void;
  align?: "left" | "right";
  /** Must match the padding on the cells below, or headers collide. */
  className?: string;
}) {
  const active = sort.col === col;

  return (
    <th
      className={cn(
        // Quiet on purpose: a header labels the column, the figures under it
        // are the content. Anything heavier competes with the rows.
        "pb-2 text-[10.5px] font-medium uppercase tracking-[0.08em]",
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort({ col, dir: active && sort.dir === "asc" ? "desc" : "asc" })}
        className={cn(
          "group inline-flex items-center gap-1.5 uppercase tracking-[0.08em] transition-colors",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground/70" : "text-muted-foreground/70 hover:text-foreground/70"
        )}
      >
        {label}
        {/* Kept quiet on purpose. The sorted column already reads as sorted
            from its own heading being darker, so the arrow is a confirmation
            rather than the signal, and a row of bold arrows would compete with
            the figures underneath. */}
        {active && sort.dir === "asc" ? (
          <ArrowUpDownIcon
            size={12}
            strokeWidth={1.5}
            className="shrink-0 text-muted-foreground/70 transition-opacity duration-200"
          />
        ) : (
          <ArrowDownUpIcon
            size={12}
            strokeWidth={1.5}
            className={cn(
              "shrink-0 text-muted-foreground/70 transition-opacity duration-200",
              active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
            )}
          />
        )}
      </button>
    </th>
  );
}

/** Sort a list by a key the caller derives, numbers and strings both. */
export function sortRows<T, C extends string>(
  rows: T[],
  sort: Sort<C>,
  key: (row: T) => string | number
): T[] {
  return [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const cmp =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y));
    return sort.dir === "asc" ? cmp : -cmp;
  });
}
