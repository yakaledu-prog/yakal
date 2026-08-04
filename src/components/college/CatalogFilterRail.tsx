import { useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Slider } from "@/components/ui/Slider";
import {
  CatalogFilters,
  Control,
  CONTROL_LABEL,
  EMPTY_FILTERS,
  Fit,
  Locale,
  TestPolicy,
} from "@/services/collegeCatalogService";

/** States a Yakal family is most likely to care about, pinned above the rest. */
const PRIORITY_STATES = ["MD", "VA", "DC", "PA", "DE", "NJ", "NY"];

const SIZE_OPTIONS: { value: "small" | "medium" | "large"; label: string }[] = [
  { value: "small", label: "Under 5,000" },
  { value: "medium", label: "5,000 to 15,000" },
  { value: "large", label: "Over 15,000" },
];

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "city", label: "City" },
  { value: "suburb", label: "Suburb" },
  { value: "town", label: "Town" },
  { value: "rural", label: "Rural" },
];

const TEST_OPTIONS: { value: TestPolicy; label: string }[] = [
  { value: "required", label: "Required" },
  { value: "considered_not_required", label: "Optional" },
  { value: "not_considered", label: "Not considered" },
];

const FIT_OPTIONS: { value: Fit; label: string }[] = [
  { value: "reach", label: "Reach" },
  { value: "target", label: "Target" },
  { value: "safety", label: "Safety" },
];

