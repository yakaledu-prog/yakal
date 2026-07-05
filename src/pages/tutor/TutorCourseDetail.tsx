import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { cn } from "@/utils/cn";
import {
  ArrowLeft, BookOpen, Users, CalendarDays, ClipboardList, Clock, Loader2, CalendarClock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseWorkspace, CourseWorkspace } from "@/services/tutorService";
import { stripHtml } from "@/components/ui/RichTextEditor";
import { dicebearUrl } from "@/utils/avatar";

type Tab = "overview" | "students" | "sessions" | "assignments";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function fmtTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function TutorCourseDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ws, setWs] = useState<CourseWorkspace | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (!user) return;
    getCourseWorkspace(id, user.id).then(setWs);
  }, [id, user]);

  if (!ws) return <PageWrapper><div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div></PageWrapper>;
  if (!ws.course) return <PageWrapper><div className="p-8 text-center text-muted-foreground">Course not found.</div></PageWrapper>;

  const { course, students, sessions, assignments } = ws;
  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "overview", label: "Overview", icon: <BookOpen size={16} /> },
    { id: "students", label: "Students", icon: <Users size={16} />, count: students.length },
    { id: "sessions", label: "Sessions", icon: <CalendarDays size={16} />, count: sessions.length },
    { id: "assignments", label: "Assignments", icon: <ClipboardList size={16} />, count: assignments.length },
  ];

  return (
    <PageWrapper>
      <div className="course-detail mx-auto w-full max-w-4xl p-4 md:p-8">
        <button onClick={() => navigate("/tutor/courses")} className="flex items-center gap-1.5 text-[14px] text-muted-foreground hover:text-foreground mb-5">
          <ArrowLeft size={16} /> Back to courses
        </button>

        {/* Banner */}
        <div className="course-detail__banner rounded-2xl overflow-hidden border border-[#e9edef] dark:border-[#2a3942] mb-6">
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

        {/* Tabs */}
        <div className="course-detail__tabs flex gap-1 border-b border-[#e9edef] dark:border-[#2a3942] mb-6 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "course-tab flex items-center gap-2 px-4 py-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.icon}{t.label}
              {t.count !== undefined && <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Panels */}
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
      </div>
    </PageWrapper>
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
