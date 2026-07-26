import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LayoutGrid, List, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { cn } from "@/utils/cn";
import { CatalogFilterRail } from "@/components/college/CatalogFilterRail";
import { CollegeCard } from "@/components/college/CollegeCard";
import { FitBar } from "@/components/college/FitBar";
import {
  CatalogFilters,
  College,
  CONTROL_LABEL,
  EMPTY_FILTERS,
  Fit,
  FIT_LABEL,
  SortKey,
  computeFit,
  filterCatalog,
  loadCatalog,
  sortCatalog,
  statesIn,
} from "@/services/collegeCatalogService";
import { addSchoolFromCatalog } from "@/services/collegeService";
import { getCollegeProfile } from "@/services/collegeService";

const SORTS: DropdownOption<SortKey>[] = [
  { value: "fit", label: "Best fit", hint: "Targets first, then safeties" },
  { value: "size", label: "Largest" },
  { value: "admitRate", label: "Most selective" },
  { value: "netPrice", label: "Lowest net price" },
  { value: "gradRate", label: "Graduation rate" },
  { value: "name", label: "Name, A to Z" },
];

const PAGE_SIZE = 24;

export function StudentExploreUniversities() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: catalog, isLoading, isError } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    // The catalog is refreshed once a year. Never refetch it inside a session.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const { data: profile } = useQuery({
    queryKey: ["college-profile", user?.id],
    queryFn: () => getCollegeProfile(user!.id),
    enabled: !!user?.id,
  });

  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>("fit");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [adding, setAdding] = useState<number | null>(null);

  const academics = profile?.academics ?? null;
  const student = useMemo(
    () => ({ sat: academics?.sat_score, act: academics?.act_score, gpa: academics?.gpa }),
    [academics]
  );
  const hasProfile = !!(student.sat || student.act);
  const [fitEnabled, setFitEnabled] = useState(true);
  const fitActive = fitEnabled && hasProfile;

  const profileSummary = useMemo(() => {
    const bits: string[] = [];
    if (academics?.gpa) bits.push(`${academics.gpa} GPA`);
    if (academics?.sat_score) bits.push(`${academics.sat_score} SAT`);
    if (academics?.act_score) bits.push(`${academics.act_score} ACT`);
    return bits.length ? `Ranked against your ${bits.join(" and ")}` : "";
  }, [academics]);

  // Names already on the list. The schema keys the list on school_name today,
  // so matching is by name until the unitid column lands. See
  // docs/db_migration_add_college_catalog.sql.
  const addedNames = useMemo(
    () => new Set((profile?.schools ?? []).map((s) => s.school_name.toLowerCase())),
    [profile]
  );

  const states = useMemo(() => (catalog ? statesIn(catalog) : []), [catalog]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const filtered = filterCatalog(catalog, filters, fitActive ? student : {});
    return sortCatalog(filtered, sort, fitActive ? student : {});
  }, [catalog, filters, sort, student, fitActive]);

  const visible = results.slice(0, limit);

  const add = async (c: College) => {
    if (!user) return;
    setAdding(c.unitid);
    const fit = fitActive ? computeFit(c, student) : "target";
    const res = await addSchoolFromCatalog(user.id, {
      unitid: c.unitid,
      school_name: c.name,
      // The student's own starting guess. A counselor confirms or overrides it,
      // which is the whole point of the review step.
      tier: fit === "reach" ? "dream" : fit === "safety" ? "safety" : "target",
    });
    setAdding(null);
    if (!res.success) {
      toast.error(res.error || "Could not add that school.");
      return;
    }
    toast.success(`${c.name} added to your list.`);
    qc.invalidateQueries({ queryKey: ["college-profile", user.id] });
  };

  if (isLoading) {
    return (
      <PageWrapper className="grid place-items-center">
        <Loader2 className="animate-spin text-[#1099A1]" size={22} />
      </PageWrapper>
    );
  }

  if (isError || !catalog) {
    return (
      <PageWrapper className="grid place-items-center p-8">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto text-muted-foreground" size={22} />
          <p className="mt-2 text-[14px] font-semibold text-foreground">
            The university catalog did not load.
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Reload the page. If it keeps failing, your college list still works.
          </p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1">
      <CatalogFilterRail
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          setLimit(PAGE_SIZE);
        }}
        states={states}
        hasProfile={hasProfile}
        profileSummary={profileSummary}
        fitEnabled={fitEnabled}
        onToggleFit={setFitEnabled}
        resultCount={results.length}
      />

      <PageWrapper className="min-w-0 !p-0">
        {/* Matches the Course Catalog banner so the two catalogs read as one product. */}
        <div className="relative shrink-0 overflow-hidden bg-[#1099A1] px-6 pb-6 pt-6 text-white md:px-10 md:pb-8 md:pt-10">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path
              d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
            />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                Explore universities
              </h1>
              <p className="pt-1 text-[15px] text-white/80">
                {catalog.length.toLocaleString()} four-year US universities. Cost,
                admit rates and score ranges come from the federal College
                Scorecard, so you never type them in.
              </p>
              {!hasProfile && (
                <p className="pt-1 text-[13px] text-white/70">
                  Add your GPA and test scores in your profile to see which schools
                  are a reach, target or safety for you.
                </p>
              )}
            </div>

            <div className="flex flex-col items-start justify-between gap-4 border-t border-white/20 pt-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <div className="flex shrink-0 rounded-lg border border-white/20 bg-black/10 p-1">
                  {([
                    ["grid", LayoutGrid, "Grid view"],
                    ["table", List, "Table view"],
                  ] as const).map(([v, Icon, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-label={label}
                      aria-pressed={view === v}
                      className={cn(
                        "rounded-md p-1.5 transition-colors",
                        view === v
                          ? "bg-white text-[#1099A1] shadow-sm"
                          : "text-white hover:bg-white/20"
                      )}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>

                <Dropdown
                  value={sort}
                  onChange={setSort}
                  options={SORTS}
                  tone="onDark"
                  ariaLabel="Sort universities"
                  className="w-[190px]"
                />
              </div>

              <div className="flex items-center gap-2 self-end lg:self-auto">
                <span className="text-[13px] tabular-nums text-white/80">
                  Showing {visible.length.toLocaleString()} of{" "}
                  {results.length.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          {results.length === 0 ? (
            <div className="mx-auto max-w-sm py-16 text-center">
              <p className="text-[14px] font-semibold text-foreground">
                No universities match these filters.
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Widen the net price or admit rate, or clear a state.
              </p>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="mt-3 rounded-sm bg-[#1099A1] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0d848b]"
              >
                Clear all filters
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visible.map((c) => (
                <CollegeCard
                  key={c.unitid}
                  college={c}
                  fit={fitActive ? computeFit(c, student) : "unknown"}
                  sat={fitActive ? student.sat : null}
                  isAdded={addedNames.has(c.name.toLowerCase()) || adding === c.unitid}
                  onAdd={add}
                  onOpen={() => {
                    /* Detail panel lands with the university detail page. */
                  }}
                />
              ))}
            </div>
          ) : (
            <CollegeTable
              colleges={visible}
              student={fitActive ? student : {}}
              fitActive={fitActive}
              addedNames={addedNames}
              onAdd={add}
            />
          )}

          {visible.length < results.length && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLimit(limit + PAGE_SIZE * 2)}
                className="rounded-sm border border-[#e9edef] px-4 py-2 text-[13px] font-semibold text-foreground hover:border-[#cbd5d8] dark:border-[#2a3942]"
              >
                Show more ({(results.length - visible.length).toLocaleString()} left)
              </button>
            </div>
          )}

          <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground text-center">
            Cost, admit rate, test scores, size and outcomes: US Department of
            Education College Scorecard, June 2026 release. Campus photographs via
            Wikimedia Commons, individually credited. Application deadlines and
            essay prompts are not part of this federal data and are verified
            separately by Yakal counselors.
          </p>
        </div>
      </PageWrapper>
    </div>
  );
}

