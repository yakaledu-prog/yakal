import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LayoutGrid, Loader2, Rows3, Search } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/utils/cn";
import { RequirementsMatrix } from "@/components/college/RequirementsMatrix";
import { RequirementsCards } from "@/components/college/RequirementsCards";
import { EssaysPanel, NewEssay } from "@/components/college/EssaysPanel";
import { DocumentsPanel } from "@/components/college/DocumentsPanel";
import { RecommendersPanel, NewRecommender } from "@/components/college/RecommendersPanel";
import {
  CollegeListItem,
  CollegeProfile,
  Essay,
  SchoolStatus,
  EssayStatus,
  RecStatus,
  Recommendation,
  addEssay,
  addRecommendation,
  addRequirement,
  deleteEssay,
  deleteRecommendation,
  getCollegeProfile,
  toggleRequirement,
  updateEssay,
  updateSchool,
  updateRecommendation,
} from "@/services/collegeService";
import { OVERRIDE_LABEL, ReqKey, StudentContext } from "@/services/requirementsService";
import {
  createEssayDoc,
  fileIdFromUrl,
  listDocuments,
  wordCounts,
} from "@/services/driveService";

type Tab = "requirements" | "essays" | "documents" | "recommendations";

const TABS: { id: Tab; label: string }[] = [
  { id: "requirements", label: "Requirements" },
  { id: "essays", label: "Essays" },
  { id: "documents", label: "Documents" },
  { id: "recommendations", label: "Recommendations" },
];

/**
 * What each college still needs.
 *
 * Shared with the counselor's student drawer and the parent's child view.
 * `embedded` drops the banner, `canEdit` decides whether a requirement can be
 * ticked. A parent gets neither: row level security gives them SELECT on their
 * linked child's rows and nothing more.
 */
