import { cn } from "@/utils/cn";

/**
 * The Material indeterminate circular, in our teal.
 *
 * Google's loader, because everything slow enough here to need one is a call
 * to Google. It does two things at once: the whole ring turns, and the arc
 * grows and shrinks. The second is what makes it read as working rather than
 * merely turning, and it is the part a plain rotating ring leaves out.
 */
export function Spinner({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={cn("md-spinner", className)}
      width={size}
      height={size}
      viewBox="0 0 50 50"
      role="presentation"
    >
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="#1099A1"
        strokeWidth="4"
      />
    </svg>
  );
}

/** The spinner with a line under it, for a whole panel that is waiting. */
export function LoadingPanel({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4 py-16", className)}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      {label && <p className="text-[13px] text-muted-foreground">{label}</p>}
    </div>
  );
}
