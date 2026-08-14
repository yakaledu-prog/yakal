import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { getStudentSessions } from "@/services/sessions";
import { getStudentCourses } from "@/services/studentService";

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StudentMyLearning() {
  const { user } = useAuth();
  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ["student-courses", user?.id],
    queryFn: () => getStudentCourses(user!.id),
    enabled: !!user?.id,
  });
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["student-sessions", user?.id],
    queryFn: async () => (await getStudentSessions(user!.id)).data ?? [],
    enabled: !!user?.id,
  });

  const nextSession = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return sessions
      .filter((session) => session.status === "upcoming" && session.date >= now)
      .sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`))[0];
  }, [sessions]);
  const nextDue = useMemo(
    () => courses.filter((course) => course.nextDue).sort(
      (a, b) => a.nextDue!.getTime() - b.nextDue!.getTime()
    )[0],
    [courses]
  );

  if (coursesLoading || sessionsLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-full bg-background pb-12 dark:bg-[#111b21]">
        <header className="bg-primary px-5 py-7 text-white md:px-10 md:py-10">
          <div className="mx-auto max-w-[1440px]">
            <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/70">Student workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">My Learning</h1>
            <p className="mt-2 max-w-xl text-[15px] text-white/80">Your next session, upcoming work and courses in one place.</p>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] space-y-8 p-4 md:p-8">
          <section className="grid gap-4 md:grid-cols-2">
            <article className="border-t-[3px] border-tertiary bg-white p-5 dark:bg-[#111b21]">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Next session</p>
              {nextSession ? (
                <>
                  <h2 className="mt-3 text-xl font-medium text-foreground">{nextSession.subject}</h2>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    {formatDate(`${nextSession.date}T00:00:00`)} at {nextSession.start_time.slice(0, 5)} with {nextSession.tutor_name}
                  </p>
                  <Link
                    to={nextSession.course_id ? `/student/my-learning/${nextSession.course_id}/sessions` : "/student/sessions"}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-white hover:bg-primary-hover"
                  >
                    View session <ArrowRight size={16} />
                  </Link>
                </>
              ) : <p className="mt-3 text-[14px] text-muted-foreground">No upcoming session is booked.</p>}
            </article>

            <article className="border-t-[3px] border-secondary bg-white p-5 dark:bg-[#111b21]">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Next due</p>
              {nextDue ? (
                <>
                  <h2 className="mt-3 text-xl font-medium text-foreground">{nextDue.title}</h2>
                  <p className="mt-1 text-[14px] text-muted-foreground">Work due {formatDate(nextDue.nextDue!)}</p>
                  <Link to={`/student/my-learning/${nextDue.id}/tasks`} className="mt-5 inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold text-primary hover:text-primary-hover">
                    View assignments <ArrowRight size={16} />
                  </Link>
                </>
              ) : <p className="mt-3 text-[14px] text-muted-foreground">You are caught up on dated assignments.</p>}
            </article>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-lg font-medium text-foreground">Your courses</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">Open a course for assignments, sessions and messages.</p>
              </div>
              <span className="text-[13px] text-muted-foreground">{courses.length} active</span>
            </div>

            {courses.length === 0 ? (
              <div className="py-16 text-center">
                <BookOpen className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-[14px] text-muted-foreground">Courses appear here after enrollment.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {courses.map((course) => (
                  <Link key={course.id} to={`/student/my-learning/${course.id}/tasks`} className="group flex min-h-[76px] items-center gap-4 py-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-primary/10 text-primary">
                      <BookOpen size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-medium text-foreground group-hover:text-primary">{course.title}</h3>
                      <p className="mt-1 truncate text-[12px] text-muted-foreground">{course.subject}{course.tutorName ? ` · ${course.tutorName}` : ""}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-[13px] text-foreground">{course.completed}/{course.total} complete</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{course.progress}%</p>
                    </div>
                    <ArrowRight size={17} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </PageWrapper>
  );
}
