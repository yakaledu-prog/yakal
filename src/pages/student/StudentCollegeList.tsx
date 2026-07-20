import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCollegeProfile, addSchool, SchoolTier, updateSchool } from "@/services/collegeService";
import { List, Loader2, Plus, ExternalLink, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";

const TIERS: SchoolTier[] = ["dream", "target", "safety"];
const tierLabel = { dream: "Dream / Reach", target: "Target / Match", safety: "Safety" };
const STATUS_LABELS = {
  considering: "To research",
  applying: "In progress",
  submitted: "Submitted",
  waitlisted: "Waitlisted",
  accepted: "Accepted",
  rejected: "Rejected"
};

const field = "w-full bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-sm px-3 py-2 text-[14px] text-[#111] dark:text-white outline-none focus:border-[#1099A1]";
const btnPrimary = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-[#1099A1] text-white text-[13px] font-semibold hover:bg-[#0d848b] transition-colors disabled:opacity-60";

// MVP Mock Data for extra fields
const MOCK_STATS: Record<string, any> = {
  "Johns Hopkins University": { gpa: "3.9 GPA / 1530 SAT", price: "$60,480", essays: 1 },
  "University of Maryland, College Park": { gpa: "4.3 W GPA / 1400 SAT", price: "$11,505", essays: 3 },
  "University of Michigan": { gpa: "—", price: "$70,000", essays: 3 },
  "Towson University": { gpa: "3.5 GPA / 1150 SAT", price: "$10,078", essays: 0 },
};

export function StudentCollegeList() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", user?.id],
    queryFn: () => getCollegeProfile(user!.id),
    enabled: !!user?.id,
  });

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<SchoolTier>("target");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"colleges" | "essays" | "resources">("colleges");

  const add = async () => {
    if (!name.trim() || !user) return toast.error("Enter a school name.");
    setSaving(true);
    const res = await addSchool(user.id, { school_name: name.trim(), tier, deadline: deadline || null });
    setSaving(false);
    if (!res.success) {
      toast.error(res.error || "Error adding school");
    } else {
      toast.success("School added.");
      setName(""); setDeadline(""); setTier("target"); setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["college-profile", user.id] });
    }
  };

  const updateStatus = async (id: string, status: any) => {
    if (!user) return;
    const res = await updateSchool(id, { status });
    if (res.success) qc.invalidateQueries({ queryKey: ["college-profile", user.id] });
  };

  if (!user) return null;

  const schools = data?.schools || [];
  const dreamCount = schools.filter(s => s.tier === "dream").length;
  const targetCount = schools.filter(s => s.tier === "target").length;
  const safetyCount = schools.filter(s => s.tier === "safety").length;

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        {/* Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0">
          <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><List size={28} /> College List</h1>
              <p className="text-white/80 text-[15px] mt-1 mb-6">Research, compare & track every school</p>
            </div>
            
            {/* Stats in Header Bottom Right */}
            <div className="flex gap-6 pb-6 text-[13px] font-semibold text-white/80 text-center">
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{dreamCount}</p>
                <p>Dream</p>
              </div>
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{targetCount}</p>
                <p>Target</p>
              </div>
              <div>
                <p className="text-[22px] text-white font-bold leading-none mb-1">{safetyCount}</p>
                <p>Safety</p>
              </div>
              <div className="pl-6 border-l border-white/20">
                <p className="text-[22px] text-white font-bold leading-none mb-1">{schools.length}</p>
                <p>Total</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="max-w-[1100px] mx-auto flex gap-1 overflow-x-auto">
            {[
              { id: "colleges", label: "Colleges" },
              { id: "essays", label: "Core Essays" },
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
              {tab === "colleges" && (
                <div className="space-y-6">
                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 pb-2 border-b border-[#e9edef] dark:border-[#2a3942]">
                    <button className="px-4 py-2 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] text-[13px] font-semibold hover:bg-muted/50 transition-colors">Compare</button>
                    <button className="px-4 py-2 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] text-[13px] font-semibold hover:bg-muted/50 transition-colors">Export CSV</button>
                    <div className="flex-1"></div>
                    <button className={btnPrimary} onClick={() => setShowAdd(!showAdd)}>
                      <Plus size={15} /> Add a school
                    </button>
                  </div>

                  {showAdd && (
                    <div className="border border-[#e9edef] dark:border-[#2a3942] p-5 bg-[#f8fafc] dark:bg-[#1a2730] space-y-3">
                      <input className={field} placeholder="School name" value={name} onChange={(e) => setName(e.target.value)} />
                      <div className="grid grid-cols-2 gap-3">
                        <select className={field} value={tier} onChange={(e) => setTier(e.target.value as SchoolTier)}>
                          {TIERS.map((t) => <option key={t} value={t}>{tierLabel[t]}</option>)}
                        </select>
                        <input className={field} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button className={btnPrimary} onClick={add} disabled={saving}>
                          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save school
                        </button>
                        <button className="px-3.5 py-2 text-[13px] font-semibold text-[#667781]" onClick={() => setShowAdd(false)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* School List */}
                  <div className="space-y-8">
                    {TIERS.map((t) => {
                      const tierSchools = schools.filter(s => s.tier === t);
                      if (tierSchools.length === 0) return null;
                      
                      return (
                        <div key={t}>
                          <h3 className="text-[14px] font-bold uppercase tracking-wider mb-3 text-foreground border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                            {tierLabel[t]} · {tierSchools.length}
                          </h3>
                          <div className="space-y-4">
                            {tierSchools.map(s => {
                              const mock = MOCK_STATS[s.school_name] || { gpa: "—", price: "—", essays: 0 };
                              return (
                                <div key={s.id} className="border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                                  <div className="p-4 border-b border-[#e9edef] dark:border-[#2a3942] bg-[#f8fafc] dark:bg-[#1a2730] flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div>
                                      <h4 className="text-[16px] font-bold">{s.school_name}</h4>
                                      <p className="text-[13px] text-muted-foreground mt-0.5">{tierLabel[t]}</p>
                                    </div>
                                    <select 
                                      className="text-[13px] font-semibold border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#22313a] px-3 py-1.5 outline-none w-full md:w-auto"
                                      value={s.status}
                                      onChange={(e) => updateStatus(s.id, e.target.value)}
                                    >
                                      {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                                        <option key={val} value={val}>{lbl}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                      <p className="text-[12px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Deadline</p>
                                      <p className="text-[14px] font-medium">{s.deadline ? s.deadline : "RD"}</p>
                                    </div>
                                    <div>
                                      <p className="text-[12px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Avg GPA / SAT</p>
                                      <p className="text-[14px] font-medium">{mock.gpa}</p>
                                    </div>
                                    <div>
                                      <p className="text-[12px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Sticker / yr</p>
                                      <p className="text-[14px] font-medium">{mock.price}</p>
                                    </div>
                                    <div>
                                      <p className="text-[12px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Supp. essays</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[14px] font-medium">{mock.essays}</span>
                                        {mock.essays > 0 && <ChevronRight size={14} className="text-muted-foreground" />}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tab === "essays" && (
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                    <h2 className="text-[15px] font-bold uppercase tracking-wider">Core / personal essays</h2>
                    <button className="text-[13px] font-bold text-[#1099A1]">+ Add</button>
                  </div>
                  <p className="text-[13px] text-muted-foreground mb-4">Your Common App personal statement, activities list and any essay reused across schools.</p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked readOnly className="accent-[#1099A1] w-4 h-4" />
                        <span className="text-[14px] font-semibold">Activities descriptions</span>
                      </div>
                      <button className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                    </div>
                    <div className="flex items-center justify-between p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229]">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked readOnly className="accent-[#1099A1] w-4 h-4" />
                        <span className="text-[14px] font-semibold">Common App personal statement</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <a href="#" className="flex items-center gap-1 text-[13px] font-semibold text-[#1099A1] hover:underline">Open doc <ExternalLink size={12} /></a>
                        <button className="text-[13px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === "resources" && (
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-[#e9edef] dark:border-[#2a3942] pb-2">
                    <h2 className="text-[15px] font-bold uppercase tracking-wider">Research resources</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      { title: "Dream, Target & Safety — how to choose", source: "CollegeVine · the college list decoded" },
                      { title: "Picking your reach & realistic schools", source: "CollegeXpress" },
                      { title: "Dream / Match / Safety framework", source: "Princeton Review" },
                      { title: "Supplemental essay prompt guides", source: "CollegeEssayAdvisors — per-school prompts & tips" },
                      { title: "Scholarship search — BigFuture", source: "College Board · pay for college" },
                      { title: "Free scholarship searches", source: "college-scholarships.com" },
                    ].map((r, i) => (
                      <a key={i} href="#" className="group flex justify-between items-center p-3 border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] hover:bg-muted/30">
                        <div>
                          <p className="text-[14px] font-semibold group-hover:text-[#1099A1] transition-colors">{r.title}</p>
                          <p className="text-[12px] text-muted-foreground mt-0.5">{r.source}</p>
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
