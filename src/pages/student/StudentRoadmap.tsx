import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCollegeProfile, upsertApplication, AppStage } from "@/services/collegeService";
import { Map, Loader2, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";

const STAGES: AppStage[] = ["research", "apply", "submitted", "decisions", "enrolled"];

const field = "w-full bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-sm px-3 py-2 text-[14px] text-[#111] dark:text-white outline-none focus:border-[#1099A1]";
const btnPrimary = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-[#1099A1] text-white text-[13px] font-semibold hover:bg-[#0d848b] transition-colors disabled:opacity-60";

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
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"timeline" | "testing" | "resources">("timeline");

  // Sync state when data loads
  useEffect(() => {
    if (app) {
      setStage(app.stage);
      setMajor(app.program_interest || "");
      setGradYear(app.grad_year ? String(app.grad_year) : "");
    }
  }, [app]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const res = await upsertApplication(user.id, {
      stage,
      program_interest: major.trim() || null,
      grad_year: gradYear ? Number(gradYear) : null,
    });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error || "Something went wrong.");
    } else {
      toast.success("Saved.");
      qc.invalidateQueries({ queryKey: ["college-profile", user.id] });
    }
  };

  if (!user) return null;

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        {/* Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0">
          <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Map size={28} /> College Admissions</h1>
              <p className="text-white/80 text-[15px] mt-1 mb-6">Your roadmap to college</p>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="max-w-[1100px] mx-auto flex gap-1 overflow-x-auto">
            {[
              { id: "timeline", label: "Timeline" },
              { id: "testing", label: "Testing Plan" },
              { id: "resources", label: "Resources" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-[13px] font-bold uppercase tracking-wider whitespace-nowrap border-b-[3px] transition-colors",
                  tab === t.id
                    ? "border-white text-white"
                    : "border-transparent text-white/60 hover:text-white"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto p-6 md:p-10 space-y-8">
          
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : (
            <>
              {/* Top Inputs */}
              <div className="border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] p-5">
                <div className="grid md:grid-cols-4 gap-4 items-end">
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696a0] block mb-1.5">Stage</label>
                    <select className={field} value={stage} onChange={(e) => setStage(e.target.value as AppStage)}>
                      {STAGES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[12px] font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696a0] block mb-1.5">Intended major</label>
                    <input className={field} value={major} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
                  </div>
                  <div>
                    <label className="text-[12px] font-bold uppercase tracking-wider text-[#667781] dark:text-[#8696a0] block mb-1.5">Graduation year</label>
                    <div className="flex gap-2">
                      <input className={field} type="number" value={gradYear} onChange={(e) => setGradYear(e.target.value)} placeholder="2026" />
                      <button className={btnPrimary} onClick={save} disabled={saving}>
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

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
                    <h2 className="text-xl font-bold mb-4">Grade-by-grade timeline</h2>
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
                                <span className="font-semibold text-[15px]">PSAT/NMSQT — October</span>
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
                              <p className="text-[14px] text-muted-foreground">Begin 8–12 weeks out, using official Bluebook (SAT) / ACT materials.</p>
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
                <div>
                  <h2 className="text-xl font-bold mb-4">SAT & ACT testing plan</h2>
                  <div className="border border-[#e9edef] dark:border-[#2a3942] divide-y divide-[#e9edef] dark:divide-[#2a3942]">
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
                        <p className="text-[13px] text-muted-foreground mt-0.5">March–June. Pick SAT or ACT from a diagnostic, then prep 8–12 weeks.</p>
                      </div>
                    </div>
                    <div className="p-4 flex gap-4 items-start">
                      <div className="flex flex-col gap-1 shrink-0 mt-0.5">
                        <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-center">SAT</span>
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-center">ACT</span>
                      </div>
                      <div>
                        <p className="font-semibold text-[14px]">Retake · Fall of senior year</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">August–October — before Early deadlines (by December for Regular Decision).</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "resources" && (
                <div>
                  <h2 className="text-xl font-bold mb-4">Key resources</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { title: "Common App", desc: "Apply to 1,000+ colleges in one place", url: "#" },
                      { title: "FAFSA — Federal Student Aid", desc: "Federal grants, loans & work-study", url: "#" },
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
