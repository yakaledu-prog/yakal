import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import {
  BookOpen, Users, CalendarDays, ClipboardList, Clock, Loader2, CalendarClock, Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorCourses, getCourseWorkspace, CourseWorkspace } from "@/services/tutorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { stripHtml } from "@/components/ui/RichTextEditor";
import { dicebearUrl } from "@/utils/avatar";

type Tab = "overview" | "students" | "sessions" | "assignments";
interface CourseLite { id: string; title: string; subject: string; thumbnail_url: string | null }

function fmtDate(d?: string | null) {
  if (!d) return "—";
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
  const [tab, setTab] = useState<Tab>("overview");
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
        <div className="course-list__search p-3 border-b border-[#e9edef] dark:border-[#2a3942]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-[#aebac1]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#f8f9fa] dark:bg-[#182329] border border-transparent focus:border-primary focus:outline-none text-[14px] text-[#111] dark:text-white"
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
          <CourseDetail ws={ws} tab={tab} setTab={setTab} navigate={navigate} />
        )}
      </section>
    </div>
  );
}

function CourseDetail({ ws, tab, setTab, navigate }: { ws: CourseWorkspace; tab: Tab; setTab: (t: Tab) => void; navigate: (p: string) => void }) {
  const { course, students, sessions, assignments } = ws;
  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview", icon: <BookOpen size={16} /> },
    { id: "students", label: "Students", icon: <Users size={16} />, count: students.length },
    { id: "sessions", label: "Sessions", icon: <CalendarDays size={16} />, count: sessions.length },
    { id: "assignments", label: "Assignments", icon: <ClipboardList size={16} />, count: assignments.length },
  ];

  return (
    <>
      <div className="course-banner rounded-2xl overflow-hidden border border-[#e9edef] dark:border-[#2a3942] mb-6">
        <div className="relative h-40 bg-[#f0f2f5] dark:bg-[#182329]">
          {course.thumbnail_url
            ? <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"><BookOpen size={40} className="text-[#aebac1]" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <span className="text-[11px] font-semibold bg-primary text-white px-2.5 py-1 rounded-full">{course.subject}</span>
            <h1 className="text-2xl font-bold text-white mt-2">{course.title}</h1>
          </div>
        </div>
      </div>

      <div className="course-tabs flex gap-1 border-b border-[#e9edef] dark:border-[#2a3942] mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("course-tab flex items-center gap-2 px-4 py-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.icon}{t.label}
            {t.count !== undefined && <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="course-panel space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <MiniStat label="Students" value={students.length} />
            <MiniStat label="Sessions" value={sessions.length} />
            <MiniStat label="Assignments" value={assignments.length} />
          </div>
          {course.description && (
            <div className="rounded-2xl border bg-card dark:bg-[#182329] p-6">
              <h3 className="text-[15px] font-bold mb-2">About this course</h3>
              <p className="text-[14px] text-muted-foreground leading-relaxed">{course.description}</p>
            </div>
          )}
        </div>
      )}

      {tab === "students" && (
        <div className="course-panel grid grid-cols-1 sm:grid-cols-2 gap-4">
          {students.length === 0 ? <EmptyMsg text="No students enrolled via sessions yet." /> :
            students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border bg-card dark:bg-[#182329] p-4">
                <img src={s.avatar_url || dicebearUrl(s.full_name)} alt="" className="w-11 h-11 rounded-full object-cover" />
                <div className="min-w-0">
                  <p className="font-semibold text-[14px] truncate">{s.full_name}</p>
                  <p className="text-[12px] text-muted-foreground">{s.sessionCount} sessions · last {fmtDate(s.lastDate)}</p>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === "sessions" && (
        <div className="course-panel space-y-3">
          {sessions.length === 0 ? <EmptyMsg text="No sessions for this course yet." /> :
            sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border bg-card dark:bg-[#182329] p-4">
                <div>
                  <p className="font-semibold text-[14px]">{s.student_name}</p>
                  <p className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Clock size={12} /> {fmtDate(s.date)} · {fmtTime(s.start_time)}</p>
                </div>
                <span className={cn("text-[11px] font-bold px-2 py-1 rounded-full capitalize",
                  s.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                  s.status === "upcoming" ? "bg-primary/10 text-primary" : "bg-red-100 text-red-600 dark:bg-red-900/20")}>
                  {s.status}
                </span>
              </div>
            ))}
        </div>
      )}

      {tab === "assignments" && (
        <div className="course-panel space-y-3">
          {assignments.length === 0 ? <EmptyMsg text="No assignments for this course yet." /> :
            assignments.map((a) => (
              <button key={a.id} onClick={() => navigate(`/tutor/assignments/${a.id}`)}
                className="w-full text-left rounded-xl border bg-card dark:bg-[#182329] p-4 hover:border-primary/40 transition-colors">
                <p className="font-semibold text-[14px]">{a.title}</p>
                {a.description && <p className="text-[12px] text-muted-foreground line-clamp-1 mt-0.5">{stripHtml(a.description)}</p>}
                <p className="text-[12px] text-muted-foreground mt-1.5 flex items-center gap-1.5"><CalendarClock size={12} /> {a.submissionCount} submitted</p>
              </button>
            ))}
        </div>
      )}
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="mini-stat rounded-xl border bg-card dark:bg-[#182329] p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[12px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
function EmptyMsg({ text }: { text: string }) {
  return <div className="col-span-full text-center py-12 text-[14px] text-muted-foreground rounded-xl border border-dashed border-[#e9edef] dark:border-[#2a3942]">{text}</div>;
}
