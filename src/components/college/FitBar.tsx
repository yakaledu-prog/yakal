import { College, satMarkerPosition } from "@/services/collegeCatalogService";

/**
 * The school's admitted SAT middle 50 as a shaded band, with the student's own
 * score as a marker on top.
 *
 * This is the single most useful widget on the page: it turns "1480" from a
 * number into a position, which is how a counselor actually reasons about a
 * list. When the school reports no scores it renders an honest empty state
 * rather than a fake bar, because 29 percent of the top 300 report nothing.
 */
export function FitBar({
  college,
  sat,
  showLabels = true,
}: {
  college: College;
  sat: number | null | undefined;
  showLabels?: boolean;
}) {
  const hasRange = college.satLow !== null && college.satHigh !== null;

  if (!hasRange) {
    return (
      <div className="space-y-1">
        {showLabels && (
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              SAT range
            </span>
            <span className="text-[11px] text-muted-foreground">Not reported</span>
          </div>
        )}
        <div className="h-1 w-full rounded-sm bg-[#f3f3f5] dark:bg-[#2a3942]" />
      </div>
    );
  }

  const marker = satMarkerPosition(college, sat);
  // The band occupies the middle of a track padded by 60 points either side,
  // matching satMarkerPosition so the marker and band share one coordinate space.
  const lo = college.satLow! - 60;
  const hi = college.satHigh! + 60;
  const span = hi - lo;
  const bandLeft = ((college.satLow! - lo) / span) * 100;
  const bandWidth = ((college.satHigh! - college.satLow!) / span) * 100;

  return (
    <div className="space-y-1">
      {showLabels && (
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            SAT range
          </span>
          <span className="text-[11px] tabular-nums text-foreground/70">
            {college.satLow} - {college.satHigh}
          </span>
        </div>
      )}
      <div className="relative h-1.5 w-full rounded-sm bg-[#f3f3f5] dark:bg-[#2a3942]">
        <div
          className="absolute inset-y-0 rounded-sm bg-[#cbced4] dark:bg-[#4a5c66]"
          style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
        />
        {marker !== null && (
          <div
            className="absolute -top-0.5 h-2.5 w-0.5 rounded-sm bg-primary"
            style={{ left: `calc(${marker * 100}% - 1px)` }}
            title={`Your SAT: ${sat}`}
          />
        )}
      </div>
    </div>
  );
}
