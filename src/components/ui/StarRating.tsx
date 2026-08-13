import { Star } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * A tutor's average rating.
 *
 * Unrated is its own state, not zero stars. A tutor nobody has rated yet and a
 * tutor everybody rated one star are opposite facts, and drawing both as an
 * empty row of stars tells a parent the wrong one.
 *
 * The count is always shown beside the average, because 5.0 from one lesson
 * and 4.6 from ninety are not the same claim.
 */
export function StarRating({
  average,
  count,
  size = 14,
  className,
}: {
  average: number | null | undefined;
  count: number;
  size?: number;
  className?: string;
}) {
  if (average == null || count === 0) {
    return (
      <span className={cn("text-[12.5px] text-muted-foreground", className)}>
        Not yet rated
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-1", className)}>
      <Star size={size} className="shrink-0 text-secondary" fill="currentColor" strokeWidth={0} />
      <span className="text-[13px] font-medium text-foreground">{average.toFixed(1)}</span>
      <span className="text-[12.5px] text-muted-foreground">
        ({count})
      </span>
    </span>
  );
}
