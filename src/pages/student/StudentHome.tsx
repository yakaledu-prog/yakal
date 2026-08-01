import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { CalendarDays, Activity, MessagesSquareIcon, Settings, X } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { studentService } from "@/services/studentService";
import { cn } from "@/utils/cn";
import { getStudentSessions } from "@/services/sessions";
import { UpcomingSessions, type SessionListItem } from "@/components/shared/SessionList";

export function StudentHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const { sidebarOpen } = useOutletContext<{ sidebarOpen: boolean }>();

  useEffect(() => {
    studentService.getDashboardSummary().then(setData);
  }, []);

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
  const { nextSession, progress } = data;

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
        <div className="bg-[#1099A1] text-white">
          <div className="max-w-[1440px] mx-auto p-6 md:p-10 space-y-8">

            {/* Top row: Welcome + Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Welcome back, {firstName}!</h1>
                <p className="text-white/80 text-[15px]">
                  {nextSession 
                    ? `You have a ${nextSession.subject.toLowerCase()} session coming up today. Keep up the great work on your learning streak.`
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

            {/* Bottom row: Integrated Stats + Sparkline */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/20">
              <IntegratedStat label="Active Courses" value="3" />
              <IntegratedStat label="Completed Sessions" value={progress.completedSessions} />
              <IntegratedStat label="Learning Streak" value={`${progress.currentStreak} days`} alert={false} />

              <div className="flex flex-col cursor-default opacity-80">
                <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1">Overall Grade</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold">{progress.overallGrade}</p>
                  <Sparkline />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Content Below Banner (Borderless, Typography Driven) */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">

          {/* Left: Recent Activity Feed */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground"><Activity size={20} className="text-[#1099A1]" /> Activity Feed</h2>
            </div>
            <div className="space-y-0">
              <FeedItem text={`You submitted ${data.homeworkDue[0]?.title || 'Homework'}`} time="2 hours ago" />
              <FeedItem text={`Dr. Alex graded your ${data.homeworkDue[1]?.title || 'Lab Report'}`} time="5 hours ago" />
              <FeedItem text="System processed your course enrollment" time="Yesterday" />
            </div>
          </div>

          {/* Right: Vertical Agenda */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground"><CalendarDays size={20} className="text-[#1099A1]" /> Agenda</h2>
              <button onClick={() => navigate("/student/sessions")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View all</button>
            </div>

            {/* The same rows as the sessions page, stacked so they fit this
                column. Homework keeps its own shape below: it is not a
                session and should not pretend to be one. */}
            <UpcomingSessions
              sessions={agendaItems}
              isLoading={sessionsLoading}
              compact
              limit={6}
              emptyText="Your schedule is clear."
              onJoin={(s) => navigate(`/student/meeting/${s.id}`)}
            />

            {data.homeworkDue.length > 0 && (
              <div className="space-y-4 border-t border-border/50 pt-6">
                {data.homeworkDue.map((h: any) => (
                  <div key={h.id}>
                    <p className="text-[15px] font-medium text-foreground">{h.title}</p>
                    <div className="mt-1.5 flex items-center gap-3 text-[13px] text-muted-foreground">
                      <span className="flex items-center gap-1.5"><CalendarDays size={13} /> {h.due}</span>
                      <span>{h.subject}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Announcements Logic */}
        {showAnnouncement && data.announcements.length > 0 && (
          <div
            className={cn(
              "fixed bottom-0 right-0 z-40 transition-all duration-300 left-0",
              sidebarOpen ? "md:left-60" : "md:left-20"
            )}
          >
            <div className="bg-teal-50/95 dark:bg-teal-950/95 backdrop-blur border-t border-teal-200 dark:border-teal-900/50 px-4 py-1 text-xs font-medium flex items-center justify-between text-teal-800 dark:text-teal-200">
              <div className="flex items-center gap-2">
                <span className="font-bold">Notice:</span>
                <span className="truncate">{data.announcements[0].title} on {data.announcements[0].date}. Check your inbox for details.</span>
              </div>
              <button
                onClick={() => setShowAnnouncementDialog(true)}
                className="p-1 hover:bg-teal-200/50 dark:hover:bg-teal-900/50 rounded-md transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {showAnnouncementDialog && data.announcements.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <Card className="w-full max-w-md shadow-lg border-muted animate-in fade-in zoom-in-95 duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex justify-between items-start text-lg">
                  <span>{data.announcements[0].title}</span>
                  <button
                    onClick={() => setShowAnnouncementDialog(false)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                  <p className="font-medium text-foreground mb-1">Date: {data.announcements[0].date}</p>
                  <p>Please make sure to check your inbox for the registration link and further details regarding this upcoming seminar. Preparation materials will be sent out 24 hours prior.</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAnnouncementDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowAnnouncement(false);
                      setShowAnnouncementDialog(false);
                    }}
                  >
                    Mark as Read
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
          {alert && <div className="w-2 h-2 rounded-full bg-[#CAA25F]" title="Requires Attention" />}
        </div>
        <p className="text-3xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function FeedItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between py-5 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-default">
      <div className="flex items-center gap-4">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-[#1099A1] transition-colors" />
        <p className="text-[14px] md:text-[15px] font-medium text-foreground">{text}</p>
      </div>
      <span className="text-[12px] md:text-[13px] text-muted-foreground mt-2 sm:mt-0">{time}</span>
    </div>
  );
}

function Sparkline() {
  return (
    <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-80">
      <path d="M2 18L12 12L22 16L32 6L42 10L58 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M58 2L42 10L32 6L22 16L12 12L2 18V24H58V2Z" fill="url(#sparkline-gradient)" opacity="0.2" />
      <defs>
        <linearGradient id="sparkline-gradient" x1="30" y1="2" x2="30" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