function CollegeTable({
  colleges,
  student,
  fitActive,
  addedNames,
  onAdd,
}: {
  colleges: College[];
  student: { sat?: number | null; act?: number | null; gpa?: number | null };
  fitActive: boolean;
  addedNames: Set<string>;
  onAdd: (c: College) => void;
}) {
  const th =
    "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";
  const td = "px-3 py-2.5 text-[13px] text-foreground";

  return (
    <div className="overflow-x-auto rounded-sm border border-[#e9edef] dark:border-[#2a3942]">
      <table className="w-full min-w-[900px] border-collapse">
        <thead className="border-b border-[#e9edef] dark:border-[#2a3942]">
          <tr>
            <th className={th}>University</th>
            <th className={th}>Location</th>
            <th className={th}>Type</th>
            <th className={cn(th, "text-right")}>Admit</th>
            <th className={cn(th, "text-right")}>Net price</th>
            <th className={cn(th, "text-right")}>Grad rate</th>
            <th className={cn(th, "w-[140px]")}>SAT range</th>
            {fitActive && <th className={th}>Fit</th>}
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {colleges.map((c) => {
            const fit: Fit = fitActive ? computeFit(c, student) : "unknown";
            const added = addedNames.has(c.name.toLowerCase());
            return (
              <tr
                key={c.unitid}
                className="border-b border-[#e9edef] last:border-0 hover:bg-[#f9fafb] dark:border-[#2a3942] dark:hover:bg-[#1c2a32]"
              >
                <td className={cn(td, "font-medium")}>{c.name}</td>
                <td className={cn(td, "text-muted-foreground")}>
                  {[c.city, c.state].filter(Boolean).join(", ")}
                </td>
                <td className={cn(td, "text-muted-foreground")}>
                  {c.control ? CONTROL_LABEL[c.control] : "-"}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {c.admitRate === null ? "-" : `${c.admitRate}%`}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {c.netPrice === null ? "-" : `$${c.netPrice.toLocaleString()}`}
                </td>
                <td className={cn(td, "text-right tabular-nums")}>
                  {c.gradRate === null ? "-" : `${c.gradRate}%`}
                </td>
                <td className={td}>
                  <FitBar college={c} sat={student.sat} showLabels={false} />
                </td>
                {fitActive && (
                  <td className={cn(td, "text-muted-foreground")}>{FIT_LABEL[fit]}</td>
                )}
                <td className={cn(td, "text-right")}>
                  <button
                    type="button"
                    onClick={() => onAdd(c)}
                    disabled={added}
                    className={cn(
                      "rounded-sm px-2 py-1 text-[12px] font-semibold",
                      added
                        ? "text-muted-foreground"
                        : "bg-[#1099A1] text-white hover:bg-[#0d848b]"
                    )}
                  >
                    {added ? "Added" : "Add"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
