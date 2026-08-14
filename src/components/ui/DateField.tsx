import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/utils/cn";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** ISO yyyy-mm-dd, built from local parts so a timezone shift cannot move the day. */
function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromISO(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Date input with a calendar popover.
 *
 * Native date inputs render as a different control in every browser and cannot
 * be styled, which matters here because deadlines are the most important thing
 * on the form. The popover is portalled so a modal's overflow cannot clip it.
 */
export function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  ariaLabel,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = fromISO(value);
  const [cursor, setCursor] = useState<Date>(() => selected ?? new Date());

  const ref = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(
    null
  );

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const H = 340;
    const flip = window.innerHeight - r.bottom < H && r.top > H;
    setPos({
      top: flip ? r.top - 8 : r.bottom + 8,
      left: Math.min(r.left, window.innerWidth - 300),
      flip,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) {
      measure();
      setCursor(selected ?? new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  // Leading blanks so the 1st lands under the right weekday.
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const daysInMonth = new Date(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    0
  ).getDate();
  const cells: (Date | null)[] = [
    ...Array<null>(first.getDay()).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1)
    ),
  ];

  const today = new Date();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-xl border bg-white px-3 text-left text-[14px] transition-colors dark:bg-[#1c2a32]",
          open
            ? "border-primary"
            : "border-[#e9edef] hover:border-[#cbd5d8] dark:border-[#2a3942]"
        )}
      >
        <CalendarDays size={16} className="shrink-0 text-[#717182]" />
        <span
          className={cn(
            "flex-1 truncate",
            selected ? "text-[#111] dark:text-white" : "text-[#a8adb8]"
          )}
        >
          {selected
            ? selected.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : placeholder}
        </span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && onChange(null)}
            className="grid h-5 w-5 place-items-center rounded text-[#717182] hover:bg-[#ececf0] hover:text-[#111] dark:hover:bg-[#243239]"
          >
            <X size={13} />
          </span>
        )}
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: pos.flip ? "translateY(-100%)" : undefined,
          }}
          className="z-[100] w-[288px] rounded-xl border border-[#e9edef] bg-white p-3 shadow-xl dark:border-[#2a3942] dark:bg-[#202c33]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
              }
              className="grid h-7 w-7 place-items-center rounded-lg text-[#717182] hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold text-[#111] dark:text-white">
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() =>
                setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
              }
              className="grid h-7 w-7 place-items-center rounded-lg text-[#717182] hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {DAYS.map((d, i) => (
              <div
                key={i}
                className="grid h-7 place-items-center text-[10px] font-semibold uppercase text-[#a8adb8]"
              >
                {d}
              </div>
            ))}
            {cells.map((d, i) =>
              d === null ? (
                <div key={`b${i}`} />
              ) : (
                <button
                  key={toISO(d)}
                  type="button"
                  onClick={() => {
                    onChange(toISO(d));
                    setOpen(false);
                  }}
                  className={cn(
                    "grid h-8 place-items-center rounded-lg text-[13px] tabular-nums transition-colors",
                    selected && sameDay(d, selected)
                      ? "bg-primary font-semibold text-white"
                      : sameDay(d, today)
                        ? "font-semibold text-primary hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]"
                        : "text-[#111] hover:bg-[#f3f3f5] dark:text-white dark:hover:bg-[#1c2a32]"
                  )}
                >
                  {d.getDate()}
                </button>
              )
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
