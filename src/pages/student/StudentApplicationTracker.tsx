import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCollegeProfile, updateSchool } from "@/services/collegeService";
import { ClipboardList, Loader2, CheckCircle2, Circle, Plus, ChevronDown, Check } from "lucide-react";
import { cn } from "@/utils/cn";

export function StudentApplicationTracker() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"requirements" | "documents" | "checklists" | "recommendations">("requirements");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [localReqs, setLocalReqs] = useState<Record<string, string[]>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", user?.id],
    queryFn: () => getCollegeProfile(user!.id),
    enabled: !!user?.id,
  });

  if (!user) return null;

  const schools = data?.schools || [];
  const submittedCount = schools.filter(s => s.status === "submitted").length;
  const acceptedCount = schools.filter(s => s.status === "accepted").length;

  const essays = data?.essays || [];
  const tasks = data?.tasks || [];

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
          <div className="relative z-10 max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">Application Tracker</h1>
              <p className="text-white/80 text-[15px] mt-1 mb-6">Every school, every requirement</p>
            </div>

            {/* Stats in Header Bottom Right */}
            <div className="flex gap-6 pb-6 text-[13px] font-semibold text-white/80 text-center">
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{schools.length}</p>
                <p>Schools</p>
              </div>
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{submittedCount}</p>
                <p>Submitted</p>
              </div>
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{acceptedCount}</p>
                <p>Accepted</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-[1100px] mx-auto flex gap-1 overflow-x-auto">
            {[
              { id: "requirements", label: "Requirements" },
              { id: "documents", label: "Documents" },
              { id: "checklists", label: "Checklists" },
              { id: "recommendations", label: "Recommendations" }
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

        <div className="mx-auto p-6 md:p-10 md:pt-2 space-y-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : (
            <>
              {tab === "requirements" && (
                <div>
                  <div className="flex flex-col gap-6 mt-4">
                    {schools.map(s => {
                      const reqs = s.requirements || [];
                      const standardReqs = ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores", "FAFSA", "CSS Profile"];

                      const toggleReq = (schoolId: string, schoolName: string, req: string) => {
                        setLocalReqs(prev => {
                          let current = prev[schoolId];
                          if (!current) {
                            current = standardReqs.filter(r => {
                              if (schoolName.includes("Hopkins")) return ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores"].includes(r);
                              if (schoolName.includes("Maryland")) return false;
                              if (schoolName.includes("Michigan")) return ["Application", "Essays", "Test scores", "FAFSA", "CSS Profile"].includes(r);
                              return false;
                            });
                          }
                          if (current.includes(req)) {
                            return { ...prev, [schoolId]: current.filter(r => r !== req) };
                          }
                          return { ...prev, [schoolId]: [...current, req] };
                        });
                      };

                      const schoolReqs = localReqs[s.id] || standardReqs.filter(r => {
                        if (s.school_name.includes("Hopkins")) return ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores"].includes(r);
                        if (s.school_name.includes("Maryland")) return false;
                        if (s.school_name.includes("Michigan")) return ["Application", "Essays", "Test scores", "FAFSA", "CSS Profile"].includes(r);
                        return false;
                      });

                      const mockDoneCount = schoolReqs.length;

                      return (
                        <div key={s.id} className="border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] rounded-lg p-6">
                          {/* Top Row */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <h3 className="font-bold text-[18px] text-[#111] dark:text-white leading-tight">{s.school_name}</h3>
                              <span className="text-[14px] text-[#8696a0] font-medium">EA • {s.deadline ? s.deadline : "2026-11-01"}</span>
                            </div>

                            <div className="flex items-center gap-3 self-end md:self-auto">
                              <span className="text-[14px] font-bold text-[#54656f]">{mockDoneCount}/{Math.max(reqs.length, 8)}</span>

                              <div className="relative">
                                <button
                                  onClick={() => setOpenDropdownId(openDropdownId === s.id ? null : s.id)}
                                  className={cn(
                                    "bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-full px-3 py-1.5 text-[13px] font-semibold flex items-center gap-1.5 hover:bg-[#f8f9fa] dark:hover:bg-[#2a3942] transition-colors",
                                    s.status === "accepted" ? "text-[#97CE9D]" :
                                      s.status === "waitlisted" ? "text-[#CAA25F]" :
                                        s.status === "denied" ? "text-[#697780]" :
                                          s.status === "enrolled" ? "text-[#1099A1]" : "text-[#54656f]"
                                  )}
                                >
                                  {s.status === "accepted" ? "Accepted 🎉" :
                                    s.status === "waitlisted" ? "Waitlisted" :
                                      s.status === "denied" ? "Denied" :
                                        s.status === "enrolled" ? "Enrolled 🎓" :
                                          "Decision"}
                                  <ChevronDown size={14} className={cn("transition-transform opacity-50 ml-1", openDropdownId === s.id && "rotate-180")} />
                                </button>

                                {openDropdownId === s.id && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                                    <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-[#202c33] rounded-[12px] shadow-xl overflow-hidden z-50 text-black dark:text-white py-1 border border-[#e9edef] dark:border-[#2a3942]">
                                      {["accepted", "waitlisted", "denied", "enrolled"].map((status) => (
                                        <button
                                          key={status}
                                          onClick={async () => {
                                            await updateSchool(s.id, { status: status as any });
                                            qc.invalidateQueries({ queryKey: ["college-profile", user.id] });
                                            setOpenDropdownId(null);
                                          }}
                                          className={cn(
                                            "block w-full text-left px-4 py-2.5 text-[13px] font-bold capitalize transition-colors hover:bg-[#f8f9fa] dark:hover:bg-[#2a3942]",
                                            status === "accepted" ? "text-[#97CE9D]" :
                                              status === "waitlisted" ? "text-[#CAA25F]" :
                                                status === "denied" ? "text-[#697780]" :
                                                  status === "enrolled" ? "text-[#1099A1]" : "text-foreground"
                                          )}
                                        >
                                          {status}
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress bar */}

                          <div className={`${mockDoneCount > 0 ? 'scale-y-100' : 'scale-y-0'} transition ease-in-out duration-300 origin-left`}>
                            <div className={`h-2.5 w-full bg-[#f8f9fa] dark:bg-[#202c33] rounded-full overflow-hidden border border-[#e9edef] dark:border-[#2a3942]`}>
                              <div className="h-full bg-[#1099A1] rounded-full transition-all duration-500 ease-out" style={{ width: `${(mockDoneCount / Math.max(reqs.length, 8)) * 100}%` }} />
                            </div>
                            <div className={`${mockDoneCount > 0 ? 'h-5' : 'h-0'}`} />
                          </div>

                          {/* Pills */}
                          <div className="w-full flex items-center justify-start flex-wrap gap-2.5">
                            {standardReqs.map((req, i) => {
                              const isDone = schoolReqs.includes(req);

                              return isDone ? (
                                <button key={i} onClick={() => toggleReq(s.id, s.school_name, req)} className="bg-[#1099A1] text-white px-3.5 py-1.5 rounded-full text-[13px] flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity">
                                  <Check size={14} strokeWidth={3} /> {req}
                                </button>
                              ) : (
                                <button key={i} onClick={() => toggleReq(s.id, s.school_name, req)} className="bg-[#f8f9fa] dark:bg-[#202c33] text-[#8696a0] border border-[#e9edef] dark:border-[#2a3942] px-3.5 py-1.5 rounded-full text-[13px] hover:bg-[#e9edef] dark:hover:bg-[#2a3942] transition-colors">
                                  {req}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {schools.length === 0 && (
                      <p className="text-[14px] text-muted-foreground text-center py-10">Add schools in the College List to see requirements.</p>
                    )}
                  </div>
                </div>
              )}

              {tab === "documents" && (
                <div>
                  <h2 className="text-[15px] font-bold uppercase tracking-wider mb-2 text-foreground border-b border-[#e9edef] dark:border-[#2a3942] pb-2">Academics & documents</h2>
                  <p className="text-[14px] text-muted-foreground mb-4">Test scores and transcript colleges will see</p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button className="flex items-center gap-2 px-4 py-2.5 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] hover:bg-muted/50 text-[14px] font-semibold transition-colors">
                      <span className="opacity-50">📄</span> Transcript ↗
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] hover:bg-muted/50 text-[14px] font-semibold transition-colors">
                      <span className="opacity-50">📁</span> Drive folder ↗
                    </button>
                    <div className="flex-1"></div>
                    <button className="px-4 py-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                  </div>
                </div>
              )}

              {tab === "checklists" && (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Essays Checklist */}
                  <div>
                    <h2 className="text-[15px] font-bold uppercase tracking-wider mb-4 text-foreground border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                      Essays · {essays.filter(e => e.status === "done").length}/{essays.length || 3}
                    </h2>
                    <div className="space-y-3">
                      {/* Mock MVP data as requested */}
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={16} className="text-[#1099A1]" />
                          <span className="text-[14px] font-semibold">Activities descriptions</span>
                        </div>
                        <span className="text-[12px] font-bold text-muted-foreground">Complete</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 size={16} className="text-[#1099A1]" />
                          <span className="text-[14px] font-semibold">Common App personal statement</span>
                        </div>
                        <span className="text-[12px] font-bold text-muted-foreground">Complete</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">JHU "why us" supplement</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                    </div>
                  </div>

                  {/* To-Do */}
                  <div>
                    <h2 className="text-[15px] font-bold uppercase tracking-wider mb-4 text-foreground border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                      To-do · {tasks.filter(t => t.status === "done").length}/{tasks.length || 3}
                    </h2>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">Request recommendation letters</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">Finalize school list</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                      <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                        <div className="flex items-center gap-3">
                          <Circle size={16} className="text-muted-foreground/40" />
                          <span className="text-[14px] font-semibold">Submit FAFSA</span>
                        </div>
                        <span className="text-[12px] font-bold text-[#CAA25F]">In progress</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "recommendations" && (
                <div>
                  <div className="flex items-center justify-between mb-2 border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                    <h2 className="text-[15px] font-bold uppercase tracking-wider text-foreground">Recommendation letters</h2>
                    <button className="text-[13px] font-bold text-[#1099A1] flex items-center gap-1"><Plus size={14} /> Add</button>
                  </div>
                  <p className="text-[14px] text-muted-foreground mb-4">Recommenders and where each letter lives in Google Drive</p>

                  <div className="border border-[#e9edef] dark:border-[#2a3942] border-dashed p-6 text-center bg-[#f8fafc] dark:bg-[#1a2730]">
                    <p className="text-[14px] text-muted-foreground mb-2">Add each teacher or counselor writing a letter, then drop the signed letter in the student’s Drive folder and paste its link.</p>
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
