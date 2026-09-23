import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Users, ExternalLink, Calendar, ChevronLeft } from "lucide-react";
import { getCourse, getCourseAssignments, getCourseDetail, getPendingApplicantCounts, type AdminCourse } from "@/services/adminService";
import { money } from "@/services/billingService";
import { cn } from "@/utils/cn";
import { CourseApplicants } from "@/components/admin/CourseApplicants";
import { CourseAssignments } from "@/components/shared/CourseAssignments";
import { useQuery } from "@tanstack/react-query";
import { StudentsTab } from "@/pages/admin/courses/StudentsTab";

export function AdminCourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tutors");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  // The enrolled count in the header, from the same query the Students tab
  // reads, so the two cannot disagree.
  const { data: detail } = useQuery({
    queryKey: ["admin-course-detail", id],
    queryFn: () => getCourseDetail(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (id) {
      getCourse(id).then((data) => {
        setCourse(data);
        setIsLoading(false);
      });
    }
  }, [id]);

  // Who is waiting on a decision, for the applicants block above the tabs.
  useEffect(() => {
    getPendingApplicantCounts().then(setPendingCounts);
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (!course) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Course not found</div>;
  }

  const tabs = [
    { id: "tutors", label: "Tutors" },
    { id: "students", label: "Students" },
    { id: "assignments", label: "Assignments" },
    { id: "sessions", label: "Sessions" },
  ];

  return (
    // One column, the course and nothing beside it. A list of every other
    // course used to run down the left, which halved the page for a switch
    // nobody needed: the courses page is one click back, and its table is the
    // better place to choose from.
    <div className="course-page flex h-full min-h-0 flex-col overflow-y-auto">
      <section className="min-w-0 flex-1 bg-[#fafafa] dark:bg-[#111b21]">
        {/* Header Banner */}
        <div className="w-full bg-primary text-white pt-8 px-6 md:px-10 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="max-w-[1440px] mx-auto relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="max-w-[800px]">
                <button
                  type="button"
                  onClick={() => navigate("/admin/courses")}
                  className="mb-3 flex items-center gap-1 text-[13px] font-medium text-white/80 transition-colors hover:text-white"
                >
                  <ChevronLeft size={15} /> Back to Courses
                </button>
                <h1 className="text-[32px] md:text-[48px] font-bold tracking-tight mb-4 leading-tight">{course.title}</h1>
                {course.description ? (
                  <div
                    className="text-white/90 text-[15px] md:text-[18px] leading-relaxed mb-6 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: course.description }}
                  />
                ) : (
                  <p className="text-white/90 text-[15px] md:text-[18px] leading-relaxed mb-6">
                    Learn {course.subject} with our expert tutors. Tailored sessions for academic excellence.
                  </p>
                )}

                {/* A 4.8 from 320 reviews and 1,204 students enrolled sat here
                    on every course, including one created a minute ago. Both
                    were placeholder text. Reviews are written about tutors
                    rather than courses, so the rating had nothing behind it at
                    all and is gone rather than replaced. */}
                <div className="flex flex-wrap items-center gap-6 text-[14px] font-medium text-white/95">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 opacity-80" />
                    <span>
                      {detail?.students.length === 1
                        ? "1 student enrolled"
                        : `${detail?.students.length ?? 0} students enrolled`}
                    </span>
                  </div>
                  {course.google_classroom_url && (
                    <a href={course.google_classroom_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 underline underline-offset-2 opacity-90 hover:opacity-100">
                      <ExternalLink size={14} /> Classroom
                    </a>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-start md:items-end shrink-0 mt-4 md:mt-0">
                <div className="text-[28px] md:text-[36px] font-bold mb-1">
                  {course.price_cents != null ? money(course.price_cents) : "—"}
                  <span className="text-[16px] font-normal opacity-80 tracking-normal">/course</span>
                </div>
                <div className="text-[14px] opacity-90">
                  Or starting at {course.tutor_payout_cents != null ? money(course.tutor_payout_cents) : "—"}/hr with tutors
                </div>
              </div>
            </div>

            {/* Tabs, along the foot of the header rather than a strip below it */}
            <div className="mt-8 flex overflow-x-auto no-scrollbar border-t border-white/20">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative whitespace-nowrap px-6 py-4 text-[15px] font-medium transition-colors",
                    activeTab === tab.id ? "text-white" : "text-white/60 hover:text-white"
                  )}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 h-[3px] w-full rounded-t-full bg-white" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full mx-auto p-6 md:p-10">

          {/* Anyone still waiting on a decision, above the tabs because that is
            what an admin opens an unassigned course to deal with. Who ended up
            teaching it is a different question and lives in the Tutors tab. */}
          {(pendingCounts[course.id] ?? 0) > 0 && (
            <>
              <CourseApplicants
                courseId={course.id}
                courseTitle={course.title}
                show="pending"
                onAssigned={() => {
                  if (id) getCourse(id).then(setCourse);
                  getPendingApplicantCounts().then(setPendingCounts);
                }}
              />
              <hr className="my-8 border-[#e9edef] dark:border-[#2a3942]" />
            </>
          )}

          {/* TUTORS TAB */}
          {activeTab === "tutors" && (
            <CourseApplicants
              courseId={course.id}
              courseTitle={course.title}
              show="assigned"
              onAssigned={() => {
                if (id) getCourse(id).then(setCourse);
                getPendingApplicantCounts().then(setPendingCounts);
              }}
            />
          )}

          {/* ASSIGNMENTS TAB */}
          {activeTab === "assignments" && (
            <AssignmentsTab courseId={course.id} />
          )}

          {/* STUDENTS TAB */}
          {activeTab === "students" && (
            <StudentsTab courseId={course.id} hasClassroom={!!course.google_classroom_url} />
          )}

          {/* SESSIONS TAB */}
          {activeTab === "sessions" && (
            <div className="animate-in fade-in duration-300">
              {(detail?.sessions.length ?? 0) === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-[16px] font-medium text-[#111] dark:text-white mb-2">No lessons booked</h3>
                  <p className="text-[14px] text-muted-foreground max-w-sm">
                    A lesson appears here when a family books one of this course's hours.
                  </p>
                </div>
              ) : (
                /* The real thing, from getCourseDetail. This tab used to say
                   "No upcoming sessions" whatever was booked, because it read
                   nothing at all. */
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-medium text-muted-foreground">
                      <th className="pb-2.5 pr-4">When</th>
                      <th className="pb-2.5 pr-4">Student</th>
                      <th className="pb-2.5 pr-4">Length</th>
                      <th className="pb-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail!.sessions.map((s) => (
                      <tr key={s.id} className="border-b border-border">
                        <td className="py-3 pr-4 text-[14px] text-[#111] dark:text-white">
                          {new Date(`${s.date}T00:00:00`).toLocaleDateString(undefined, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                          <span className="ml-2 text-[13px] text-muted-foreground">{s.startTime?.slice(0, 5)}</span>
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-muted-foreground">{s.studentName ?? "A student"}</td>
                        <td className="py-3 pr-4 text-[13px] tabular-nums text-muted-foreground">
                          {s.durationMinutes ?? 60} min
                        </td>
                        <td
                          className={cn(
                            "py-3 text-[12.5px] font-medium capitalize",
                            s.status === "completed"
                              ? "text-primary"
                              : s.status === "cancelled" || s.status === "no-show"
                                ? "text-muted-foreground"
                                : "text-[#8a6a2a] dark:text-secondary"
                          )}
                        >
                          {s.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

/** Thin wrapper: the DB rows for this course, then the shared reader. */
function AssignmentsTab({ courseId }: { courseId: string }) {
  const { data: local = [], isLoading } = useQuery({
    queryKey: ["admin-course-assignments", courseId],
    queryFn: () => getCourseAssignments(courseId),
  });

  return (
    <CourseAssignments courseId={courseId} localAssignments={local} isLoading={isLoading} />
  );
}
