import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import {
  getCounselorDashboard,
  getCounselorSessionsFull,
  getCounselorStudents,
} from "@/services/counselorService";
import {
  CalendarDays,
  Compass,
  FileText,
  Loader2,
  Map as MapIcon,
  MessagesSquareIcon,
  Users,
  Wallet,
} from "lucide-react";
import { loadCatalog } from "@/services/collegeCatalogService";
import { getReviewQueue } from "@/services/essayReviewService";
import { getAdmissionsPlans } from "@/services/admissionsService";
import { EssayReviewList } from "@/components/college/EssayReviewList";
import { SessionList, SessionListItem } from "@/components/shared/SessionList";
export function CounselorHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: dashboard } = useQuery({
    queryKey: ["counselor-dashboard", user?.id],
    queryFn: () => getCounselorDashboard(user!.id),
    enabled: !!user?.id,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["counselor-sessions", user?.id],
    queryFn: () => getCounselorSessionsFull(user!.id),
    enabled: !!user?.id,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["counselor-students", user?.id],
    queryFn: () => getCounselorStudents(user!.id),
    enabled: !!user?.id,
  });

  const studentIds = students.map((s) => s.id);

  const { data: essays = [], isLoading: essaysLoading } = useQuery({
    queryKey: ["review-queue", studentIds.join(",")],
    queryFn: () => getReviewQueue(studentIds),
    enabled: studentIds.length > 0,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const { data: plans } = useQuery({
    queryKey: ["admissions-plans", studentIds.join(",")],
    queryFn: () => getAdmissionsPlans(studentIds),
    enabled: studentIds.length > 0,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "Counselor";

  // Real data only. Two mock blocks used to sit here: a mockDashboard that
  // overwrote totalStudents and essaysInReview with 1 and 0, and a mockSessions
  // array selected by `mockSessions.length > 0`, which is always true, so the
  // real sessions could never render. A counsellor with essays waiting was told
  // there were none, and was shown two invented sessions with a dead Zoom link.
  const now = new Date();
  const upcoming: SessionListItem[] = sessions
    .filter((s) => new Date(`${s.date}T${s.start_time}`) >= now)
    .slice(0, 4)
    .map((s) => ({
      id: s.id,
      date: s.date,
      startTime: s.start_time.slice(0, 5),
      durationMinutes: s.duration_minutes,
      status: s.status,
      title: s.subject,
      personName: s.student_name ?? null,
      personAvatarUrl: s.student_avatar ?? null,
    }));

  // Only what is actually on the counsellor's desk. The full queue is a page of
  // its own, and a column on the home screen that repeats it is a second place
  // to keep in sync.
  const waiting = essays.filter((e) => e.status === "in_review").slice(0, 4);

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Command Banner */}
        <div className="bg-primary text-white relative overflow-hidden">
          {/* Subtle SVG Background Pattern */}
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          </svg>

          <div className="relative z-10 max-w-[1440px] mx-auto p-6 md:p-10 space-y-8">
            {/* Top row: Welcome + Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Welcome back, {firstName}!</h1>
                <p className="text-white/80 text-[15px]">
                  {upcoming.length > 0
                    ? `You have ${upcoming.length} upcoming session${upcoming.length === 1 ? "" : "s"}. Guide your students through their college journey.`
                    : "You have no sessions scheduled today. Enjoy the breather!"}
                </p>
              </div>

              {/* Everything in the sidebar that a counsellor opens daily. Two
                  of eight was not a toolbar, it was the two somebody happened
                  to add first. */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg bg-black/10 p-1.5">
                <TooltipButton icon={<Users size={18} />} label="Students" onClick={() => navigate("/counselor/students")} />
                <TooltipButton icon={<FileText size={18} />} label="Essays" onClick={() => navigate("/counselor/essays")} />
                <TooltipButton icon={<CalendarDays size={18} />} label="Calendar" onClick={() => navigate("/counselor/calendar")} />
                <TooltipButton icon={<MapIcon size={18} />} label="Roadmap" onClick={() => navigate("/counselor/roadmap")} />
                <TooltipButton icon={<Compass size={18} />} label="Explore" onClick={() => navigate("/counselor/explore")} />
                <TooltipButton icon={<MessagesSquareIcon size={18} />} label="Messages" onClick={() => navigate("/counselor/messages")} />
                <TooltipButton icon={<Wallet size={18} />} label="Earnings" onClick={() => navigate("/counselor/earnings")} />
              </div>
            </div>

            {/* Bottom row: Integrated Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/20">
              <IntegratedStat label="Total Students" value={dashboard?.totalStudents ?? "-"} />
              <IntegratedStat label="Essays in Review" value={dashboard?.essaysInReview ?? "-"} />
              <IntegratedStat label="Upcoming Deadlines" value={dashboard?.upcomingDeadlines.length ?? "-"} />
              <IntegratedStat label="Upcoming Sessions" value={upcoming.length} />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] space-y-10 p-6 md:p-10">
          {/* What is on the desk today, in two columns. Both are the shared
              component the full page uses, so a counsellor reading a row here
              and a row there is reading the same row. */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <section>
              <SectionHead
                title="Essays waiting on you"
                onAll={() => navigate("/counselor/essays")}
              />
              <EssayReviewList
                essays={waiting}
                plans={plans}
                catalog={catalog}
                counselorId={user?.id}
                counselorName={profile?.full_name ?? undefined}
                students={students}
                compact
                emptyText="Nothing is waiting on you."
              />
              {essaysLoading && waiting.length === 0 && (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-primary" size={20} />
                </div>
              )}
            </section>

            <section>
              <SectionHead
                title="Upcoming sessions"
                onAll={() => navigate("/counselor/sessions")}
              />
              <SessionList
                sessions={upcoming}
                isLoading={sessionsLoading}
                compact
                emptyText="No sessions scheduled."
              />
            </section>
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}

/**
 * A heading that stays out of the way.
 *
 * These were 18px with a coloured icon and a rule under them, which made three
 * section titles compete with the content they label. The page is the list.
 */
function SectionHead({ title, onAll }: { title: string; onAll?: () => void }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
      {onAll && (
        <button
          type="button"
          onClick={onAll}
          className="text-[13px] font-medium text-primary hover:underline"
        >
          View all
        </button>
      )}
    </div>
  );
}

function TooltipButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors relative group"
      aria-label={label}
    >
      {icon}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-[11px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {label}
      </span>
    </button>
  );
}

function IntegratedStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col cursor-default opacity-90 hover:opacity-100 transition-opacity">
      <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-left">{value}</p>
    </div>
  );
}
