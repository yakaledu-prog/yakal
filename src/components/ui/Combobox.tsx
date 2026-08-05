import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ComboboxItem {
  /** Stable id. The typed value is used when nothing is picked. */
  id: string;
  label: string;
  /** Second line, e.g. an email. */
  hint?: string;
  avatarUrl?: string | null;
}

/**
 * A text field that also searches a list.
 *
 * Distinct from Dropdown and SelectMenu, which both make you pick one of the
 * options. Here the typed text is a valid answer on its own: a testimonial can
 * come from somebody who has no account, and refusing to accept a name that is
 * not in the database would be the wrong constraint entirely.
 *
 * Picking somebody is a shortcut, not a requirement, which is why onPick and
 * onChange are separate. onChange fires on every keystroke; onPick fires only
 * when a real record is chosen, and that is when the caller fills in the
 * fields it can infer.
 */
export function Combobox({
  value,
  onChange,
  onPick,
  items,
  placeholder,
  emptyHint = "No match. What you type is used as it is.",
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onPick?: (item: ComboboxItem) => void;
  items: ComboboxItem[];
  placeholder?: string;
  emptyHint?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q
      ? items.filter(
          (i) => i.label.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q)
        )
      : items;
    // Long lists make the field feel like a page rather than an input.
    return pool.slice(0, 8);
  }, [items, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(item: ComboboxItem) {
    onChange(item.label);
    onPick?.(item);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      setActive((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + matches.length) % Math.max(1, matches.length);
      });
      return;
    }
    // Enter selects the highlighted match, but only while the list is open.
    // Otherwise it would steal the key from the form it sits in.
    if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
      return;
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={wrap} className="relative">
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            // The list is rebuilt on every keystroke, so a highlight left at
            // index 3 would point at a different person than the one it was
            // over when the key was pressed.
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-9 text-[14px] outline-none transition-colors focus:border-[#1099A1]"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Show matches"
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-muted-foreground">{emptyHint}</p>
          ) : (
            matches.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(item)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  i === active ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                {item.avatarUrl !== undefined && (
                  <img
                    src={item.avatarUrl || ""}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full bg-muted object-cover"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{item.label}</span>
                  {item.hint && (
                    <span className="block truncate text-[12px] text-muted-foreground">{item.hint}</span>
                  )}
                </span>
                {item.label === value && <Check size={14} className="shrink-0 text-[#1099A1]" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
