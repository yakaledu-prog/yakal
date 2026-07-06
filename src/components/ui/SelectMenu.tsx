import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/utils/cn";

type Option = string | { label: string; value: string };

interface SelectMenuProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}

const norm = (o: Option) => (typeof o === "string" ? { label: o, value: o } : o);

/** A custom floating-label dropdown (no native <select>), matching FloatingInput. */
export function SelectMenu({ label, value, onChange, options, className }: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filled = value !== "";
  const opts = options.map(norm);
  const selectedLabel = opts.find((o) => o.value === value)?.label ?? "";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full h-14 rounded-xl border bg-transparent pl-4 pr-10 pt-6 pb-1.5 text-left text-[14px] transition-all",
          "focus:outline-none focus:ring-2 focus:ring-[#1099A1]/15",
          open ? "border-[#1099A1] ring-2 ring-[#1099A1]/15" : "border-[#e9edef] dark:border-[#2a3942]",
          filled ? "text-[#111] dark:text-white" : "text-transparent"
        )}
      >
        <span className="block truncate">{selectedLabel || "placeholder"}</span>
      </button>

      <span
        className={cn(
          "pointer-events-none absolute left-4 transition-all duration-200",
          filled || open
            ? "top-2 text-[11px] font-medium text-[#1099A1]"
            : "top-1/2 -translate-y-1/2 text-[14px] text-[#54656f] dark:text-[#aebac1]"
        )}
      >
        {label}
      </span>

      <ChevronDown
        size={18}
        className={cn(
          "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-[#aebac1] transition-transform",
          open && "rotate-180"
        )}
      />

      {open && (
        <div className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] shadow-lg py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {opts.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-[14px] text-left transition-colors",
                  active
                    ? "text-[#1099A1] font-medium bg-[#1099A1]/5"
                    : "text-[#111] dark:text-white hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                )}
              >
                {opt.label}
                {active && <Check size={16} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
