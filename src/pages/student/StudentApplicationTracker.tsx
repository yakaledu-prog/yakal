import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import { RequirementsMatrix } from "@/components/college/RequirementsMatrix";
import { EssaysPanel, NewEssay } from "@/components/college/EssaysPanel";
import { DocumentsPanel } from "@/components/college/DocumentsPanel";
import { RecommendersPanel, NewRecommender } from "@/components/college/RecommendersPanel";
import {
  Essay,
  EssayStatus,
  RecStatus,
  Recommendation,
  addEssay,
  addRecommendation,
  addRequirement,
  deleteRecommendation,
  getCollegeProfile,
  toggleRequirement,
  updateEssay,
  updateRecommendation,
  updateTask,
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

export function StudentApplicationTracker() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("requirements");
  const [saving, setSaving] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", user?.id],
    queryFn: () => getCollegeProfile(user!.id),
    enabled: !!user?.id,
  });

  // Only used to decide whether the transcript requirement is met, so a failure
  // here should degrade the matrix rather than break the page.
  const { data: docs } = useQuery({
    queryKey: ["drive-docs", user?.id],
    queryFn: () => listDocuments(user!.id, profile?.full_name || "Student", user!.email),
    enabled: !!user?.id,
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
  const tasks = useMemo(() => data?.tasks ?? [], [data]);

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

  const earliestDeadline = useMemo(() => {
    const dates = schools.map((s) => s.deadline).filter(Boolean).sort() as string[];
    return dates[0] ?? null;
  }, [schools]);

  const openTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
        .slice(0, 3),
    [tasks]
  );

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["college-profile", user?.id] });

  /**
   * Writing an override rather than mutating the derived value. The derivation
   * stays intact underneath, so clearing the override later restores it.
   */
  const toggleReq = async (
    school: (typeof schools)[number],
    key: ReqKey,
    next: boolean
  ) => {
    const existing = school.requirements?.find((r) => r.label === OVERRIDE_LABEL[key]);
    const res = existing
      ? await toggleRequirement(existing.id, next)
      : await addRequirement(school.id, OVERRIDE_LABEL[key], null).then(async (r) => {
        if (r.success && r.data && next) await toggleRequirement(r.data.id, true);
        return r;
      });
    if (!res.success) return toast.error(res.error || "Could not update.");
    refresh();
  };

  const addEssayRow = async (e: NewEssay) => {
    if (!user) return;
    setSaving(true);
    const res = await addEssay(user.id, e);
    setSaving(false);
    if (!res.success) return toast.error(res.error || "Could not add that essay.");
    toast.success(`${e.title} added.`);
    refresh();
  };

  const setEssayStatus = async (id: string, status: EssayStatus) => {
    const res = await updateEssay(id, { status });
    if (!res.success) return toast.error(res.error || "Could not update.");
    refresh();
  };

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

  const addRec = async (r: NewRecommender) => {
    if (!user) return;
    setSaving(true);
    const res = await addRecommendation(user.id, r);
    setSaving(false);
    if (!res.success) return toast.error(res.error || "Could not add.");
    toast.success(`${r.recommender_name} added.`);
    refresh();
  };

  const setRecStatus = async (id: string, status: RecStatus) => {
    const res = await updateRecommendation(id, { status });
    if (!res.success) return toast.error(res.error || "Could not update.");
    refresh();
  };

  const removeRec = async (r: Recommendation) => {
    const res = await deleteRecommendation(r.id);
    if (!res.success) return toast.error(res.error || "Could not remove.");
    refresh();
  };

  const completeTask = async (id: string) => {
    const res = await updateTask(id, { status: "done" });
    if (!res.success) return toast.error(res.error || "Could not update.");
    refresh();
  };

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-full bg-background pb-12 dark:bg-[#111b21]">
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

          <div className="relative z-10 mx-auto max-w-[1100px]">
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

        <div className="mx-auto max-w-[1150px] space-y-6 p-6 md:p-10">
          {/* Tasks are cross-cutting, so they get a strip here and a home on the
              roadmap rather than a tab nobody would think to open. */}
          {openTasks.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[#e9edef] bg-white px-4 py-3 dark:border-[#2a3942] dark:bg-[#182229]">
              <span className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
                Next up
              </span>
              {openTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => completeTask(t.id)}
                  className="group inline-flex items-center gap-1.5 text-[13px] text-[#111] transition-colors hover:text-[#1099A1] dark:text-white"
                >
                  <CheckCircle2
                    size={14}
                    className="text-[#c2c7d0] transition-colors group-hover:text-[#1099A1]"
                  />
                  {t.title}
                  {t.due_date && (
                    <span className="tabular-nums text-[#a8adb8]">
                      {new Date(t.due_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </button>
              ))}
              <Link
                to="/student/roadmap"
                className="ml-auto text-[13px] font-medium text-[#1099A1] hover:underline"
              >
                All tasks
              </Link>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : schools.length === 0 && tab === "requirements" ? (
            <div className="rounded-xl border border-dashed border-[#e9edef] py-16 text-center dark:border-[#2a3942]">
              <p className="text-[15px] text-[#111] dark:text-white">
                No colleges on your list yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#717182]">
                Requirements appear here once you add a college.
              </p>
              <Link
                to="/student/college-list"
                className="mt-4 inline-flex h-10 items-center rounded-xl bg-[#1099A1] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b]"
              >
                Go to my list
              </Link>
            </div>
          ) : (
            <>
              {tab === "requirements" && (
                <RequirementsMatrix schools={schools} ctx={ctx} onToggle={toggleReq} />
              )}

              {tab === "essays" && (
                <EssaysPanel
                  essays={essays}
                  schools={schools}
                  onAdd={addEssayRow}
                  onStatusChange={setEssayStatus}
                  onCreateDoc={makeDoc}
                  onAskReview={askReview}
                  creatingDoc={creatingDoc}
                  counts={counts}
                  saving={saving}
                />
              )}

              {tab === "documents" && user && (
                <DocumentsPanel
                  studentId={user.id}
                  studentName={profile?.full_name || "Student"}
                  studentEmail={user.email}
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
    </PageWrapper>
  );
}
