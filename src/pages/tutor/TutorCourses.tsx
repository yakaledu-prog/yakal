import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import {
  BookOpen, Users, Clock, Loader2, CalendarClock, Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorCourses, getCourseWorkspace, CourseWorkspace } from "@/services/tutorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";


interface CourseLite { id: string; title: string; subject: string; thumbnail_url: string | null }

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
    <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
      {/* Massive Integrated Header */}
      <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0 md:pb-0 relative overflow-hidden shrink-0">
        <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
          <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
        </svg>

        <div className="max-w-[1440px] mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">My Courses</h1>
              <p className="text-white/80 text-[14px]">Manage your course materials, students, and sessions.</p>
            </div>
            {/* Search courses input in header (Optional but good) */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a course..."
                className="w-[200px] h-10 pl-9 pr-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:bg-white/20 transition-colors text-[14px]"
              />
            </div>
          </div>

          {/* Course Tabs */}
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar relative z-10">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/tutor/courses/${c.id}`)}
                className={cn(
                  "pb-4 px-2 text-[15px] font-semibold transition-colors relative whitespace-nowrap",
                  activeId === c.id ? "text-white" : "text-white/60 hover:text-white"
                )}
              >
                {c.title}
                {activeId === c.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />
                )}
              </button>
            ))}
            {filtered.length === 0 && (
               <p className="pb-4 px-2 text-[14px] text-white/60">No matching courses found.</p>
            )}
          </div>

          {/* Stats Row for Active Course */}
          {ws && (
            <div className="grid grid-cols-3 gap-6 pt-6 pb-6 border-t border-white/20">
              <div>
                <div className="inline-flex flex-col items-center">
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><Users size={14} /> Students</p>
                  <p className="text-3xl font-bold">{ws.students.length}</p>
                </div>
              </div>
              <div>
                <div className="inline-flex flex-col items-center">
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><Clock size={14} /> Sessions</p>
                  <p className="text-3xl font-bold">{ws.sessions.length}</p>
                </div>
              </div>
              <div>
                <div className="inline-flex flex-col items-center">
                  <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1 flex items-center gap-2"><BookOpen size={14} /> Assignments</p>
                  <p className="text-3xl font-bold">{ws.assignments.length}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Below Banner */}
      <div className="max-w-[1440px] mx-auto p-6 md:p-10">
        {!ws && !loadingCourses && courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <BookOpen size={48} className="text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-[18px] font-bold text-foreground mb-2">No courses yet</h3>
            <p className="text-muted-foreground text-[14px]">The admin hasn't assigned any courses to you.</p>
          </div>
        ) : !ws ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12 items-start">
            {/* Left Pane: Sessions */}
            <div className="flex-1 w-full space-y-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <h3 className="text-[16px] font-bold text-foreground">Upcoming Sessions</h3>
                <button className="text-[13px] text-[#1099A1] hover:underline font-medium">View More</button>
              </div>
              <div className="space-y-0">
                {ws.sessions.length === 0 ? (
                  <p className="text-center text-[14px] text-muted-foreground py-10">No upcoming sessions.</p>
                ) : ws.sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-5 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-default">
                    <div className="flex items-center gap-6 min-w-0">
                      <div className="text-center w-12 shrink-0">
                        <p className="text-[20px] font-bold text-foreground leading-none">{fmtDate(s.date).split(" ")[1]}</p>
                        <p className="text-[12px] font-medium text-muted-foreground mt-1">{fmtDate(s.date).split(" ")[0]}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-bold text-foreground truncate">{s.subject}</p>
                        <p className="text-[13px] text-muted-foreground mt-0.5">{s.student_name}</p>
                      </div>
                    </div>
                    <span className={cn("px-3 py-1 text-[12px] font-bold rounded-full capitalize shrink-0",
                      s.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        s.status === "cancelled" || s.status === "no-show" ? "bg-red-100 text-red-600 dark:bg-red-900/20" : "bg-[#1099A1]/10 text-[#1099A1]")}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pane: Assignments */}
            <div className="flex-1 w-full space-y-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <h3 className="text-[16px] font-bold text-foreground">Assignments</h3>
                <button className="text-[13px] text-[#1099A1] hover:underline font-medium" onClick={() => navigate('/tutor/assignments')}>View More</button>
              </div>
              <div className="space-y-0">
                {ws.assignments.length === 0 ? (
                  <p className="text-center text-[14px] text-muted-foreground py-10">No assignments for this course.</p>
                ) : ws.assignments.map((a) => {
                  const pending = (a.submissionCount ?? 0) - (a.reviewedCount ?? 0);
                  return (
                    <div key={a.id} onClick={() => navigate(`/tutor/assignments/${a.id}`)} className="flex flex-col sm:flex-row sm:items-center justify-between py-5 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-pointer group">
                      <div className="flex items-start sm:items-center gap-6 min-w-0">
                        <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-full bg-[#1099A1]/10 items-center justify-center text-[#1099A1]">
                          <BookOpen size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[16px] text-foreground truncate group-hover:text-[#1099A1] transition-colors">{a.title}</h3>
                          <div className="flex items-center gap-4 text-[13px] text-muted-foreground mt-1">
                            <span className="flex items-center gap-1.5"><CalendarClock size={14} /> Due: {a.due_date ? fmtDate(a.due_date) : "No due date"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-[13px] font-medium text-foreground">{a.submissionCount} submissions</p>
                          {pending > 0 && <p className="text-[11px] font-bold text-[#CAA25F] uppercase tracking-wider mt-0.5">{pending} to review</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

