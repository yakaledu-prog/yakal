import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { TestingPlan } from "@/components/college/TestingPlan";
import { RoadmapTimeline } from "@/components/college/RoadmapTimeline";
import { getCollegeProfile, upsertApplication, AppStage } from "@/services/collegeService";
import { Loader2, ExternalLink, Calendar, PenTool, BookOpen, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";

const STAGES: AppStage[] = ["research", "apply", "submitted", "decisions", "enrolled"];

export type RoadmapTab = "timeline" | "testing" | "resources";

export const ROADMAP_TABS: { id: RoadmapTab; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "testing", label: "Testing Plan" },
  { id: "resources", label: "Resources" },
];

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-[14px] font-medium text-foreground capitalize mt-0.5">{value}</p>
    </div>
  );
}

const field = "bg-white/10 border-transparent text-white placeholder-white/50 focus:border-white focus:bg-white/20 transition-all rounded-sm px-3 py-2 text-[13px] outline-none w-full";

/**
 * The college roadmap: stage, intended major, graduation year and the
 * grade-by-grade timeline.
 *
 * Shared with the parent's read-only view. `embedded` drops the banner so it
 * can sit inside another page's chrome; `canEdit` decides whether the header
 * fields are inputs or plain text.
 */
export function StudentRoadmap({
  studentId,
  embedded,
  tab: tabProp,
  onTabChange,
  hideChrome,
  canEdit = true,
  gradeLevel,
  subjectName,
}: {
  studentId?: string;
  embedded?: boolean;
  canEdit?: boolean;
  /**
   * The student's grade level. Only needed when viewing someone else: the
   * timeline highlights the current year, and reading it off the signed-in
   * profile would anchor a parent's view to the parent.
   */
  gradeLevel?: string | null;
  /** Whose roadmap this is, when the reader is not that person. */
  subjectName?: string;
  /**
   * Lifted out when the page around this one owns the banner, so the tabs can
   * sit on the teal header instead of in a strip below it. Uncontrolled
   * otherwise, which is how the student's own page uses it.
   */
  tab?: RoadmapTab;
  onTabChange?: (tab: RoadmapTab) => void;
  /** Drops the embedded facts-and-tabs strip when the parent renders them. */
  hideChrome?: boolean;
}) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const targetId = studentId || user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", targetId],
    queryFn: () => getCollegeProfile(targetId!),
    enabled: !!targetId,
  });

  const app = data?.application;

  // Use state or derive from data
  const [stage, setStage] = useState<AppStage>(app?.stage || "research");
  const [major, setMajor] = useState(app?.program_interest || "");
  const [gradYear, setGradYear] = useState(app?.grad_year ? String(app.grad_year) : "");
  const [ownTab, setOwnTab] = useState<RoadmapTab>("timeline");
  const tab = tabProp ?? ownTab;
  const setTab = onTabChange ?? setOwnTab;
  const [stageOpen, setStageOpen] = useState(false);

  // Sync state when data loads
  useEffect(() => {
    if (app) {
      setStage(app.stage);
      setMajor(app.program_interest || "");
      setGradYear(app.grad_year ? String(app.grad_year) : "");
    }
  }, [app]);

  // Debounced autosave, against the student whose roadmap this is.
  //
  // This used to write to the signed-in user's id unconditionally, so opening
  // someone else's roadmap created a college application row on the viewer's
  // own account and did nothing to the student's. A reader saves nothing at
  // all.
  useEffect(() => {
    if (!canEdit || !targetId || isLoading) return;
    const timeout = setTimeout(async () => {
      const res = await upsertApplication(targetId, {
        stage,
        program_interest: major.trim() || null,
        grad_year: gradYear ? Number(gradYear) : null,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to save profile");
      } else {
        qc.invalidateQueries({ queryKey: ["college-profile", targetId] });
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [stage, major, gradYear, targetId, canEdit, isLoading, qc]);

  if (!targetId) return null;

  const content = (
    <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
      {/* Header */}
      {!embedded ? (
        <div className="bg-[#1099A1] text-white p-6 md:p-10 !pb-0 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 max-w-[1100px] mx-auto flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between gap-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">College Admissions</h1>
                <p className="text-white/80 text-[15px] mt-1 mb-6">Your roadmap to college</p>
              </div>

              {/* Stats / Inputs in Header */}
              <div className="flex flex-col xl:flex-row gap-5 bg-black/10 p-4 rounded-md backdrop-blur-sm self-start w-full md:w-auto">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-white/70">Stage</label>
                  <div className="relative">
                    <button
                      onClick={() => setStageOpen(!stageOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider bg-black/20 hover:bg-black/30 transition-colors rounded-sm text-white min-w-[140px] justify-between border border-transparent focus:border-white/50 outline-none"
                    >
                      {stage === "research" ? "Researching" : stage}
                      <ChevronDown size={14} className={cn("transition-transform", stageOpen && "rotate-180")} />
                    </button>

                    {stageOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setStageOpen(false)} />
                        <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-sm shadow-xl overflow-hidden z-50 text-black py-1">
                          {STAGES.map((s) => (
                            <button
                              key={s}
                              onClick={() => { setStage(s); setStageOpen(false); }}
                              className={cn(
                                "block w-full text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors",
                                stage === s ? "bg-[#1099A1]/10 text-[#1099A1]" : "hover:bg-black/5 text-gray-700"
                              )}
                            >
                              {s === "research" ? "Researching" : s}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-full sm:w-56">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/70 block mb-1">Intended major</label>
                    <input className={field} value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
                  </div>
                  <div className="w-full sm:w-24">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-white/70 block mb-1">Grad year</label>
                    <input className={field} type="number" value={gradYear} onChange={(e) => setGradYear(e.target.value)} placeholder="2026" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 overflow-x-auto pb-0">
              {[
                { id: "timeline", label: "Timeline", icon: <Calendar size={16} /> },
                { id: "testing", label: "Testing Plan", icon: <PenTool size={16} /> },
                { id: "resources", label: "Resources", icon: <BookOpen size={16} /> }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={cn(
                    "flex items-center gap-2 pb-3 text-[13px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-[3px]",
                    tab === t.id
                      ? "border-white text-white !hover:border-primary"
                      : "border-transparent text-white/70 hover:text-white !hover:border-primary"
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : hideChrome ? null : (
        <div className="px-6 border-b dark:border-[#2a3942] bg-card">
          {/* The banner carries stage, major and graduation year. Embedded
              there is no banner, so they get a compact strip instead rather
              than disappearing. */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pt-4 pb-3">
            <Fact label="Stage" value={stage === "research" ? "Researching" : stage} />
            <Fact label="Intended major" value={major || "Not chosen yet"} />
            <Fact label="Grad year" value={gradYear || "Not set"} />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-0">
            {[
              { id: "timeline", label: "Timeline", icon: <Calendar size={16} /> },
              { id: "testing", label: "Testing Plan", icon: <PenTool size={16} /> },
              { id: "resources", label: "Resources", icon: <BookOpen size={16} /> }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as any)}
                className={cn(
                  "whitespace-nowrap border-b-[3px] py-3 text-[14px] flex items-center gap-2 transition-colors",
                  tab === t.id
                    ? "border-[#1099A1] font-semibold text-[#111] dark:text-white"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={cn("mx-auto p-6 md:p-10")}>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
        ) : (
          <>
            {tab === "timeline" && (
              <div className="space-y-8">
                {/* Milestones Grid */}
                {!embedded && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-[#e9edef] dark:border-[#2a3942] p-4 bg-muted/20">
                      <p className="text-[13px] font-bold text-[#1099A1] uppercase tracking-wider mb-1">Oct 1</p>
                      <p className="text-[15px] font-semibold">FAFSA opens</p>
                    </div>
                    <div className="border border-[#e9edef] dark:border-[#2a3942] p-4 bg-muted/20">
                      <p className="text-[13px] font-bold text-[#1099A1] uppercase tracking-wider mb-1">Nov 1</p>
                      <p className="text-[15px] font-semibold">Early apps (ED / EA)</p>
                    </div>
                    <div className="border border-[#e9edef] dark:border-[#2a3942] p-4 bg-muted/20">
                      <p className="text-[13px] font-bold text-[#1099A1] uppercase tracking-wider mb-1">May 1</p>
                      <p className="text-[15px] font-semibold">Decision Day</p>
                    </div>
                  </div>
                )}

                <RoadmapTimeline
                  gradYear={gradYear ? Number(gradYear) : app?.grad_year}
                  gradeLevel={studentId ? gradeLevel : profile?.grade_level}
                  subjectName={subjectName}
                />
              </div>
            )}

            {tab === "testing" && <TestingPlan />}

            {tab === "resources" && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { title: "Common App", desc: "Apply to 1,000+ colleges in one place", url: "#" },
                    { title: "FAFSA - Federal Student Aid", desc: "Federal grants, loans & work-study", url: "#" },
                    { title: "CSS Profile", desc: "Institutional aid at many private colleges", url: "#" },
                    { title: "BigFuture (College Board)", desc: "College search, planning & scholarships", url: "#" },
                    { title: "Digital SAT & Bluebook", desc: "Register and practice for the digital SAT", url: "#" },
                    { title: "The ACT", desc: "Register and prep for the ACT", url: "#" },
                    { title: "Khan Academy", desc: "Free SAT prep and academic help", url: "#" },
                    { title: "College Essay Guy", desc: "Step-by-step walkthroughs and essay guides", url: "#" }
                  ].map((r, i) => (
                    <a key={i} href={r.url} className="group flex items-start justify-between p-4 border border-[#e9edef] dark:border-[#2a3942] hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-semibold text-[#1099A1] group-hover:underline text-[14px]">{r.title}</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">{r.desc}</p>
                      </div>
                      <ExternalLink size={14} className="text-muted-foreground opacity-50 group-hover:opacity-100" />
                    </a>
                  ))}
                </div>
              </div>
            )}

          </>
        )}

      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <PageWrapper className="!p-0">
      {content}
    </PageWrapper>
  );
}
