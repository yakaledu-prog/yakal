import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Horizontal step indicator. Completed steps stay clickable so going back to
 * change an earlier answer never means starting over.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: string[];
  current: number;
  onStepClick?: (index: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && !!onStepClick;

        return (
          // The label keeps its natural width and the connector absorbs the
          // slack, otherwise every step truncates to "Deadli...".
          <li
            key={label}
            className={cn(
              "flex items-center gap-2",
              i < steps.length - 1 && "flex-1"
            )}
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2",
                clickable && "cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                  done && "bg-[#1099A1] text-white",
                  active && "bg-[#1099A1] text-white",
                  !done && !active && "bg-[#ececf0] text-[#a8adb8] dark:bg-[#243239]"
                )}
              >
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-left text-[12px] font-semibold transition-colors",
                  active
                    ? "text-[#111] dark:text-white"
                    : "text-[#a8adb8] dark:text-[#7f8b93]"
                )}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px min-w-[12px] flex-1 transition-colors",
                  done ? "bg-[#1099A1]" : "bg-[#e9edef] dark:bg-[#2a3942]"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
