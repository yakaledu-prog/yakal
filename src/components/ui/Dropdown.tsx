import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional second line, e.g. an explanation of what a sort does. */
  hint?: string;
}

type Tone = "light" | "onDark";
type Size = "sm" | "md";

/**
 * Compact dropdown for toolbars and headers.
 *
 * Distinct from SelectMenu, which is a 56px floating-label field built for
 * forms. This one is control-sized and sits inline next to buttons.
 *
 * `tone="onDark"` renders it for a saturated background such as the teal
 * catalog banner, where a white field would punch a hole in the header.
 */
export function Dropdown<T extends string = string>({
  value,
  onChange,
  options,
  tone = "light",
  size = "md",
  align = "start",
  className,
  buttonClassName,
  ariaLabel,
  placeholder = "Select",
  icon,
}: {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  tone?: Tone;
  size?: Size;
  align?: "start" | "end";
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  placeholder?: string;
  /**
   * Renders as a single icon button instead of label-plus-chevron, for a
   * toolbar where the label repeats what the list below already shows and the
   * width is better spent on a search field.
   */
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // The menu is portalled to <body>. Any ancestor with overflow:hidden would
  // otherwise clip it, which is exactly what the teal catalog banner does.
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
    flip: boolean;
  } | null>(null);

  const selected = options.find((o) => o.value === value);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const estimated = Math.min(288, options.length * 40 + 8);
    const below = window.innerHeight - r.bottom;
    const flip = below < estimated && r.top > below;
    setRect({
      top: flip ? r.top - 6 : r.bottom + 6,
      left: r.left,
      width: r.width,
      flip,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;

    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    // Capture phase so a scrolling ancestor still triggers a reposition.
    const onScroll = () => measure();

    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, measure]);

  // Open the menu with the current selection highlighted, not the first row.
  useEffect(() => {
    if (open) {
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    }
  }, [open, options, value]);

  const commit = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(options[active].value);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    }
  };

  const heights = { sm: "h-8 text-[12px]", md: "h-9 text-[13px]" }[size];

  const toneButton =
    tone === "onDark"
      ? cn(
          "border-white/20 bg-black/10 text-white hover:bg-black/20",
          open && "border-white"
        )
      : cn(
          "border-[#e9edef] bg-white text-[#111] hover:border-[#cbd5d8] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white",
          open && "border-[#1099A1]"
        );

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex w-full items-center justify-between gap-2 rounded-lg border px-3 font-medium transition-colors focus:outline-none",
          heights,
          toneButton,
          buttonClassName
        )}
      >
        {icon ? (
          icon
        ) : (
          <>
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronDown
              size={15}
              className={cn("shrink-0 transition-transform", open && "rotate-180")}
            />
          </>
        )}
      </button>

      {open && rect && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          style={{
            position: "fixed",
            top: rect.top,
            left: align === "end" ? undefined : rect.left,
            right: align === "end" ? window.innerWidth - rect.left - rect.width : undefined,
            minWidth: rect.width,
            transform: rect.flip ? "translateY(-100%)" : undefined,
          }}
          className={cn(
            "z-[100] max-h-72 overflow-y-auto rounded-lg border border-[#e9edef] bg-white py-1 shadow-lg dark:border-[#2a3942] dark:bg-[#202c33]"
          )}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(o.value)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-[13px] transition-colors",
                  i === active && "bg-[#f8f9fa] dark:bg-[#111b21]",
                  isSelected
                    ? "font-semibold text-[#1099A1]"
                    : "text-[#111] dark:text-white"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && (
                    <span className="mt-0.5 block text-[11px] font-normal leading-snug text-[#717182]">
                      {o.hint}
                    </span>
                  )}
                </span>
                {isSelected && <Check size={15} className="mt-0.5 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
