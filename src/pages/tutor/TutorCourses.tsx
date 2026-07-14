import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import {
  BookOpen, Users, Clock, Loader2, CalendarClock, Search, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorCourses, getCourseWorkspace, CourseWorkspace } from "@/services/tutorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";

import { stripHtml } from "@/components/ui/RichTextEditor";
import { dicebearUrl } from "@/utils/avatar";


interface CourseLite { id: string; title: string; subject: string; thumbnail_url: string | null }

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function TutorCourses() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [ws, setWs] = useState<CourseWorkspace | null>(null);

  const [query, setQuery] = useState("");

  const activeId = id ?? courses[0]?.id;
  useSetBreadcrumb(activeId, ws?.course?.title);

  useEffect(() => {
    if (!user) return;
    getTutorCourses(user.id).then((c) => {
      setCourses(c.map((x: any) => ({ id: x.id, title: x.title, subject: x.subject, thumbnail_url: x.thumbnail_url })));
      setLoadingCourses(false);
    });
  }, [user]);

  useEffect(() => {
    if (!id && courses.length > 0) navigate(`/tutor/courses/${courses[0].id}`, { replace: true });
  }, [id, courses, navigate]);

  useEffect(() => {
    if (!user || !activeId) return;
    setWs(null);
    getCourseWorkspace(activeId, user.id).then(setWs);
  }, [user, activeId]);

  const filtered = useMemo(
    () => courses.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()) || c.subject.toLowerCase().includes(query.toLowerCase())),
    [courses, query]
  );

  return (
    <div className="course-page flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Left pane: search + course list */}
      <aside className="course-list w-full md:w-[300px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full">
        {/* Search bar */}
        <div className="px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses..."
              className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
            />
          </div>
        </div>
        <div className="course-list__items flex-1 md:overflow-y-auto max-h-[38vh] md:max-h-none overflow-y-auto">
          {loadingCourses ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8 px-4">{courses.length === 0 ? "No courses assigned yet." : "No matches."}</p>
          ) : (
            filtered.map((c) => {
              const active = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/tutor/courses/${c.id}`)}
                  className={cn(
                    "course-list__item w-full flex items-center gap-3 p-3 text-left border-l-2 transition-colors",
                    active ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]"
                  )}
                >
                  {c.thumbnail_url
                    ? <img src={c.thumbnail_url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                    : <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><BookOpen size={18} className="text-primary" /></div>}
                  <div className="min-w-0">
                    <p className={cn("text-[14px] font-semibold truncate", active ? "text-primary" : "text-[#111] dark:text-white")}>{c.title}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{c.subject}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right pane: course detail */}
      <section className="course-detail flex-1 min-w-0 md:h-full md:overflow-y-auto p-4 md:p-8">
        {courses.length === 0 && !loadingCourses ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <BookOpen size={48} className="text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No courses yet</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">The admin hasn't assigned any courses to you.</p>
          </div>
        ) : !ws ? (
          <div className="h-full flex justify-center items-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : !ws.course ? (
          <div className="p-8 text-center text-muted-foreground">Course not found.</div>
        ) : (
          <CourseDetail ws={ws} navigate={navigate} />
        )}
      </section>
    </div>
  );
}

function CourseDetail({ ws, navigate }: { ws: CourseWorkspace; navigate: (p: string) => void }) {
  const { course, students, sessions, assignments } = ws;

  return (
    <div className="space-y-10 pb-10">
      <div className="course-banner rounded-none md:rounded-2xl overflow-hidden border border-[#e9edef] dark:border-[#2a3942]">
        <div className="relative h-48 bg-[#1099A1]/10 dark:bg-[#111b21]">
          {course.thumbnail_url
            ? <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><BookOpen size={48} className="text-[#1099A1]/50" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <span className="text-[12px] font-bold bg-[#1099A1] text-white px-3 py-1 rounded-sm uppercase tracking-wider">{course.subject}</span>
            <h1 className="text-3xl font-bold text-white mt-3 tracking-tight">{course.title}</h1>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Students" value={students.length} />
        <MiniStat label="Sessions" value={sessions.length} />
        <MiniStat label="Assignments" value={assignments.length} />
      </div>

      {/* Sessions Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[#111] dark:text-white border-b border-[#e9edef] dark:border-[#2a3942] pb-2">Upcoming Sessions</h2>
        {sessions.length === 0 ? <EmptyMsg text="No sessions for this course yet." /> :
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-transparent border-b border-[#e9edef] dark:border-[#2a3942] py-4 last:border-0 hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors -mx-4 px-4">
                <img src={s.student_avatar || dicebearUrl(s.student_name || "S")} alt="" className="w-12 h-12 rounded-none object-cover shrink-0 bg-[#e9edef] dark:bg-[#2a3942]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-[15px] font-bold text-[#111] dark:text-white">{s.subject}</h3>
                    <Badge variant={s.status === "completed" ? "success" : s.status === "cancelled" || s.status === "no-show" ? "destructive" : "secondary"}
                      className="rounded-none text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">{s.status}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-[13px] text-[#54656f] dark:text-[#aebac1]">
                    <span className="font-semibold text-[#111] dark:text-[#e9edef] flex items-center gap-1.5"><Users size={14} className="text-[#1099A1]"/> {s.student_name}</span>
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-[#1099A1]" />{fmtDate(s.date)}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-[#1099A1]" />{fmtTime(s.start_time)} ({s.duration_minutes} min)</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      {/* Assignments Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[#111] dark:text-white border-b border-[#e9edef] dark:border-[#2a3942] pb-2">Assignments</h2>
        {assignments.length === 0 ? <EmptyMsg text="No assignments for this course yet." /> :
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments.map((a) => {
              const pending = (a.submissionCount ?? 0) - (a.reviewedCount ?? 0);
              return (
                <button key={a.id} onClick={() => navigate(`/tutor/assignments/${a.id}`)}
                  className="text-left bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-none p-5 hover:border-[#1099A1] transition-colors group">
                  <h3 className="text-[16px] font-bold text-[#111] dark:text-white mb-2 group-hover:text-[#1099A1] transition-colors">{a.title}</h3>
                  {a.description && <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] line-clamp-2 mb-4">{stripHtml(a.description)}</p>}
                  <div className="flex items-center justify-between text-[12px] text-[#54656f] dark:text-[#aebac1] pt-3 border-t border-[#e9edef] dark:border-[#2a3942]">
                    <span className="flex items-center gap-1.5 font-medium"><CalendarClock size={14} className="text-[#1099A1]" /> {a.due_date ? new Date(a.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No due date"}</span>
                    <div className="flex items-center gap-3">
                      <span>{a.submissionCount} submissions</span>
                      {pending > 0 && <span className="text-[#CAA25F] font-bold uppercase tracking-wider">{pending} to review</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mini-stat rounded-none border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] p-4 flex flex-col items-center justify-center">
      <p className="text-3xl font-bold text-[#1099A1]">{value}</p>
      <p className="text-[11px] font-bold text-[#54656f] dark:text-[#aebac1] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
function EmptyMsg({ text }: { text: string }) {
  return <div className="text-center py-10 text-[14px] text-muted-foreground border-b border-dashed border-[#e9edef] dark:border-[#2a3942]">{text}</div>;
}