export function CatalogFilterRail({
  filters,
  onChange,
  states,
  hasProfile,
  profileSummary,
  fitEnabled,
  onToggleFit,
  resultCount,
  className,
}: {
  filters: CatalogFilters;
  onChange: (f: CatalogFilters) => void;
  states: string[];
  hasProfile: boolean;
  profileSummary: string;
  fitEnabled: boolean;
  onToggleFit: (v: boolean) => void;
  resultCount: number;
  /** Overridden on a phone, where this renders inside a sheet, not beside the grid. */
  className?: string;
}) {
  const set = <K extends keyof CatalogFilters>(k: K, v: CatalogFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const activeCount =
    filters.states.length +
    filters.controls.length +
    filters.locales.length +
    filters.sizes.length +
    filters.testPolicies.length +
    filters.fits.length +
    (filters.maxNetPrice !== null ? 1 : 0) +
    (filters.maxAdmitRate !== null ? 1 : 0) +
    (filters.withImageOnly ? 1 : 0);

  return (
    <aside
      className={
        className ??
        "flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#111b21]"
      }
    >
      <div className="p-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Search 1,900+ universities"
            className="w-full rounded-sm border border-[#e9edef] bg-[#f3f3f5] py-2 pl-8 pr-7 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32]"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => set("query", "")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Fit toggle. Off by default when we have no scores on file, because a
          fit ranking computed from nothing is worse than no ranking. */}
      <div className="border-t border-[#e9edef] px-3 py-3 dark:border-[#2a3942]">
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          {/* min-w-0 so the label yields rather than pushing the control past
              the rail's padding, which left the knob outside the panel. */}
          <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
            Fit for you
          </span>
          <button
            type="button"
            role="switch"
            // Off is the honest answer with no scores on file, and it has to
            // match what is drawn or a screen reader is told the opposite.
            aria-checked={fitEnabled && hasProfile}
            disabled={!hasProfile}
            onClick={() => onToggleFit(!fitEnabled)}
            title={hasProfile ? undefined : "Add a GPA and test scores first"}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              // Off, not merely faded, when there is nothing to rank against.
              // Painted on while it could not be switched, it read as a solid
              // blob with no moving part: a control that looked broken rather
              // than unavailable.
              fitEnabled && hasProfile
                ? "bg-[#1099A1]"
                : "bg-[#cbced4] dark:bg-[#2a3942]",
              hasProfile ? "cursor-pointer" : "cursor-not-allowed opacity-60"
            )}
          >
            {/* Positioned by left, not by a transform from wherever the box
                happened to land. With no left set, an absolute knob resolves
                from its static position, which put it at the right hand end
                when off and pushed it off the track altogether when on. */}
            <span
              className={cn(
                "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-[left] duration-200",
                fitEnabled && hasProfile ? "left-[22px]" : "left-[2px]"
              )}
            />
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {hasProfile ? profileSummary : "Add your GPA and test scores to rank by fit."}
        </p>
      </div>

      {hasProfile && (
        <Section title="Fit" defaultOpen>
          <ChipRow>
            {FIT_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={filters.fits.includes(o.value)}
                onClick={() => set("fits", toggle(filters.fits, o.value))}
              >
                {o.label}
              </Chip>
            ))}
          </ChipRow>
        </Section>
      )}

      <Section title="Location" defaultOpen>
        <StatePicker
          states={states}
          selected={filters.states}
          onToggle={(s) => set("states", toggle(filters.states, s))}
        />
      </Section>

      <Section title="Net price" defaultOpen>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Up to</span>
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {filters.maxNetPrice === null
              ? "Any"
              : `$${filters.maxNetPrice.toLocaleString()}`}
          </span>
        </div>
        <Slider
          min={5000}
          max={80000}
          step={2500}
          value={filters.maxNetPrice ?? 80000}
          onChange={(v) => set("maxNetPrice", v >= 80000 ? null : v)}
          ariaLabel="Maximum net price"
          className="mt-2"
        />
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          Average net price after aid, not sticker price. Schools that report no
          price are hidden while this is set.
        </p>
      </Section>

      <Section title="Type">
        <ChipRow>
          {(Object.keys(CONTROL_LABEL) as Control[]).map((c) => (
            <Chip
              key={c}
              active={filters.controls.includes(c)}
              onClick={() => set("controls", toggle(filters.controls, c))}
            >
              {CONTROL_LABEL[c]}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section title="Size">
        <ChipRow>
          {SIZE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={filters.sizes.includes(o.value)}
              onClick={() => set("sizes", toggle(filters.sizes, o.value))}
            >
              {o.label}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section title="Setting">
        <ChipRow>
          {LOCALE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={filters.locales.includes(o.value)}
              onClick={() => set("locales", toggle(filters.locales, o.value))}
            >
              {o.label}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section title="Admit rate">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Up to</span>
          <span className="text-[13px] font-semibold tabular-nums text-foreground">
            {filters.maxAdmitRate === null ? "Any" : `${filters.maxAdmitRate}%`}
          </span>
        </div>
        <Slider
          min={5}
          max={100}
          step={5}
          value={filters.maxAdmitRate ?? 100}
          onChange={(v) => set("maxAdmitRate", v >= 100 ? null : v)}
          ariaLabel="Maximum admit rate"
          className="mt-2"
        />
      </Section>

      <Section title="Testing">
        <ChipRow>
          {TEST_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={filters.testPolicies.includes(o.value)}
              onClick={() => set("testPolicies", toggle(filters.testPolicies, o.value))}
            >
              {o.label}
            </Chip>
          ))}
        </ChipRow>
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
          Federal data lags policy changes by more than a year. Confirm on the
          school's site before deciding not to submit scores.
        </p>
      </Section>

      <div className="sticky bottom-0 mt-auto border-t border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#111b21]">
        <div className="flex items-center justify-between">
          <span className="text-[12px] tabular-nums text-muted-foreground">
            {resultCount.toLocaleString()} match{resultCount === 1 ? "" : "es"}
          </span>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })}
              className="text-[12px] font-semibold text-[#1099A1] hover:underline"
            >
              Clear {activeCount}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-[#e9edef] dark:border-[#2a3942]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-sm border px-2 py-1 text-[12px] transition-colors",
        active
          ? "border-[#1099A1] bg-[#1099A1]/10 font-semibold text-[#0d757b] dark:text-[#5fc9cf]"
          : "border-[#e9edef] text-foreground/80 hover:border-[#cbd5d8] dark:border-[#2a3942] dark:hover:border-[#3a4a52]"
      )}
    >
      {children}
    </button>
  );
}

function StatePicker({
  states,
  selected,
  onToggle,
}: {
  states: string[];
  selected: string[];
  onToggle: (s: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const priority = PRIORITY_STATES.filter((s) => states.includes(s));
  const rest = states.filter((s) => !priority.includes(s));
  const shown = showAll ? [...priority, ...rest] : priority;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((s) => (
          <Chip key={s} active={selected.includes(s)} onClick={() => onToggle(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShowAll(!showAll)}
        className="mt-2 text-[12px] font-semibold text-[#1099A1] hover:underline"
      >
        {showAll ? "Show fewer" : `Show all ${states.length} states`}
      </button>
    </>
  );
}
