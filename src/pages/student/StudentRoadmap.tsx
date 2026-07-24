import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCollegeProfile, upsertApplication, AppStage } from "@/services/collegeService";
import { Map, Loader2, ExternalLink, Calendar, PenTool, BookOpen, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";

const STAGES: AppStage[] = ["research", "apply", "submitted", "decisions", "enrolled"];

const field = "bg-white/10 border-transparent text-white placeholder-white/50 focus:border-white focus:bg-white/20 transition-all rounded-sm px-3 py-2 text-[13px] outline-none w-full";

export function StudentRoadmap() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", user?.id],
    queryFn: () => getCollegeProfile(user!.id),
    enabled: !!user?.id,
  });

  const app = data?.application;

  // Use state or derive from data
  const [stage, setStage] = useState<AppStage>(app?.stage || "research");
  const [major, setMajor] = useState(app?.program_interest || "");
  const [gradYear, setGradYear] = useState(app?.grad_year ? String(app.grad_year) : "");
  const [tab, setTab] = useState<"timeline" | "testing" | "resources">("timeline");
  const [stageOpen, setStageOpen] = useState(false);

  // Sync state when data loads
  useEffect(() => {
    if (app) {
      setStage(app.stage);
      setMajor(app.program_interest || "");
      setGradYear(app.grad_year ? String(app.grad_year) : "");
    }
  }, [app]);

  // Debounce save when inputs change
  useEffect(() => {
    if (!user || isLoading) return;
    const timeout = setTimeout(async () => {
      const res = await upsertApplication(user.id, {
        stage,
        program_interest: major.trim() || null,
        grad_year: gradYear ? Number(gradYear) : null,
      });
      if (!res.success) {
        toast.error(res.error || "Failed to save profile");
      } else {
        qc.invalidateQueries({ queryKey: ["college-profile", user.id] });
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [stage, major, gradYear, user, isLoading, qc]);

  if (!user) return null;

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        {/* Header */}
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

        <div className="max-w-[1100px] mx-auto p-6 md:p-10 space-y-8">

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : (
            <>
              {tab === "timeline" && (
                <div className="space-y-8">
                  {/* Milestones Grid */}
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

                  {/* Grade-by-grade Timeline */}
                  <div>
                    <div className="border border-[#e9edef] dark:border-[#2a3942]">
                      {/* Grade 11 Section */}
                      <div className="p-5 border-b border-[#e9edef] dark:border-[#2a3942] bg-[#f8fafc] dark:bg-[#1a2730]">
                        <h3 className="text-lg font-bold">Grade 11 <span className="font-normal text-muted-foreground">· The pivotal testing & list-building year</span></h3>
                      </div>

                      <div className="p-5 space-y-6">
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="md:w-32 shrink-0">
                            <p className="font-bold text-[#667781] uppercase tracking-wide text-[13px]">Fall</p>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[15px]">PSAT/NMSQT - October</span>
                                <span className="bg-[#1099A1]/10 text-[#1099A1] text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm">SAT / ACT</span>
                              </div>
                              <p className="text-[14px] text-muted-foreground">The only year it counts for National Merit. Register through your school.</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[15px] mb-1">Keep grades up in your hardest year</p>
                              <p className="text-[14px] text-muted-foreground">Junior rigor + GPA carry the most weight in admissions.</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[15px]">Choose SAT or ACT</span>
                                <span className="bg-[#1099A1]/10 text-[#1099A1] text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm">SAT / ACT</span>
                              </div>
                              <p className="text-[14px] text-muted-foreground">Use your diagnostic and commit to one test to focus prep.</p>
                            </div>
                          </div>
                        </div>

                        <hr className="border-[#e9edef] dark:border-[#2a3942]" />

                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="md:w-32 shrink-0">
                            <p className="font-bold text-[#667781] uppercase tracking-wide text-[13px]">Winter</p>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[15px]">Start focused SAT/ACT prep</span>
                                <span className="bg-[#1099A1]/10 text-[#1099A1] text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm">SAT / ACT</span>
                              </div>
                              <p className="text-[14px] text-muted-foreground">Begin 8-12 weeks out, using official Bluebook (SAT) / ACT materials.</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[15px]">Register for a spring test</span>
                                <span className="bg-[#1099A1]/10 text-[#1099A1] text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm">SAT / ACT</span>
                              </div>
                              <p className="text-[14px] text-muted-foreground">SAT: March, May, June. ACT: February, April, June.</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[15px] mb-1">Draft a balanced college list</p>
                              <p className="text-[14px] text-muted-foreground">A mix of reach, match, and safety schools.</p>
                            </div>
                          </div>
                        </div>

                        <hr className="border-[#e9edef] dark:border-[#2a3942]" />

                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="md:w-32 shrink-0">
                            <p className="font-bold text-[#667781] uppercase tracking-wide text-[13px]">Spring</p>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[15px]">Take the SAT and/or ACT</span>
                                <span className="bg-[#1099A1]/10 text-[#1099A1] text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm">SAT / ACT</span>
                              </div>
                              <p className="text-[14px] text-muted-foreground">Spring of junior year is the ideal first sitting.</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[15px] mb-1">AP exams in May</p>
                              <p className="text-[14px] text-muted-foreground">Strong scores can earn college credit and show rigor.</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[15px] mb-1">Ask two teachers for recommendations</p>
                              <p className="text-[14px] text-muted-foreground">Ask in person, late spring, before summer break.</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[15px] mb-1">Visit colleges over spring break</p>
                              <p className="text-[14px] text-muted-foreground">Tours + info sessions sharpen your list.</p>
                            </div>
                          </div>
                        </div>

                        <hr className="border-[#e9edef] dark:border-[#2a3942]" />

                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="md:w-32 shrink-0">
                            <p className="font-bold text-[#667781] uppercase tracking-wide text-[13px]">Summer</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5">before senior year</p>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[15px]">Write your Common App essay</span>
                                <span className="bg-[#CAA25F] text-white text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm">Now</span>
                              </div>
                              <p className="text-[14px] text-muted-foreground">Draft the personal statement before senior year begins.</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-[15px]">Retake the SAT/ACT if needed</span>
                                <span className="bg-[#1099A1]/10 text-[#1099A1] text-[11px] px-1.5 py-0.5 font-bold uppercase rounded-sm">SAT / ACT</span>
                              </div>
                              <p className="text-[14px] text-muted-foreground">A summer / early-fall retake lifts your score before deadlines.</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[15px] mb-1">Finalize your list & start supplements</p>
                              <p className="text-[14px] text-muted-foreground">Research each school’s "why us" and essay prompts.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "testing" && (
                <div className="space-y-8">
                  {/* Typical Test Months */}
                  <div className="space-y-4 border border-[#e9edef] dark:border-[#2a3942] p-5 bg-white dark:bg-[#182229]">
                    <h3 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Typical Test Months</h3>
                    
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-12 text-center bg-[#e6f4f1] text-[#1099A1] text-[13px] font-bold px-2 py-1.5 rounded-full">SAT</span>
                        {["Aug", "Oct", "Nov", "Dec", "Mar", "May", "Jun"].map(m => (
                          <span key={m} className="bg-muted text-[13px] font-medium px-4 py-1.5 rounded-full">{m}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-12 text-center bg-[#fce8ed] text-[#d6336c] text-[13px] font-bold px-2 py-1.5 rounded-full">ACT</span>
                        {["Sep", "Oct", "Dec", "Feb", "Apr", "Jun", "Jul"].map(m => (
                          <span key={m} className="bg-muted text-[13px] font-medium px-4 py-1.5 rounded-full">{m}</span>
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-[13px] text-muted-foreground pt-1">
                      The SAT is now digital (College Board's Bluebook app). Always confirm exact dates on the official sites.
                    </p>
                  </div>

                  <div className="border border-[#e9edef] dark:border-[#2a3942] divide-y divide-[#e9edef] dark:divide-[#2a3942] bg-white dark:bg-[#182229]">
                    <div className="p-4 flex gap-4 items-start">
                      <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm">SAT</span>
                      </div>
                      <div>
                        <p className="font-semibold text-[14px]">PSAT/NMSQT · October of junior year</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">National Merit qualifier. Take the PSAT 10 sophomore year for practice.</p>
                      </div>
                    </div>
                    <div className="p-4 flex gap-4 items-start">
                      <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-center">SAT</span>
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-center">ACT</span>
                      </div>
                      <div>
                        <p className="font-semibold text-[14px]">First SAT / ACT · Spring of junior year</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">March-June. Pick SAT or ACT from a diagnostic, then prep 8-12 weeks.</p>
                      </div>
                    </div>
                    <div className="p-4 flex gap-4 items-start">
                      <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-center">SAT</span>
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-center">ACT</span>
                      </div>
                      <div>
                        <p className="font-semibold text-[14px]">Retake · Fall of senior year</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">August-October - before Early deadlines (by December for Regular Decision).</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
    </PageWrapper>
  );
}
