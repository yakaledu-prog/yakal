import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Horizontal step indicator. Completed steps stay clickable so going back to
 * change an earlier answer never means starting over.
 *
 * The label sits under its number rather than beside it. Beside it, the three
 * labels and two connectors competed for one line, so the connectors collapsed
 * to almost nothing and the row read as text with dots in it rather than as a
 * path with three stops on it.
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
    <ol className={cn("flex items-start", className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && !!onStepClick;

        return (
          <li
            key={label}
            className={cn(
              "flex min-w-0 items-start",
              i < steps.length - 1 && "flex-1"
            )}
          >
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex w-[76px] shrink-0 flex-col items-center gap-1.5",
                clickable && "cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-normal transition-colors",
                  done && "bg-primary text-white",
                  active && "bg-primary text-white",
                  !done && !active && "bg-[#ececf0] text-[#a8adb8] dark:bg-[#243239]"
                )}
              >
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-center text-[12.5px] leading-none transition-colors",
                  active
                    ? "font-semibold text-[#111] dark:text-white"
                    : "font-normal text-[#a8adb8] dark:text-[#7f8b93]"
                )}
              >
                {label}
              </span>
            </button>

            {i < steps.length - 1 && (
              // Level with the circles, not the labels, so the line joins the
              // stops rather than crossing the words under them.
              <span
                aria-hidden
                className={cn(
                  "mt-3 h-px min-w-[12px] flex-1 transition-colors",
                  done ? "bg-primary" : "bg-[#e9edef] dark:bg-[#2a3942]"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
