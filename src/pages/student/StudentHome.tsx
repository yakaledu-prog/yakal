import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { CalendarDays, Activity, MessagesSquareIcon, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { studentService, getAllAssignments, getStudentCourses } from "@/services/studentService";
import { cn } from "@/utils/cn";
import { getStudentSessions } from "@/services/sessions";
import { UpcomingSessions, type SessionListItem } from "@/components/shared/SessionList";

export function StudentHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    studentService.getDashboardSummary().then(setData);
  }, []);

  // What is actually set and not yet turned in. The two blocks this replaced
  // read MOCK_DASHBOARD_SUMMARY.homeworkDue, which is two hardcoded rows.
  const { data: assignments = [], isLoading: workLoading } = useQuery({
    queryKey: ["student-assignments", user?.id],
    queryFn: () => getAllAssignments(user!.id),
    enabled: !!user?.id,
  });
  const outstanding = assignments.filter((a) => !a.isSubmitted);

  // The four banner figures were "3" as a literal, and three fields of
  // MOCK_DASHBOARD_SUMMARY: 12 completed sessions, a 4 day streak and a grade of
  // A-, identical for every student. The banner line under the welcome came from
  // the same mock, which is why it announced an AP Calculus session with "Dr.
  // Alex" while the week beside it said the schedule was clear. Streak and grade
  // are gone rather than replaced: nothing in the database supports either.
  const { data: courses = [] } = useQuery({
    queryKey: ["student-courses", user?.id],
    queryFn: () => getStudentCourses(user!.id),
    enabled: !!user?.id,
  });

  // The agenda reads the real sessions rather than the dashboard summary's one
  // shaped "next session", so it can show the week rather than the next hour.
  const { data: sessionRows = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["student-sessions", user?.id],
    queryFn: async () => {
      const { data } = await getStudentSessions(user!.id);
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  if (!data) {
    return (
      <PageWrapper>
        <div className="p-8 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageWrapper>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] || "Student";

  const today = new Date().toISOString().slice(0, 10);
  const nextToday = sessionRows.find(
    (s: any) => s.date === today && s.status === "upcoming"
  );
  const completedSessions = sessionRows.filter((s: any) => s.status === "completed").length;
  const upcomingSessions = sessionRows.filter((s: any) => s.status === "upcoming").length;

  const agendaItems: SessionListItem[] = sessionRows.map((s: any) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    durationMinutes: s.duration_minutes,
    status: s.status,
    title: s.subject,
    personName: s.tutor_name ?? null,
    personAvatarUrl: s.tutor_avatar ?? null,
  }));

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Command Banner */}
        <div className="bg-primary text-white">
          <div className="max-w-[1440px] mx-auto p-6 md:p-10 space-y-8">

            {/* Top row: Welcome + Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Welcome back, {firstName}!</h1>
                <p className="text-white/80 text-[15px]">
                  {nextToday
                    ? `You have ${nextToday.subject} at ${String(nextToday.start_time).slice(0, 5)} today.`
                    : "You have no sessions scheduled today. Enjoy the breather!"}
                </p>
              </div>

              {/* Toolbar Quick Actions (No cards, just sleek icon buttons) */}
              <div className="flex items-center gap-2 bg-black/10 p-1.5 rounded-lg">
                <TooltipButton icon={<CalendarDays size={18} />} label="My Learning" onClick={() => navigate("/student/courses")} />
                <TooltipButton icon={<MessagesSquareIcon size={18} />} label="Messages" onClick={() => navigate("/student/messages")} />
                <TooltipButton icon={<Settings size={18} />} label="Profile" onClick={() => navigate("/student/profile")} />
              </div>
            </div>

            {/* Bottom row: the four figures, all from the database */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/20">
              <IntegratedStat label="Active Courses" value={courses.length} />
              <IntegratedStat label="Completed Sessions" value={completedSessions} />
              <IntegratedStat label="Upcoming Sessions" value={upcomingSessions} />
              <IntegratedStat label="Work Due" value={outstanding.length} />
            </div>

          </div>
        </div>

        {/* Content Below Banner (Borderless, Typography Driven) */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">

          {/* Left: work that is actually outstanding.
              This was an "Activity Feed" of three invented lines: "You
              submitted Derivatives Practice", "Dr. Alex graded your Lab
              Report" and "System processed your course enrollment", with
              timestamps of two hours and five hours ago that were as fixed as
              the text. None of it came from anywhere, and Dr. Alex is not a
              person on this platform. */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[17px] font-medium flex items-center gap-2 text-foreground"><Activity size={19} className="text-primary" /> Work due</h2>
              <button onClick={() => navigate("/student/my-learning")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View all</button>
            </div>
            {workLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : outstanding.length === 0 ? (
              <p className="text-[14px] text-muted-foreground py-6">
                Nothing is outstanding. Anything a tutor sets appears here.
              </p>
            ) : (
              <div className="space-y-0">
                {outstanding.slice(0, 6).map((a) => (
                  <WorkItem
                    key={a.id}
                    title={a.title}
                    course={a.courseTitle}
                    due={a.dueDate}
                    onClick={() => navigate(`/student/my-learning/${a.courseId}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Vertical Agenda */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[17px] font-medium flex items-center gap-2 text-foreground"><CalendarDays size={19} className="text-primary" /> Your week</h2>
              <button onClick={() => navigate("/student/sessions")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View all</button>
            </div>

            {/* The same rows as the sessions page, stacked so they fit this
                column. */}
            <UpcomingSessions
              sessions={agendaItems}
              isLoading={sessionsLoading}
              compact
              limit={6}
              emptyText="Your schedule is clear."
              onJoin={(s) => navigate(`/student/meeting/${s.id}`)}
            />
          </div>

        </div>

      </div>
    </PageWrapper>
  );
}

function TooltipButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="p-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors focus:outline-none"
    >
      {icon}
    </button>
  );
}

function IntegratedStat({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div>
      <div className="inline-flex flex-col items-center">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider">{label}</p>
          {alert && <div className="w-2 h-2 rounded-full bg-secondary" title="Requires Attention" />}
        </div>
        <p className="text-3xl font-bold">{value}</p>
      </div>
    </div>
  );
}

/** One piece of outstanding work. Real, unlike the feed this replaced. */
function WorkItem({
  title,
  course,
  due,
  onClick,
}: {
  title: string;
  course: string;
  due: string | null;
  onClick: () => void;
}) {
  // "Overdue" and "Today" are worth saying plainly; anything further out is a
  // date, because "in 9 days" makes somebody do arithmetic to plan around it.
  const label = (() => {
    if (!due) return "No deadline";
    const d = new Date(due + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return "Overdue";
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  })();
  const overdue = label === "Overdue";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col justify-between gap-1 rounded-lg border-b border-border/40 px-2 -mx-2 py-4 text-left transition-colors last:border-0 hover:bg-muted/10 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/30 transition-colors group-hover:bg-primary" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-foreground md:text-[15px]">{title}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{course}</p>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 pl-6 text-[12px] sm:pl-0 md:text-[13px]",
          overdue ? "font-medium text-[#b3261e] dark:text-[#f2b8b5]" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </button>
  );
}

