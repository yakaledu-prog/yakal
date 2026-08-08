import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { TestingPlan } from "@/components/college/TestingPlan";
import { RoadmapTimeline } from "@/components/college/RoadmapTimeline";
import { getCollegeProfile, AppStage } from "@/services/collegeService";
import { Loader2, ExternalLink, Calendar, PenTool, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";
import { COLLEGE_RESOURCES } from "@/config/collegeResources";
import { nextDateFor } from "@/config/admissionsCalendar";
import { RoadmapAssistant } from "@/components/college/RoadmapAssistant";

export type RoadmapTab = "timeline" | "testing" | "resources" | "assistant";

export const ROADMAP_TABS: { id: RoadmapTab; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "testing", label: "Testing Plan" },
  { id: "resources", label: "Resources" },
  { id: "assistant", label: "Ask Yakal" },
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

/**
 * The college roadmap: stage, intended major, graduation year and the
 * grade-by-grade timeline.
 *
 * Read-only everywhere. Stage, major and graduation year are collected at
 * onboarding and edited on the profile, so this page only shows them.
 * `embedded` drops the banner so it can sit inside another page's chrome.
 */
export function StudentRoadmap({
  studentId,
  embedded,
  tab: tabProp,
  onTabChange,
  hideChrome,
  gradeLevel,
  subjectName,
}: {
  studentId?: string;
  embedded?: boolean;
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

  const targetId = studentId || user?.id;
  // Read once per mount rather than during render: the compiler rules count a
  // Date() in the render body as impure, and it would also re-sort on every
  // keystroke elsewhere on the page.
  const [now] = useState(() => new Date());

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", targetId],
    queryFn: () => getCollegeProfile(targetId!),
    enabled: !!targetId,
  });

  const app = data?.application;

  const [ownTab, setOwnTab] = useState<RoadmapTab>("timeline");
  const tab = tabProp ?? ownTab;
  const setTab = onTabChange ?? setOwnTab;

  // Read straight off the query rather than mirrored into state.
  //
  // These were three editable fields in the banner with a debounced autosave
  // behind them. They are collected at onboarding and edited on the profile
  // now, so here they are only read, and mirroring a query into state costs a
  // sync effect and a stale render for nothing.
  const stage: AppStage = app?.stage || "research";
  const major = app?.program_interest || "";
  const gradYear = app?.grad_year ? String(app.grad_year) : "";

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

          <div className="relative z-10 flex flex-col gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">College Admissions</h1>
              <p className="text-white/80 text-[15px] mt-1">Your roadmap to college</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 overflow-x-auto pb-0">
              {[
                { id: "timeline", label: "Timeline", icon: <Calendar size={16} /> },
                { id: "testing", label: "Testing Plan", icon: <PenTool size={16} /> },
                { id: "resources", label: "Resources", icon: <BookOpen size={16} /> },
                { id: "assistant", label: "Ask Yakal", icon: <Sparkles size={16} /> }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={cn(
                    "flex items-center gap-2 pb-3 text-[13px] font-normal uppercase tracking-wider whitespace-nowrap transition-all border-b-[3px]",
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
              { id: "resources", label: "Resources", icon: <BookOpen size={16} /> },
              { id: "assistant", label: "Ask Yakal", icon: <Sparkles size={16} /> }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as any)}
                className={cn(
                  "whitespace-nowrap border-b-[3px] py-3 text-[14px] flex items-center gap-2 transition-colors",
                  tab === t.id
                    ? "border-[#1099A1] font-normal text-[#111] dark:text-white"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {COLLEGE_RESOURCES.map((r) => {
                  // The date rides on the card it belongs to. A separate strip
                  // above the grid was a second list to read that pointed at
                  // the same links.
                  const due = nextDateFor(now, r.dates);
                  return (
                    <a
                      key={r.url}
                      href={r.url}
                      // A new tab, because a family is midway through a
                      // roadmap and sending them off it loses their place.
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start justify-between p-4 border border-[#e9edef] dark:border-[#2a3942] hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-[#1099A1] group-hover:underline text-[14px]">{r.title}</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">{r.desc}</p>
                        {due && (
                          <p className="text-[12.5px] text-[#CAA25F] mt-1.5">
                            {due.label}{" "}
                            {due.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                            {" \u00b7 "}
                            {due.daysAway === 0 ? "today" : `in ${due.daysAway} days`}
                          </p>
                        )}
                      </div>
                      <ExternalLink size={14} className="text-muted-foreground opacity-50 group-hover:opacity-100" />
                    </a>
                  );
                })}
              </div>
            )}

            {tab === "assistant" && (
              <RoadmapAssistant studentId={targetId} />
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
