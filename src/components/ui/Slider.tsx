import { cn } from "@/utils/cn";

/**
 * Range slider.
 *
 * Built on the native input rather than a div with pointer handlers: keyboard
 * control, touch, and screen readers all come free and are genuinely hard to
 * reimplement correctly. Only the track and thumb are restyled, which is the
 * part that actually looks dated by default.
 */
export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <input
      type="range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      // The filled portion is a gradient on the track, so there is no second
      // element to keep in sync with the thumb.
      style={{
        background: `linear-gradient(to right, #1099A1 0%, #1099A1 ${pct}%, var(--slider-rail) ${pct}%, var(--slider-rail) 100%)`,
      }}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none",
        "[--slider-rail:#e3e3e8] dark:[--slider-rail:#2a3942]",
        // WebKit
        "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full",
        "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
        "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md",
        "[&::-webkit-slider-thumb]:transition-transform",
        "[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95",
        "dark:[&::-webkit-slider-thumb]:border-[#202c33]",
        // Firefox
        "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4",
        "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
        "[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary",
        "[&::-moz-range-thumb]:shadow-md dark:[&::-moz-range-thumb]:border-[#202c33]",
        "focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-primary/30",
        className
      )}
    />
  );
}
