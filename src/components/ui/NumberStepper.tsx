import { Minus, Plus } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Small integer input with tap targets instead of the native number spinner,
 * whose arrows are near-unhittable and render differently in every browser.
 *
 * Empty is a real value here, distinct from zero: "no supplements" and "I have
 * not checked yet" are different facts and must not collapse into 0.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  placeholder = "-",
  className,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const step = (delta: number) => onChange(clamp((value ?? 0) + delta));

  const btn =
    "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#717182] transition-colors hover:bg-[#ececf0] hover:text-[#111] disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-[#243239] dark:hover:text-white";

  return (
    <div
      className={cn(
        "inline-flex h-11 items-center gap-1 rounded-xl border border-[#e9edef] bg-white p-1 transition-colors focus-within:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32]",
        className
      )}
    >
      <button
        type="button"
        className={btn}
        onClick={() => step(-1)}
        disabled={value !== null && value <= min}
        aria-label="Decrease"
      >
        <Minus size={15} />
      </button>
      <input
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          onChange(raw === "" ? null : clamp(Number(raw)));
        }}
        className="w-10 bg-transparent text-center text-[15px] font-semibold tabular-nums text-[#111] outline-none placeholder:font-normal placeholder:text-[#a8adb8] dark:text-white"
      />
      <button
        type="button"
        className={btn}
        onClick={() => step(1)}
        disabled={value !== null && value >= max}
        aria-label="Increase"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
