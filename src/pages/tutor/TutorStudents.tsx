import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import {
  Search, Users, Loader2, MessageSquare, Mail, GraduationCap, Calendar, Clock,
  CheckCircle2, ClipboardList, ExternalLink, User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getTutorStudents, getStudentDetail, TutorStudent, StudentDetail,
} from "@/services/tutorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { dicebearUrl } from "@/utils/avatar";

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

        <div className="students-list__search p-3 border-b border-[#e9edef] dark:border-[#2a3942]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-[#aebac1]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#f8f9fa] dark:bg-[#182329] border border-transparent focus:border-primary focus:outline-none text-[14px] text-[#111] dark:text-white" />
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
          <StudentDetailView detail={detail} onMessage={() => navigate(`/tutor/messages?to=${activeId}`)} />
        )}
      </section>
    </div>
  );
}

function StudentDetailView({ detail, onMessage }: { detail: StudentDetail; onMessage: () => void }) {
  const p = detail.profile;
  const { sessions, submissions } = detail;
  const completed = sessions.filter((s) => s.status === "completed").length;
  const upcoming = sessions.filter((s) => s.status === "upcoming").length;
  const reviewed = submissions.filter((s) => s.status === "reviewed").length;

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
    <div className="pb-10">
      {/* Massive Integrated Header */}
      <div className="bg-[#1099A1] text-white p-6 md:p-8 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 relative">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-center gap-5 min-w-0">
            <img src={p.avatar_url || dicebearUrl(p.full_name)} alt={p.full_name} className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover shadow-sm bg-white" />
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{p.full_name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/80 text-[14px] mt-1.5">
                {p.email && <span className="flex items-center gap-1.5 truncate"><Mail size={14} /> {p.email}</span>}
                {p.grade_level && <span className="flex items-center gap-1.5"><GraduationCap size={14} /> {p.grade_level}</span>}
              </div>
            </div>
          </div>
          <button onClick={onMessage} className="shrink-0 flex items-center gap-2 bg-black/10 hover:bg-black/20 text-white px-4 py-2 rounded-lg transition-colors font-medium text-[14px]">
            <MessageSquare size={16} /> Message
          </button>
        </div>

        {/* Integrated Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 mt-6 border-t border-white/20">
          <IntegratedStat label="Total Sessions" value={sessions.length} />
          <IntegratedStat label="Completed" value={completed} />
          <IntegratedStat label="Upcoming" value={upcoming} />
          <IntegratedStat label="Submissions" value={`${reviewed}/${submissions.length}`} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-12">
        {/* By subject */}
        {bySubject.length > 0 && (
          <div>
            <h3 className="text-[18px] font-semibold text-foreground mb-4">Progress by subject</h3>
            <div className="space-y-4">
              {bySubject.map((s) => (
                <div key={s.subject}>
                  <div className="flex items-center justify-between text-[14px] mb-2">
                    <span className="font-medium text-foreground">{s.subject}</span>
                    <span className="text-muted-foreground">{s.done}/{s.total} completed</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-[#1099A1]" style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          {/* Recent sessions */}
          <div>
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-2">
              <h3 className="text-[18px] font-semibold text-foreground">Recent sessions</h3>
            </div>
            {sessions.length === 0 ? <p className="text-[14px] text-muted-foreground py-4">No sessions yet.</p> : (
              <div className="space-y-0">
                {sessions.slice(0, 6).map((s) => (
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

          {/* Submissions */}
          <div>
            <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-2">
              <h3 className="text-[18px] font-semibold text-foreground">Assignment submissions</h3>
            </div>
            {submissions.length === 0 ? <p className="text-[14px] text-muted-foreground py-4">No submissions yet.</p> : (
              <div className="space-y-0">
                {submissions.slice(0, 6).map((s) => (
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
        </div>

        {p.subjects && p.subjects.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-border/50">
            <span className="text-[13px] text-muted-foreground flex items-center gap-1.5"><User size={13} /> Interests:</span>
            {p.subjects.map((sub) => <span key={sub} className="text-[11px] font-medium bg-[#1099A1]/10 text-[#1099A1] px-2 py-1 rounded-full">{sub}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function IntegratedStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