export function StudentApplicationTracker({
  studentId,
  embedded,
  canEdit = true,
  forcedTab,
}: {
  studentId?: string;
  embedded?: boolean;
  canEdit?: boolean;
  forcedTab?: Tab;
}) {
  const { user, profile } = useAuth();

  // Somebody looking at a student who is not them: a counselor or an admin.
  // They verify documents, they do not upload them. A transcript belongs to
  // the student and staff have no copy to add.
  const staffViewing =
    !!studentId &&
    studentId !== user?.id &&
    (profile?.role === "counselor" || profile?.role === "admin");
  const qc = useQueryClient();
  const targetId = studentId || user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", targetId],
    queryFn: () => getCollegeProfile(targetId!),
    enabled: !!targetId,
  });
  const [internalTab, setInternalTab] = useState<Tab>("requirements");
  const tab = forcedTab || internalTab;
  const setTab = setInternalTab;
  const [saving, setSaving] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState<string | null>(null);
  // Cards answer "what does this college still need", the matrix answers
  // "which requirement is missing everywhere". Different questions, and a
  // counselor asks the second one far more often than a student does.
  const [reqView, setReqView] = useState<"cards" | "matrix">("cards");
  const [pendingEssayDelete, setPendingEssayDelete] = useState<Essay | null>(null);
  const [reqQuery, setReqQuery] = useState("");

  // Only used to decide whether the transcript requirement is met, so a failure
  // here should degrade the matrix rather than break the page.
  const { data: docs } = useQuery({
    queryKey: ["drive-docs", targetId],
    queryFn: () => listDocuments(targetId!, profile?.full_name || "Student", user?.email),
    enabled: !!targetId,
    retry: false,
  });

  const essayFileIds = useMemo(
    () =>
      (data?.essays ?? [])
        .map((e) => fileIdFromUrl(e.drive_url))
        .filter((id): id is string => !!id),
    [data]
  );

  // One request for the whole page rather than one per row: each count is a
  // full text export on the server.
  const { data: counts } = useQuery({
    queryKey: ["essay-words", essayFileIds.join(",")],
    queryFn: () => wordCounts(essayFileIds),
    enabled: essayFileIds.length > 0,
    staleTime: 60_000,
    retry: false,
  });

  const schools = useMemo(() => data?.schools ?? [], [data]);
  const essays = useMemo(() => data?.essays ?? [], [data]);
  const recommendations = useMemo(() => data?.recommendations ?? [], [data]);
  const hasTranscript =
    (docs?.sections.find((s) => s.name === "Transcripts")?.files.length ?? 0) > 0;

  const ctx: StudentContext = useMemo(
    () => ({
      academics: data?.academics ?? null,
      essays,
      recommendations,
      hasTranscript,
      // Stored on the umbrella application record so one answer covers every
      // college, which is how these two forms actually work.
      fafsaSubmitted: !!(data?.application as any)?.fafsa_submitted,
      cssSubmitted: !!(data?.application as any)?.css_submitted,
    }),
    [data, essays, recommendations, hasTranscript]
  );

  const visibleSchools = useMemo(() => {
    const q = reqQuery.trim().toLowerCase();
    return q ? schools.filter((s) => s.school_name.toLowerCase().includes(q)) : schools;
  }, [schools, reqQuery]);

  const earliestDeadline = useMemo(() => {
    const dates = schools.map((s) => s.deadline).filter(Boolean).sort() as string[];
    return dates[0] ?? null;
  }, [schools]);


  // Keyed on targetId. These used to key on the signed-in user, so a
  // counselor's edit to a student's tracker invalidated their own empty
  // profile and the change never appeared until a reload.
  const profileKey = ["college-profile", targetId];

  const refresh = () => qc.invalidateQueries({ queryKey: profileKey });

  /**
   * Patch the cached profile in place.
   *
   * Every mutation below is optimistic: a tick has to land under the cursor,
   * not after a round trip. The server is still the authority, so a failure
   * restores the snapshot and says so rather than leaving a lie on screen.
   */
  const patchProfile = (fn: (p: CollegeProfile) => CollegeProfile) => {
    qc.setQueryData<CollegeProfile>(profileKey, (prev) => (prev ? fn(prev) : prev));
  };

  // Named as a hook because it calls useMutation: the call order has to stay
  // stable across renders, and the linter should be able to see that.
  const useOptimistic = <V,>(
    apply: (vars: V, prev: CollegeProfile) => CollegeProfile,
    run: (vars: V) => Promise<{ success: boolean; error?: string }>,
    failure: string
  ) =>
    useMutation({
      mutationFn: async (vars: V) => {
        const res = await run(vars);
        if (!res.success) throw new Error(res.error || failure);
      },
      onMutate: async (vars: V) => {
        await qc.cancelQueries({ queryKey: profileKey });
        const snapshot = qc.getQueryData<CollegeProfile>(profileKey);
        patchProfile((prev) => apply(vars, prev));
        return { snapshot };
      },
      onError: (err, _vars, ctx) => {
        // Put back exactly what was there. A half-applied change is worse than
        // no change, because the student cannot tell which half took.
        if (ctx?.snapshot) qc.setQueryData(profileKey, ctx.snapshot);
        toast.error(err instanceof Error ? err.message : failure);
      },
      onSettled: () => qc.invalidateQueries({ queryKey: profileKey }),
    });

  /**
   * Writing an override rather than mutating the derived value. The derivation
   * stays intact underneath, so clearing the override later restores it.
   */
  const toggleReqM = useOptimistic<{
    school: CollegeListItem;
    key: ReqKey;
    next: boolean;
  }>(
    ({ school, key, next }, prev) => ({
      ...prev,
      schools: prev.schools.map((s) =>
        s.id !== school.id
          ? s
          : {
              ...s,
              requirements: (() => {
                const label = OVERRIDE_LABEL[key];
                const rows = s.requirements ?? [];
                return rows.some((r) => r.label === label)
                  ? rows.map((r) =>
                      r.label === label ? { ...r, is_complete: next } : r
                    )
                  : [
                      ...rows,
                      {
                        // Temporary id: the refetch in onSettled replaces it
                        // with the real row.
                        id: `optimistic-${school.id}-${key}`,
                        college_list_item_id: school.id,
                        label,
                        is_complete: next,
                        due_date: null,
                      },
                    ];
              })(),
            }
      ),
    }),
    async ({ school, key, next }) => {
      const existing = school.requirements?.find(
        (r) => r.label === OVERRIDE_LABEL[key]
      );
      if (existing && !existing.id.startsWith("optimistic-")) {
        return toggleRequirement(existing.id, next);
      }
      const created = await addRequirement(school.id, OVERRIDE_LABEL[key], null);
      if (!created.success || !created.data) return created;
      return next ? toggleRequirement(created.data.id, true) : created;
    },
    "Could not update that requirement."
  );

  const toggleReq = (school: CollegeListItem, key: ReqKey, next: boolean) =>
    toggleReqM.mutate({ school, key, next });

  const addEssayRow = async (e: NewEssay) => {
    if (!targetId || !canEdit) return;
    setSaving(true);
    const res = await addEssay(targetId, e);
    setSaving(false);
    if (!res.success) return toast.error(res.error || "Could not add that essay.");
    toast.success(`${e.title} added.`);
    refresh();
  };

  const setEssayStatusM = useOptimistic<{ id: string; status: EssayStatus }>(
    ({ id, status }, prev) => ({
      ...prev,
      essays: prev.essays.map((e) => (e.id === id ? { ...e, status } : e)),
    }),
    ({ id, status }) => updateEssay(id, { status }),
    "Could not update that essay."
  );

  const setEssayStatus = (id: string, status: EssayStatus) =>
    setEssayStatusM.mutate({ id, status });

  const makeDoc = async (essay: Essay) => {
    if (!user) return;
    setCreatingDoc(essay.id);
    try {
      const { file } = await createEssayDoc({
        studentId: user.id,
        studentName: profile?.full_name || "Student",
        title: essay.title,
        studentEmail: user.email,
      });
      await updateEssay(essay.id, { drive_url: file.webViewLink ?? null });
      toast.success("Google Doc created.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the doc.");
    } finally {
      setCreatingDoc(null);
    }
  };

  /**
   * Hand the draft to the counselor. Sets the status rather than just sending a
   * message, so the essay itself carries the fact that it is waiting on someone
   * and shows up in a counselor's queue.
   */
  const askReview = async (essay: Essay) => {
    const res = await updateEssay(essay.id, { status: "in_review" });
    if (!res.success) return toast.error(res.error || "Could not send for review.");
    toast.success("Sent to your counselor.");
    refresh();
  };

  /** Answering "how many supplements" from the essays page itself. */
  const setDecisionM = useOptimistic<{
    school: CollegeListItem;
    decision: SchoolStatus | null;
  }>(
    ({ school, decision }, prev) => ({
      ...prev,
      schools: prev.schools.map((s) =>
        s.id === school.id
          ? {
              ...s,
              status:
                decision ?? (school.deadline ? "applying" : "considering"),
            }
          : s
      ),
    }),
    ({ school, decision }) =>
      updateSchool(school.id, {
        // Clearing a decision returns the college to whatever it was before an
        // outcome existed, rather than leaving it stuck on a stale one.
        status: decision ?? (school.deadline ? "applying" : "considering"),
      }),
    "Could not save that decision."
  );

  const setDecision = (school: CollegeListItem, decision: SchoolStatus | null) =>
    setDecisionM.mutate({ school, decision });

  const setSuppCount = async (schoolId: string, count: number | null) => {
    const res = await updateSchool(schoolId, { supp_essay_count: count });
    if (!res.success) return toast.error(res.error || "Could not save.");
    refresh();
  };

  const deleteEssayM = useOptimistic<Essay>(
    (essay, prev) => ({
      ...prev,
      essays: prev.essays.filter((e) => e.id !== essay.id),
    }),
    (essay) => deleteEssay(essay.id),
    "Could not delete that essay."
  );

  const addRec = async (r: NewRecommender) => {
    if (!targetId || !canEdit) return;
    setSaving(true);
    const res = await addRecommendation(targetId, r);
    setSaving(false);
    if (!res.success) return toast.error(res.error || "Could not add.");
    toast.success(`${r.recommender_name} added.`);
    refresh();
  };

  const setRecStatusM = useOptimistic<{ id: string; status: RecStatus }>(
    ({ id, status }, prev) => ({
      ...prev,
      recommendations: prev.recommendations.map((r) =>
        r.id === id ? { ...r, status } : r
      ),
    }),
    ({ id, status }) => updateRecommendation(id, { status }),
    "Could not update that recommender."
  );

  const setRecStatus = (id: string, status: RecStatus) =>
    setRecStatusM.mutate({ id, status });

  const removeRec = async (r: Recommendation) => {
    const res = await deleteRecommendation(r.id);
    if (!res.success) return toast.error(res.error || "Could not remove.");
    refresh();
  };


  const content = (
    <>
      <div className="min-h-full bg-background pb-12 dark:bg-[#111b21]">
        {!forcedTab && (
          !embedded ? (
            <header className="relative overflow-hidden bg-[#1099A1] px-6 pt-6 text-white md:px-10 md:pt-10">
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

          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Applications</h1>
            <p className="pb-6 pt-1 text-[15px] text-white/80">
              What each college still needs from you.
            </p>

            <nav className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "whitespace-nowrap border-b-[3px] px-4 py-3 text-[14px] transition-colors",
                    tab === t.id
                      ? "border-white font-semibold text-white"
                      : "border-transparent text-white/60 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </header>
        ) : (
          <div className="px-6 border-b dark:border-[#2a3942] bg-card">
            <nav className="flex gap-4 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "whitespace-nowrap border-b-[3px] py-3 text-[14px] transition-colors",
                    tab === t.id
                      ? "border-[#1099A1] font-semibold text-[#111] dark:text-white"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          )
        )}

        <div className={cn("mx-auto space-y-6", embedded ? "px-6 py-6" : "p-6 md:p-10")}>
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : schools.length === 0 && tab === "requirements" ? (
            <div className="rounded-xl border border-dashed border-[#e9edef] py-16 text-center dark:border-[#2a3942]">
              <p className="text-[15px] text-[#111] dark:text-white">
                {canEdit ? "No colleges on your list yet" : "No colleges on this list yet"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#717182]">
                {canEdit
                  ? "Requirements appear here once you add a college."
                  : "Requirements appear here once a college is added."}
              </p>
              {canEdit && (
                <Link
                  to="/student/college-list"
                  className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#1099A1] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b]"
                >
                  Go to my list
                </Link>
              )}
            </div>
          ) : (
            <>
              {tab === "requirements" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-full max-w-[280px]">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a8adb8]"
                      />
                      <input
                        value={reqQuery}
                        onChange={(e) => setReqQuery(e.target.value)}
                        placeholder="Search colleges"
                        className="h-9 w-full rounded-lg border border-[#e9edef] bg-white pl-8 pr-3 text-[13px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white"
                      />
                    </div>

                    <p className="hidden shrink-0 text-[13px] text-[#54656f] sm:block dark:text-[#aebac1]">
                      {reqQuery.trim()
                        ? `${visibleSchools.length} of ${schools.length}`
                        : `${schools.length} colleges`}
                    </p>

                    <div className="flex-1" />
                    <div className="flex overflow-hidden rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
                      {([
                        ["cards", LayoutGrid, "Card view"],
                        ["matrix", Rows3, "Table view"],
                      ] as const).map(([v, Icon, label]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setReqView(v)}
                          aria-label={label}
                          aria-pressed={reqView === v}
                          className={cn(
                            "px-2 py-1.5 transition-colors",
                            reqView === v
                              ? "bg-[#1099A1] text-white"
                              : "text-[#717182] hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]"
                          )}
                        >
                          <Icon size={15} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {visibleSchools.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#e9edef] py-10 text-center dark:border-[#2a3942]">
                      <p className="text-[13px] text-[#717182]">
                        No college matches "{reqQuery.trim()}".
                      </p>
                    </div>
                  ) : reqView === "cards" ? (
                    <RequirementsCards
                      schools={visibleSchools}
                      ctx={ctx}
                      onToggle={toggleReq}
                      onDecision={setDecision}
                      canEdit={canEdit}
                    />
                  ) : (
                    <RequirementsMatrix
                      schools={visibleSchools}
                      ctx={ctx}
                      onToggle={toggleReq}
                      canEdit={canEdit}
                    />
                  )}
                </div>
              )}

              {tab === "essays" && (
                <EssaysPanel
                  essays={essays}
                  schools={schools}
                  onAdd={addEssayRow}
                  onStatusChange={setEssayStatus}
                  onCreateDoc={makeDoc}
                  onAskReview={askReview}
                  onSetSuppCount={setSuppCount}
                  onDelete={setPendingEssayDelete}
                  creatingDoc={creatingDoc}
                  counts={counts}
                  saving={saving}
                />
              )}

              {tab === "documents" && targetId && (
                <DocumentsPanel
                  studentId={targetId}
                  studentName={profile?.full_name || "Student"}
                  studentEmail={user?.email}
                  // Built long ago and never switched on: canReview defaults
                  // to false and nothing passed it, so a counselor saw the
                  // student's view of their own documents.
                  canReview={staffViewing}
                  reviewerId={user?.id}
                  canUpload={!staffViewing}
                />
              )}

              {tab === "recommendations" && (
                <RecommendersPanel
                  recommendations={recommendations}
                  earliestDeadline={earliestDeadline}
                  onAdd={addRec}
                  onStatusChange={setRecStatus}
                  onRemove={removeRec}
                  saving={saving}
                />
              )}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingEssayDelete}
        title="Delete this essay?"
        message={
          <>
            <span className="font-medium text-[#111] dark:text-white">
              {pendingEssayDelete?.title}
            </span>{" "}
            is removed from your list.{" "}
            {pendingEssayDelete?.drive_url
              ? "Its Google Doc stays in Drive, so nothing you wrote is lost."
              : "It has no document attached."}
          </>
        }
        confirmLabel="Delete"
        destructive
        busy={deleteEssayM.isPending}
        onConfirm={() => {
          if (pendingEssayDelete) deleteEssayM.mutate(pendingEssayDelete);
          setPendingEssayDelete(null);
        }}
        onCancel={() => setPendingEssayDelete(null)}
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
