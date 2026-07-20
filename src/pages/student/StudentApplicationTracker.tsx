import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCollegeProfile } from "@/services/collegeService";
import { ClipboardList, Loader2, CheckCircle2, Circle, Plus } from "lucide-react";
import { cn } from "@/utils/cn";

export function StudentApplicationTracker() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"requirements" | "documents" | "checklists" | "recommendations">("requirements");

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
        <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0">
          <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ClipboardList size={28} /> Application Tracker</h1>
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

        <div className="max-w-[1100px] mx-auto p-6 md:p-10 space-y-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : (
            <>
              {tab === "requirements" && (
                <div>
                  <h2 className="text-[15px] font-bold uppercase tracking-wider mb-4 text-foreground border-b border-[#e9edef] dark:border-[#2a3942] pb-2">Per-school requirements</h2>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {schools.map(s => {
                      const reqs = s.requirements || [];
                      const doneCount = reqs.filter(r => r.is_complete).length;
                      // Standard MVP requirements checklist
                      const standardReqs = ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores", "FAFSA", "CSS Profile"];
                      
                      return (
                        <div key={s.id} className="border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                          <div className="p-4 border-b border-[#e9edef] dark:border-[#2a3942] bg-[#f8fafc] dark:bg-[#1a2730] flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-[16px] font-bold">{s.school_name}</h4>
                              <p className="text-[13px] text-muted-foreground mt-0.5">{s.deadline ? `${s.deadline}` : "RD"}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[13px] font-bold text-[#1099A1]">{doneCount}/{Math.max(reqs.length, 8)}</p>
                            </div>
                          </div>
                          <div className="p-4 space-y-4">
                            <p className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground text-center">
                              {s.status === "accepted" ? (
                                <span className="text-green-600 dark:text-green-500">Accepted 🎉</span>
                              ) : (
                                "— Decision —"
                              )}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2">
                              {standardReqs.map((req, i) => {
                                // Mock completion logic based on the user's snippet
                                let isDone = false;
                                if (s.school_name.includes("Hopkins")) isDone = ["Application", "Essays", "Recs requested", "Transcript", "Test scores"].includes(req);
                                if (s.school_name.includes("Michigan")) isDone = ["Application", "Essays", "Test scores", "FAFSA", "CSS Profile"].includes(req);

                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    {isDone ? (
                                      <CheckCircle2 size={14} className="text-[#1099A1]" />
                                    ) : (
                                      <Circle size={14} className="text-muted-foreground/40" />
                                    )}
                                    <span className={cn("text-[13px]", isDone ? "font-semibold text-foreground" : "text-muted-foreground")}>{req}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {schools.length === 0 && (
                      <p className="text-[14px] text-muted-foreground">Add schools in the College List to see requirements.</p>
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
                    <button className="text-[13px] font-bold text-[#1099A1] flex items-center gap-1"><Plus size={14}/> Add</button>
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
