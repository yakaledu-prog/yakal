import { cn } from "@/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Segmented control. Use instead of a dropdown when there are two to four
 * options and seeing all of them at once is part of the decision, which is
 * true of reach / target / safety.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ariaLabel,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  const h = size === "sm" ? "h-9" : "h-11";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative flex w-full rounded-xl bg-[#f3f3f5] p-1 dark:bg-[#1c2a32]",
        h,
        className
      )}
    >
      {/* One sliding pill rather than per-option backgrounds, so switching
          reads as a single object moving instead of two things blinking. */}
      {index >= 0 && (
        <span
          aria-hidden
          className="absolute inset-y-1 rounded-lg bg-white shadow-sm transition-[left,width] duration-200 ease-out dark:bg-[#324450]"
          style={{
            left: `calc(${(index / options.length) * 100}% + 4px)`,
            width: `calc(${100 / options.length}% - 8px)`,
          }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex-1 rounded-lg text-[13px] font-semibold transition-colors",
              active
                ? "text-[#1099A1]"
                : "text-[#717182] hover:text-[#111] dark:hover:text-white"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
