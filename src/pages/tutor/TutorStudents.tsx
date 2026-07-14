import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import {
  Search, Users, Loader2, Mail, GraduationCap, Clock,
  ExternalLink, User
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import {
  getTutorStudents, getStudentDetail, TutorStudent, StudentDetail,
} from "@/services/tutorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { dicebearUrl } from "@/utils/avatar";
import { ChatPane } from "@/components/chat/ChatPane";
import { mockConversations, type Conversation } from "@/mock/chatData";

function fmtDate(d?: string | null) {
  if (!d) return "-";
  const s = d.length > 10 ? d : d + "T00:00:00";
  return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function TutorStudents() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [accepting, setAccepting] = useState(profile?.accepting_students !== false);

  const activeId = id ?? students[0]?.id;
  useSetBreadcrumb(activeId, detail?.profile?.full_name);

  useEffect(() => setAccepting(profile?.accepting_students !== false), [profile?.accepting_students]);

  useEffect(() => {
    if (!user) return;
    getTutorStudents(user.id).then((s) => { setStudents(s); setLoading(false); });
  }, [user]);

  useEffect(() => {
    if (!id && students.length > 0) navigate(`/tutor/students/${students[0].id}`, { replace: true });
  }, [id, students, navigate]);

  useEffect(() => {
    if (!user || !activeId) return;
    setDetail(null);
    getStudentDetail(user.id, activeId).then(setDetail);
  }, [user, activeId]);

  const toggleAccepting = async () => {
    if (!user) return;
    const next = !accepting;
    setAccepting(next);
    const { error } = await supabase.from("profiles").update({ accepting_students: next }).eq("id", user.id);
    if (error) { setAccepting(!next); return toast.error("Couldn't update setting."); }
    await refreshProfile();
    toast.success(next ? "You're accepting new students." : "You're no longer accepting new students.");
  };

  const filtered = useMemo(
    () => students.filter((s) => s.full_name.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  );

  return (
    <div className="students-page flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Left pane */}
      <aside className="students-list w-full md:w-[300px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full">
        {/* Accepting-students toggle */}
        <div className="students-list__accepting flex items-center justify-between gap-3 p-3.5 border-b border-[#e9edef] dark:border-[#2a3942]">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#111] dark:text-white">Accepting new students</p>
            <p className="text-[12px] text-muted-foreground">Families can request you</p>
          </div>
          <button
            role="switch"
            aria-checked={accepting}
            onClick={toggleAccepting}
            className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", accepting ? "bg-primary" : "bg-gray-300 dark:bg-gray-600")}
          >
            <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", accepting ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </div>

        <div className="students-list__search px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students..."
              className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
            />
          </div>
        </div>

        <div className="students-list__items flex-1 md:overflow-y-auto max-h-[34vh] md:max-h-none overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8 px-4">{students.length === 0 ? "No students yet." : "No matches."}</p>
          ) : (
            filtered.map((s) => {
              const active = s.id === activeId;
              return (
                <button key={s.id} onClick={() => navigate(`/tutor/students/${s.id}`)}
                  className={cn("students-list__item w-full flex items-center gap-3 p-3 text-left border-l-2 transition-colors",
                    active ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]")}>
                  <img src={s.avatar_url || dicebearUrl(s.full_name)} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className={cn("text-[14px] font-semibold truncate", active ? "text-primary" : "text-[#111] dark:text-white")}>{s.full_name}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{s.sessionCount} sessions</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right pane: student detail */}
      <section className="student-detail flex-1 min-w-0 md:h-full md:overflow-y-auto p-4 md:p-8">
        {students.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <Users size={48} className="text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No students yet</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Students appear here once they book a session with you.</p>
          </div>
        ) : !detail ? (
          <div className="h-full flex justify-center items-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <StudentDetailView detail={detail} />
        )}
      </section>
    </div>
  );
}

function StudentDetailView({ detail }: { detail: StudentDetail }) {
  const p = detail.profile;
  const { sessions, submissions } = detail;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const upcoming = sessions.filter((s) => s.status === "upcoming").length;
  const reviewed = submissions.filter((s) => s.status === "reviewed").length;

  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "assignments" | "messages">("overview");
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations);
  const activeConv = conversations.find(c => c.contact.id === detail.profile?.id) || conversations[0];

  // Sessions per subject (with completion).
  const bySubject = useMemo(() => {
    const m = new Map<string, { total: number; done: number }>();
    for (const s of sessions) {
      const e = m.get(s.subject) ?? { total: 0, done: 0 };
      e.total++;
      if (s.status === "completed") e.done++;
      m.set(s.subject, e);
    }
    return [...m.entries()].map(([subject, v]) => ({ subject, ...v }));
  }, [sessions]);

  if (!p) return <div className="p-8 text-center text-muted-foreground">Student not found.</div>;

  return (
    <div className={cn("flex flex-col h-full", activeTab !== 'messages' && "pb-10")}>
      {/* Massive Integrated Header with Inline Stats */}
      <div className="bg-[#1099A1] text-white pt-6 px-6 md:pt-8 md:px-8 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 relative overflow-hidden shrink-0">
        {/* Subtle Background Texture/Graph */}
        <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
          <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
        </svg>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{p.full_name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/80 text-[13px] mt-1">
                {p.email && <span className="flex items-center gap-1.5 truncate"><Mail size={13} /> {p.email}</span>}
                {p.grade_level && <span className="flex items-center gap-1.5"><GraduationCap size={13} /> {p.grade_level}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 xl:gap-10 border-t border-white/20 xl:border-t-0 pt-4 xl:pt-0 flex-1 justify-end">
            <div className="flex items-center justify-between xl:justify-end gap-6 sm:gap-12 w-full sm:w-auto">
              <MinimalStat label="Sessions" value={sessions.length} />
              <MinimalStat label="Completed" value={completed} />
              <MinimalStat label="Upcoming" value={upcoming} />
              <MinimalStat label="Submissions" value={`${reviewed}/${submissions.length}`} />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="relative z-10 flex items-center gap-6 mt-8 border-b border-white/20 overflow-x-auto">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" />
          <TabButton active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} label="Sessions" />
          <TabButton active={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')} label="Assignments" />
          <TabButton active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} label="Messages" />
        </div>
      </div>

      <div className={cn("mx-auto flex flex-col", activeTab === 'messages' ? "flex-1 w-[calc(100%+32px)] md:w-[calc(100%+64px)] -mx-4 md:-mx-8 -mb-4 md:-mb-8 mt-[-32px]" : "w-full max-w-4xl")}>
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Top Row: Next Session & Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-border/60 rounded-none p-5 flex flex-col justify-between bg-white dark:bg-[#111b21]">
                <div>
                  <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Next Session</h3>
                  {upcoming > 0 ? (
                    <div>
                      <p className="text-[18px] font-bold text-foreground">Tomorrow, 10:00 AM</p>
                      <p className="text-[14px] text-muted-foreground mt-1 font-medium">Mathematics • Online</p>
                    </div>
                  ) : (
                    <p className="text-[14px] text-muted-foreground">No upcoming sessions scheduled.</p>
                  )}
                </div>
                {upcoming > 0 && (
                  <div className="mt-6 flex gap-3">
                    <Button className="rounded-none bg-[#1099A1] hover:bg-[#0d848b] text-white h-9 px-5 font-bold text-[13px] border-0">Join Call</Button>
                    <Button variant="outline" className="rounded-none h-9 px-5 font-bold text-[13px] border-border/60 hover:bg-muted/10">Reschedule</Button>
                  </div>
                )}
              </div>

              <div className="border border-border/60 rounded-none p-5 bg-white dark:bg-[#111b21]">
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Performance Overview</h3>
                {bySubject.length > 0 ? (
                  <div className="space-y-5">
                    {bySubject.map((s) => (
                      <div key={s.subject}>
                        <div className="flex items-center justify-between text-[13px] mb-2">
                          <span className="font-bold text-foreground">{s.subject}</span>
                          <span className="text-muted-foreground font-medium">{s.done}/{s.total} completed</span>
                        </div>
                        <div className="h-1.5 bg-muted">
                          <div className="h-full bg-[#1099A1]" style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-muted-foreground">No subjects tracked yet.</p>
                )}
              </div>
            </div>

            {/* Bottom Row: Recent Activity & Private Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="border border-border/60 rounded-none p-5 bg-white dark:bg-[#111b21]">
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Recent Sessions</h3>
                {sessions.filter(s => s.status === 'completed').length > 0 ? (
                  <div className="space-y-0">
                    {sessions.filter(s => s.status === 'completed').slice(0,3).map(s => (
                       <div key={s.id} className="flex justify-between items-start border-b border-border/40 py-3 last:border-0 last:pb-0 first:pt-0">
                         <div>
                           <p className="text-[14px] font-bold text-foreground leading-tight">{s.subject}</p>
                           <p className="text-[12px] text-muted-foreground mt-1 font-medium">{new Date(s.date).toLocaleDateString()} • {s.start_time}</p>
                         </div>
                         <Button variant="link" className="text-[#1099A1] p-0 h-auto text-[12px] font-bold underline-offset-2 hover:underline">View Notes</Button>
                       </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-muted-foreground">No completed sessions yet.</p>
                )}
               </div>

               <div className="border border-border/60 rounded-none p-5 flex flex-col bg-[#fdfdfd] dark:bg-[#182329]">
                <h3 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Private Tutor Notes</h3>
                <textarea 
                  className="w-full flex-1 min-h-[140px] bg-transparent border-0 resize-none outline-none text-[14px] font-medium text-foreground placeholder:text-muted-foreground leading-relaxed"
                  placeholder="Keep your private notes about this student's progress, strengths, and areas for improvement here..."
                />
               </div>
            </div>
            
            {p.subjects && p.subjects.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-2">
                <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><User size={14} /> Interests:</span>
                {p.subjects.map((sub) => <span key={sub} className="text-[11px] font-bold border border-border/60 rounded-none text-foreground px-2 py-1">{sub}</span>)}
              </div>
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-2">
              <h3 className="text-[16px] font-semibold text-foreground">Session History</h3>
            </div>
            {sessions.length === 0 ? <p className="text-[14px] text-muted-foreground py-4">No sessions yet.</p> : (
              <div className="space-y-0">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-4 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-default">
                    <div className="min-w-0">
                      <p className="font-medium text-[15px] text-foreground truncate">{s.subject}</p>
                      <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-0.5"><Clock size={13} /> {fmtDate(s.date)} · {fmtTime(s.start_time)}</p>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2 py-1 rounded-full capitalize shrink-0",
                      s.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        s.status === "upcoming" ? "bg-[#1099A1]/10 text-[#1099A1]" : "bg-red-100 text-red-600 dark:bg-red-900/20")}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-2">
              <h3 className="text-[16px] font-semibold text-foreground">Submissions</h3>
            </div>
            {submissions.length === 0 ? <p className="text-[14px] text-muted-foreground py-4">No submissions yet.</p> : (
              <div className="space-y-0">
                {submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-4 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-default">
                    <div className="min-w-0">
                      <p className="font-medium text-[15px] text-foreground truncate">{s.assignment_title}</p>
                      <p className="text-[13px] text-muted-foreground flex items-center gap-3 mt-0.5">
                        <span>{fmtDate(s.submitted_at)}</span>
                        {s.drive_url && <a href={s.drive_url} target="_blank" rel="noreferrer" className="text-[#1099A1] flex items-center gap-1 hover:underline"><ExternalLink size={11} /> Open</a>}
                      </p>
                    </div>
                    <span className={cn("text-[11px] font-bold px-2 py-1 rounded-full capitalize shrink-0",
                      s.status === "reviewed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        s.status === "revision_needed" ? "bg-red-100 text-red-600 dark:bg-red-900/20" : "bg-[#1099A1]/10 text-[#1099A1]")}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex-1 flex flex-col min-h-[600px] bg-white dark:bg-[#111b21]">
            <ChatPane
              activeConv={activeConv}
              setConversations={setConversations}
              showHeader={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MinimalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-2.5">{label}</p>
      <p className="text-2xl font-bold leading-none">{value}</p>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("pb-3 px-1 text-[14px] font-medium transition-colors border-b-2 relative top-[1px] whitespace-nowrap outline-none",
        active ? "text-white border-white" : "text-white/60 border-transparent hover:text-white/90 hover:border-white/30")}
    >
      {label}
    </button>
  );
}
