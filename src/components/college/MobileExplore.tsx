import { useMemo, useState } from "react";
import { CalendarClock, GraduationCap, ListChecks, SlidersHorizontal, X } from "lucide-react";

import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { CatalogFilterRail } from "@/components/college/CatalogFilterRail";
import { cn } from "@/utils/cn";
import {
  CatalogFilters,
  College,
  EMPTY_FILTERS,
  Fit,
  SortKey,
  collegeImageUrl,
  computeFit,
} from "@/services/collegeCatalogService";

// ============================================================
// Explore, on a phone.
//
// The desktop page is a 260px filter rail beside a grid, which on a phone left
// a third of the width to a sidebar and the rest to one card at a time. This
// is its own component rather than a pile of breakpoints on that one, because
// the two are not the same layout narrowed: the filters move behind a sheet,
// the grid becomes a list, and a card turns on its side so the photograph
// stops costing a whole screen.
//
// Nothing here is a second source of truth. Filtering, sorting and fit all
// come from the same props the desktop page already computed, and the sheet
// renders the same CatalogFilterRail rather than a phone-shaped copy of it
// that would drift.
// ============================================================

const TABS = [
  { id: "all", label: "All" },
  { id: "fit", label: "Best fit" },
  { id: "saved", label: "Saved" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** How many filters are set, for the chip that opens the sheet. */
function countActive(f: CatalogFilters): number {
  let n = 0;
  if (f.query.trim()) n++;
  n += f.states.length ? 1 : 0;
  n += f.controls.length ? 1 : 0;
  n += f.locales.length ? 1 : 0;
  n += f.testPolicies.length ? 1 : 0;
  n += f.sizes.length ? 1 : 0;
  n += f.fits.length ? 1 : 0;
  if (f.maxNetPrice != null) n++;
  if (f.minAdmitRate != null || f.maxAdmitRate != null) n++;
  return n;
}

const money = (n: number | null) =>
  n == null ? "Not reported" : `$${n.toLocaleString()}/yr`;

const percent = (n: number | null) =>
  n == null ? "Not reported" : `${(n * 100).toFixed(n * 100 < 10 ? 1 : 0)}%`;

export function MobileExplore({
  colleges,
  totalCount,
  resultCount,
  filters,
  onFiltersChange,
  states,
  sort,
  onSortChange,
  sorts,
  fitActive,
  student,
  addedNames,
  addedCount,
  upcomingDeadlines,
  onAdd,
  hasProfile,
  profileSummary,
  fitEnabled,
  onToggleFit,
  onShowMore,
  moreLeft,
}: {
  colleges: College[];
  totalCount: number;
  resultCount: number;
  filters: CatalogFilters;
  onFiltersChange: (f: CatalogFilters) => void;
  states: string[];
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  sorts: DropdownOption<SortKey>[];
  fitActive: boolean;
  student: { sat?: number | null; act?: number | null; gpa?: number | null };
  addedNames: Set<string>;
  addedCount: number;
  upcomingDeadlines: number;
  onAdd: (c: College) => void;
  hasProfile: boolean;
  profileSummary: string;
  fitEnabled: boolean;
  onToggleFit: (v: boolean) => void;
  onShowMore: () => void;
  moreLeft: number;
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const activeFilters = countActive(filters);

  // The tabs are a view of the same list, not three queries. Saved reads the
  // names already on the student's list, which is what the Add button writes.
  const shown = useMemo(() => {
    if (tab === "saved") return colleges.filter((c) => addedNames.has(c.name.toLowerCase()));
    if (tab === "fit" && fitActive) {
      return colleges.filter((c) => {
        const f = computeFit(c, student);
        return f === "target" || f === "safety";
      });
    }
    return colleges;
  }, [tab, colleges, addedNames, fitActive, student]);

  return (
    <div className="flex min-h-0 flex-1 flex-col md:hidden">
      <header className="relative shrink-0 overflow-hidden bg-[#1099A1] px-5 pb-5 pt-6 text-white">
        <svg
          className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5"
          viewBox="0 0 400 200"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          <path
            d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            opacity="0.3"
          />
        </svg>

        <div className="relative z-10">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight">
            Explore universities
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[20px] text-white/80">
            {totalCount.toLocaleString()} four-year US universities. Cost, admit rates and
            score ranges come from the federal College Scorecard.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Tile icon={<GraduationCap size={15} />} label="Total schools" value={totalCount} />
            <Tile icon={<ListChecks size={15} />} label="On the list" value={addedCount} />
            <Tile icon={<CalendarClock size={15} />} label="Deadlines soon" value={upcomingDeadlines} />
          </div>
        </div>
      </header>

      {/* One scrolling row rather than a wrapping block, so the controls never
          push the first result below the fold. */}
      <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border bg-background px-4 py-3 hide-scrollbar">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
            activeFilters > 0
              ? "border-[#1099A1] text-[#1099A1]"
              : "border-border text-foreground"
          )}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilters > 0 && <span className="tabular-nums">({activeFilters})</span>}
        </button>

        <Dropdown
          value={sort}
          onChange={onSortChange}
          options={sorts}
          ariaLabel="Sort universities"
          className="w-[150px] shrink-0"
        />
      </div>

      <div className="flex shrink-0 border-b border-border bg-background">
        {TABS.map((t) => {
          const disabled = t.id === "fit" && !fitActive;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => !disabled && setTab(t.id)}
              disabled={disabled}
              title={disabled ? "Add your scores in your profile to rank by fit" : undefined}
              className={cn(
                "flex-1 border-b-[3px] px-2 py-3 text-[13.5px] transition-colors",
                tab === t.id
                  ? "border-[#1099A1] font-semibold text-[#1099A1]"
                  : "border-transparent text-muted-foreground",
                disabled && "opacity-40"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[13px] tabular-nums text-muted-foreground">
            {shown.length.toLocaleString()}
            {tab === "all" && shown.length < resultCount
              ? ` of ${resultCount.toLocaleString()}`
              : ""}{" "}
            {shown.length === 1 ? "match" : "matches"}
          </p>
        </div>

        {shown.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[14px] font-semibold text-foreground">
              {tab === "saved" ? "Nothing on the list yet." : "No universities match these filters."}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {tab === "saved"
                ? "Add a university and it appears here."
                : "Widen the net price or admit rate, or clear a state."}
            </p>
            {tab !== "saved" && activeFilters > 0 && (
              <button
                type="button"
                onClick={() => onFiltersChange(EMPTY_FILTERS)}
                className="mt-4 rounded-lg bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3 px-4 pb-6">
            {shown.map((c) => (
              <MobileCollegeCard
                key={c.unitid}
                college={c}
                fit={fitActive ? computeFit(c, student) : "unknown"}
                isAdded={addedNames.has(c.name.toLowerCase())}
                onAdd={onAdd}
              />
            ))}
          </ul>
        )}

        {tab === "all" && moreLeft > 0 && shown.length > 0 && (
          <div className="px-4 pb-8 text-center">
            <button
              type="button"
              onClick={onShowMore}
              className="w-full rounded-lg border border-border py-3 text-[13.5px] font-semibold text-foreground"
            >
              Show more ({moreLeft.toLocaleString()} left)
            </button>
          </div>
        )}
      </div>

      {/* The desktop rail, in a sheet. Rebuilding these controls for a phone
          would mean two sets of filters to keep in step, and they would not
          stay in step. */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 md:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="flex-1"
            onClick={() => setSheetOpen(false)}
          />
          <div className="flex max-h-[85vh] flex-col rounded-t-2xl bg-card">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p className="text-[15px] font-semibold text-foreground">Filters</p>
              <div className="flex items-center gap-3">
                {activeFilters > 0 && (
                  <button
                    type="button"
                    onClick={() => onFiltersChange(EMPTY_FILTERS)}
                    className="text-[13px] font-medium text-[#1099A1]"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                  className="rounded-full p-1 text-muted-foreground"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <CatalogFilterRail
              className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-card"
              filters={filters}
              onChange={onFiltersChange}
              states={states}
              hasProfile={hasProfile}
              profileSummary={profileSummary}
              fitEnabled={fitEnabled}
              onToggleFit={onToggleFit}
              resultCount={resultCount}
            />

            <div className="shrink-0 border-t border-border p-4">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="w-full rounded-lg bg-[#1099A1] py-3 text-[14px] font-semibold text-white"
              >
                Show {resultCount.toLocaleString()}{" "}
                {resultCount === 1 ? "university" : "universities"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/20 bg-black/10 px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[11px] leading-none text-white/70">
        {icon}
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 text-[19px] font-bold tabular-nums leading-none">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/**
 * One university, on its side.
 *
 * The desktop card leads with a wide photograph, which on a phone is most of a
 * screen for the least useful thing on it. Here the photograph is a thumbnail
 * and the three numbers a student actually compares sit where the eye lands.
 */
function MobileCollegeCard({
  college,
  fit,
  isAdded,
  onAdd,
}: {
  college: College;
  fit: Fit;
  isAdded: boolean;
  onAdd: (c: College) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const img = imgFailed ? null : collegeImageUrl(college.image, 320);

  const sat =
    college.satLow && college.satHigh
      ? `${college.satLow} to ${college.satHigh}`
      : "Not reported";

  // Plain coloured text, not a tinted capsule.
  const fitColour =
    fit === "safety" ? "#97CE9D" : fit === "target" ? "#1099A1" : fit === "reach" ? "#CAA25F" : null;

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex gap-3 p-3">
        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-lg bg-muted">
          {img && (
            <img
              src={img}
              alt=""
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-foreground">
            {college.name}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {[college.city, college.state].filter(Boolean).join(", ")}
            {college.control ? ` - ${college.control}` : ""}
            {fitColour && (
              <>
                {" - "}
                <span style={{ color: fitColour }} className="font-medium capitalize">
                  {fit}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 border-t border-border px-3 py-2.5">
        <Stat label="Admit rate" value={percent(college.admitRate)} />
        <Stat label="Net price" value={money(college.netPrice)} />
        <Stat label="SAT range" value={sat} />
      </dl>

      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
        <p className="text-[12.5px] text-muted-foreground">
          {college.undergrads ? `${college.undergrads.toLocaleString()} undergrads` : "Size not reported"}
        </p>
        <button
          type="button"
          onClick={() => onAdd(college)}
          disabled={isAdded}
          className={cn(
            "shrink-0 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors",
            isAdded
              ? "border border-border text-muted-foreground"
              : "bg-[#1099A1] text-white"
          )}
        >
          {isAdded ? "Added" : "Add"}
        </button>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium text-foreground">{value}</dd>
    </div>
  );
}
