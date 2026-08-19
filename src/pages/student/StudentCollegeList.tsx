import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Columns3, Download, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Dropdown, DropdownOption } from "@/components/ui/Dropdown";
import { ListBalance } from "@/components/college/ListBalance";
import { CollegeListRow } from "@/components/college/CollegeListRow";
import { supabase } from "@/lib/supabase";
import { AddCollegeModal, AddCollegeInput } from "@/components/college/AddCollegeModal";
import { CompareDialog } from "@/components/college/CompareDialog";
import { downloadCsv, toCsv } from "@/services/collegeExport";
import {
  College,
  computeFit,
  loadCatalog,
} from "@/services/collegeCatalogService";
import {
  CollegeListItem,
  SchoolStatus,
  SchoolTier,
  addSchoolFromCatalog,
  deleteSchool,
  getCollegeProfile,
  updateSchool,
} from "@/services/collegeService";

const TIERS: { key: SchoolTier; label: string }[] = [
  { key: "dream", label: "Reach" },
  { key: "target", label: "Target" },
  { key: "safety", label: "Safety" },
];

type SortKey = "deadline" | "tier" | "name" | "netPrice";

const SORTS: DropdownOption<SortKey>[] = [
  { value: "deadline", label: "Deadline", hint: "Soonest first" },
  { value: "tier", label: "Reach to safety" },
  { value: "netPrice", label: "Net price" },
  { value: "name", label: "Name, A to Z" },
];

/**
 * A student's college list.
 *
 * Shared rather than copied: the counselor's student drawer and the parent's
 * College List render this same component against a different `studentId`.
 * The two flags are separate on purpose. `embedded` is about chrome, whether
 * the page owns its banner or sits inside someone else's. `canEdit` is about
 * permission. A counselor is embedded and may still edit; a parent is embedded
 * and may not, because row level security gives them SELECT and nothing else.
 */
export function StudentCollegeList({
  studentId,
  embedded,
  canEdit = true,
}: {
  /** Whose list to show. Defaults to the signed-in user's own. */
  studentId?: string;
  embedded?: boolean;
  canEdit?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const targetId = studentId || user?.id;
  const refresh = () => qc.invalidateQueries({ queryKey: ["college-profile", targetId] });

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", targetId],
    queryFn: () => getCollegeProfile(targetId!),
    enabled: !!targetId,
  });

  // Names for anyone who added a college who is not the student: a counselor,
  // or a linked parent. One query for the whole list, and skipped entirely
  // when the student added everything themselves, which is the usual case.
  const outsiderIds = useMemo(
    () => [
      ...new Set(
        (data?.schools ?? [])
          .map((c: any) => c.entered_by)
          .filter((id: string | null) => id && id !== targetId)
      ),
    ] as string[],
    [data?.schools, targetId]
  );

  const { data: addedBy } = useQuery({
    queryKey: ["college-list-adders", outsiderIds.join(",")],
    queryFn: async () => {
      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", outsiderIds);
      return new Map<string, string>(
        (people ?? []).map((p: any) => [p.id, `${p.full_name} (${p.role})`])
      );
    },
    enabled: outsiderIds.length > 0,
  });

  const addedByName = (id?: string | null) =>
    id && id !== targetId ? (addedBy?.get(id) ?? null) : null;

  const { data: catalog } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sort, setSort] = useState<SortKey>("deadline");
  const [comparing, setComparing] = useState(false);

  const schools = useMemo(() => data?.schools ?? [], [data]);
  const academics = data?.academics ?? null;
  const student = useMemo(
    () => ({ sat: academics?.sat_score, act: academics?.act_score, gpa: academics?.gpa }),
    [academics]
  );

  // Catalog rows are keyed by unitid where present, otherwise matched by name so
  // colleges added before the migration still pick up their photo and figures.
  const byUnitid = useMemo(() => {
    const m = new Map<number, College>();
    catalog?.forEach((c) => m.set(c.unitid, c));
    return m;
  }, [catalog]);
  const byName = useMemo(() => {
    const m = new Map<string, College>();
    catalog?.forEach((c) => m.set(c.name.toLowerCase(), c));
    return m;
  }, [catalog]);

  const matchCollege = (s: CollegeListItem): College | null =>
    (s.unitid ? byUnitid.get(s.unitid) : undefined) ??
    byName.get(s.school_name.toLowerCase()) ??
    null;

  const counts = useMemo(
    () => ({
      dream: schools.filter((s) => s.tier === "dream").length,
      target: schools.filter((s) => s.tier === "target").length,
      safety: schools.filter((s) => s.tier === "safety").length,
    }),
    [schools]
  );

  const mismatches = useMemo(() => {
    if (!catalog) return 0;
    return schools.filter((s) => {
      const c = matchCollege(s);
      if (!c) return false;
      const fit = computeFit(c, student);
      if (fit === "unknown") return false;
      const declared =
        s.tier === "dream" ? "reach" : s.tier === "safety" ? "safety" : "target";
      return fit !== declared;
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools, catalog, student]);

  const sortItems = (items: CollegeListItem[]) => {
    const out = [...items];
    switch (sort) {
      case "name":
        return out.sort((a, b) => a.school_name.localeCompare(b.school_name));
      case "netPrice":
        return out.sort(
          (a, b) =>
            (matchCollege(a)?.netPrice ?? Infinity) -
            (matchCollege(b)?.netPrice ?? Infinity)
        );
      case "deadline":
      default:
        // Colleges with no deadline sink to the bottom: an unknown date is not
        // the same as a distant one, and must never outrank a real deadline.
        return out.sort((a, b) => {
          if (!a.deadline && !b.deadline) return a.school_name.localeCompare(b.school_name);
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        });
    }
  };

  const addedNames = useMemo(
    () => new Set(schools.map((s) => s.school_name.toLowerCase())),
    [schools]
  );

  // Every mutation writes against targetId and refreshes targetId's cache.
  // These used to use the signed-in user's id, so a counselor editing a
  // student's list refreshed their own empty profile and the change appeared
  // to have been lost.
  const submitAdd = async (input: AddCollegeInput) => {
    if (!targetId || !canEdit) return;
    setSaving(true);
    const res = await addSchoolFromCatalog(targetId, input);
    setSaving(false);
    if (!res.success) return toast.error(res.error || "Could not add that college.");
    setShowAdd(false);
    toast.success(`${input.school_name} added.`);
    refresh();
  };

  const changeStatus = async (id: string, status: SchoolStatus) => {
    if (!canEdit) return;
    const res = await updateSchool(id, { status });
    if (!res.success) return toast.error(res.error || "Could not update.");
    refresh();
  };

  const remove = async (item: CollegeListItem) => {
    if (!canEdit) return;
    const res = await deleteSchool(item.id);
    if (!res.success) return toast.error(res.error || "Could not remove.");
    toast.success(`${item.school_name} removed.`);
    refresh();
  };

  // No early return on a missing user: ProtectedRoute already guarantees one
  // here, and bailing out only blanked the page while auth was resolving.
  const content = (
    <>
      <div className="min-h-full bg-background pb-12 dark:bg-[#111b21]">
      {!embedded ? (
        <header className="relative overflow-hidden bg-primary px-6 pb-6 pt-6 text-white md:px-10 md:pb-8 md:pt-10">
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

          <div className="relative z-10 flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">My college list</h1>
              <p className="pt-1 text-[15px] text-white/80">
                Every college you are considering, with deadlines and costs in one place.
              </p>
            </div>

            <div className="flex items-center gap-3 border-t border-white/20 pt-4">
              <Dropdown
                value={sort}
                onChange={setSort}
                options={SORTS}
                tone="onDark"
                ariaLabel="Sort colleges"
                className="w-[180px]"
              />
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setComparing(true)}
                disabled={schools.length < 2}
                title={
                  schools.length < 2
                    ? "Add a second college to compare"
                    : undefined
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/30 px-3 text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <Columns3 size={15} />
                Compare
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `yakal-college-list-${new Date().toISOString().slice(0, 10)}.csv`,
                    toCsv(schools, matchCollege)
                  )
                }
                disabled={schools.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/30 px-3 text-[13px] font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <Download size={15} />
                Export CSV
              </button>

              {canEdit && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-[#0e848b] text-white text-[13px] font-semibold rounded-md transition-colors"
                >
                  <Plus size={16} /> Add School
                </button>
              )}
            </div>
          </div>
        </header>
      ) : (
        <div className="px-6 py-4 flex items-center justify-between border-b dark:border-[#2a3942] bg-card">
          <Dropdown
            value={sort}
            onChange={setSort}
            options={SORTS}
            ariaLabel="Sort colleges"
            className="w-[180px]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setComparing(true)}
              disabled={schools.length < 2}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-40"
            >
              <Columns3 size={15} /> Compare
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(`yakal-college-list-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(schools, matchCollege))}
              disabled={schools.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors hover:bg-muted disabled:opacity-40"
            >
              <Download size={15} /> CSV
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                <Plus size={15} /> Add School
              </button>
            )}
          </div>
        </div>
      )}

      <div className={cn("mx-auto space-y-6", embedded ? "px-6 py-6" : "p-6 md:p-10")}>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : schools.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e9edef] py-16 text-center dark:border-[#2a3942]">
              <p className="text-[15px] font-medium text-[#111] dark:text-white">
                No colleges yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#717182]">
                {canEdit
                  ? "Browse the catalog and add the ones you are curious about. You can change your mind later."
                  : "Nothing has been added to this list yet. It appears here as soon as it is."}
              </p>
              {/* Only on the student's own page. "/student/explore" is the
                  viewer's own route, so a counselor or parent viewing a student
                  would be sent to their own explore page - a locked one for
                  staff with no admissions plan, ending in "request access from
                  parent". Staff add colleges through the embedded add flow. */}
              {canEdit && !embedded && (
                <a
                  href="/student/explore"
                  className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  <Search size={15} />
                  Explore colleges
                </a>
              )}
            </div>
          ) : (
            <>
              <ListBalance counts={counts} mismatches={mismatches} />

              {TIERS.map(({ key, label }) => {
                const rows = sortItems(schools.filter((s) => s.tier === key));
                if (rows.length === 0) return null;
                return (
                  <section key={key}>
                    <h2 className="mb-2.5 flex items-baseline gap-2 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
                      {label}
                      <span className="tabular-nums text-[#a8adb8]">{rows.length}</span>
                    </h2>
                    <div className="space-y-2">
                      {rows.map((s) => (
                        <CollegeListRow
                          addedByName={addedByName(s.entered_by)}
                          key={s.id}
                          item={s}
                          college={matchCollege(s)}
                          student={student}
                          onStatusChange={changeStatus}
                          onRemove={remove}
                          canEdit={canEdit}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </>
          )}
        </div>
      </div>

      <CompareDialog
        open={comparing}
        rows={schools.map((item) => ({ item, college: matchCollege(item) }))}
        student={student}
        onClose={() => setComparing(false)}
      />

      <AddCollegeModal
        open={showAdd && canEdit}
        onClose={() => setShowAdd(false)}
        onSubmit={submitAdd}
        catalog={catalog ?? []}
        student={student}
        alreadyAdded={addedNames}
        saving={saving}
      />
    </>
  );

  if (embedded) return content;

  return (
    <PageWrapper className="!p-0">
      {content}
    </PageWrapper>
  );
}
