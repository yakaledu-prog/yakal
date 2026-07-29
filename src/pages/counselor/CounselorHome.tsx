import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCounselorDashboard, getCounselorSessionsFull } from "@/services/counselorService";
import { CalendarDays, Loader2, MessagesSquareIcon, Settings, Flag, Video, CalendarClock, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";
import { collegeImageUrl } from "@/services/collegeCatalogService";

function getDaysLeft(deadline: string) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const d = new Date(deadline + "T00:00:00");
  const diffTime = d.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CounselorHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["counselor-dashboard", user?.id],
    queryFn: () => getCounselorDashboard(user!.id),
    enabled: !!user?.id,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["counselor-sessions", user?.id],
    queryFn: () => getCounselorSessionsFull(user!.id),
    enabled: !!user?.id,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "Counselor";

  // Get upcoming sessions for "What's next"
  const now = new Date();
  const upcomingSessions = sessions.filter(s => {
    const sessionDate = new Date(`${s.date}T${s.start_time}`);
    return sessionDate >= now || s.date === now.toISOString().split('T')[0];
  }).slice(0, 5); // Limit to 5

  const isLoading = dashLoading || sessionsLoading;

  // --- MOCK DATA INJECTION ---
  const mockDashboard = dashboard ? {
    ...dashboard,
    totalStudents: 1,
    essaysInReview: 0,
    upcomingDeadlines: [
      {
        id: "mock1",
        school: "Massachusetts Institute of Technology",
        student: "Amen Worku",
        studentAvatar: null,
        deadline: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString().split('T')[0],
        image: "https://upload.wikimedia.org/wikipedia/en/4/44/MIT_Seal.svg",
        requirements: [
          { label: "Application submitted", is_complete: true },
          { label: "Supplemental essays", is_complete: false },
          { label: "Transcript sent", is_complete: true }
        ]
      },
      {
        id: "mock2",
        school: "Harvard University",
        student: "Amen Worku",
        studentAvatar: null,
        deadline: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString().split('T')[0],
        image: "https://upload.wikimedia.org/wikipedia/en/2/29/Harvard_shield_wreath.svg",
        requirements: [
          { label: "Application submitted", is_complete: true },
          { label: "Supplemental essays", is_complete: true }
        ]
      },
      {
        id: "mock3",
        school: "Stanford University",
        student: "Amen Worku",
        studentAvatar: null,
        deadline: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
        image: "https://upload.wikimedia.org/wikipedia/en/b/b7/Stanford_University_seal_2003.svg",
        requirements: [
          { label: "Application submitted", is_complete: false },
          { label: "Transcript sent", is_complete: false }
        ]
      }
    ]
  } : null;

  const activeDashboard = mockDashboard || dashboard;
  
  const mockSessions = [
    {
      id: "s1",
      date: new Date().toISOString().split('T')[0],
      start_time: "15:00:00",
      duration_minutes: 60,
      subject: "College Essay Review",
      student_name: "Amen Worku",
      student_avatar: null,
      status: "scheduled",
      meeting_link: "https://zoom.us/j/123456789"
    },
    {
      id: "s2",
      date: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
      start_time: "10:00:00",
      duration_minutes: 45,
      subject: "Application Strategy",
      student_name: "Amen Worku",
      student_avatar: null,
      status: "scheduled",
      meeting_link: "https://zoom.us/j/987654321"
    }
  ];
  
  const activeUpcomingSessions = mockSessions.length > 0 ? mockSessions : upcomingSessions;
  // ---------------------------

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Command Banner */}
        <div className="bg-[#1099A1] text-white relative overflow-hidden">
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
                  {activeUpcomingSessions.length > 0
                    ? `You have ${activeUpcomingSessions.length} upcoming session${activeUpcomingSessions.length === 1 ? '' : 's'}. Guide your students through their college journey.`
                    : "You have no sessions scheduled today. Enjoy the breather!"}
                </p>
              </div>

              {/* Toolbar Quick Actions */}
              <div className="flex items-center gap-2 bg-black/10 p-1.5 rounded-lg">
                <TooltipButton icon={<CalendarDays size={18} />} label="Calendar" onClick={() => navigate("/counselor/calendar")} />
                <TooltipButton icon={<MessagesSquareIcon size={18} />} label="Messages" onClick={() => navigate("/counselor/messages")} />
                <TooltipButton icon={<Settings size={18} />} label="Settings" onClick={() => navigate("/counselor/settings")} />
              </div>
            </div>

            {/* Bottom row: Integrated Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/20">
              <IntegratedStat label="Total Students" value={activeDashboard?.totalStudents ?? "-"} />
              <IntegratedStat label="Essays in Review" value={activeDashboard?.essaysInReview ?? "-"} />
              <IntegratedStat label="Upcoming Deadlines" value={activeDashboard?.upcomingDeadlines.length ?? "-"} />
              <IntegratedStat label="Upcoming Sessions" value={activeUpcomingSessions.length} />
            </div>
          </div>
        </div>

        {/* Content Below Banner (2 Columns) */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

          {/* Left: Upcoming Deadlines */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground">
                <CalendarClock size={20} className="text-[#1099A1]" /> Upcoming Deadlines
              </h2>
            </div>

            {dashLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : !activeDashboard || activeDashboard.upcomingDeadlines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 bg-card border border-dashed rounded-xl p-6 text-center">
                <p className="text-[14px] text-muted-foreground">No deadlines on file.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activeDashboard!.upcomingDeadlines.map((d, i) => {
                  const daysLeft = getDaysLeft(d.deadline);
                  const isUrgent = daysLeft <= 7;
                  
                  return (
                    <div key={i} className="flex flex-col gap-4 py-5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors -mx-4 px-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 min-w-0 pr-4">
                          <div className="w-16 h-16 bg-slate-100 flex items-center justify-center shrink-0 border overflow-hidden">
                            <img src={d.image ? (collegeImageUrl(d.image, 128) || "") : `https://ui-avatars.com/api/?name=${encodeURIComponent(d.school)}&background=f1f5f9&color=64748b&size=128&rounded=false`} alt={d.school} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 mt-0.5">
                            <p className="text-[16px] font-semibold text-foreground truncate leading-tight">{d.school}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <img src={d.studentAvatar || dicebearUrl(d.student)} alt={d.student} className="w-5 h-5 rounded-full object-cover shrink-0" />
                              <p className="text-[13px] font-medium text-muted-foreground truncate">{d.student}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className={cn("text-[14px] font-bold", isUrgent ? "text-red-500" : "text-[#1099A1]")}>
                            {fmtDate(d.deadline)}
                          </span>
                          {isUrgent && (
                            <span className="text-[11px] font-semibold mt-0.5 uppercase tracking-wider text-red-500">
                              {daysLeft === 0 ? "Today" : daysLeft < 0 ? "Passed" : `${daysLeft} days`}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {d.requirements && d.requirements.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 ml-[5rem]">
                          {d.requirements.map((r, ri) => (
                            <span key={ri} className={cn("inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full font-medium border", r.is_complete ? "bg-[#1099A1] text-white border-[#1099A1]" : "bg-transparent text-muted-foreground border-border")}>
                              {r.is_complete && <Check size={12} className="mr-1 -ml-0.5" />}
                              {r.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: What's Next (Sessions) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground">
                <CalendarDays size={20} className="text-[#1099A1]" /> What's next
              </h2>
              <button
                onClick={() => navigate("/counselor/sessions")}
                className="text-[13px] font-medium text-[#1099A1] hover:underline"
              >
                View all
              </button>
            </div>

            {sessionsLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : activeUpcomingSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 bg-card border border-dashed rounded-xl p-6 text-center">
                <p className="text-[14px] text-muted-foreground">No upcoming sessions scheduled.</p>
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {activeUpcomingSessions.map((session, index) => (
                  <div key={session.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Timeline Marker */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 group-[.is-active]:bg-[#1099A1] group-[.is-active]:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                      <Video size={16} />
                    </div>

                    {/* Card */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm group-[.is-active]:border-[#1099A1]/30 hover:border-[#1099A1]/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-[#1099A1] uppercase tracking-wider">
                          {fmtDate(session.date)} • {session.start_time.slice(0, 5)}
                        </span>
                      </div>
                      <h3 className="font-bold text-[15px] mb-1 truncate">{session.subject}</h3>
                      <div className="flex items-center gap-2 mt-3">
                        {session.student_avatar ? (
                          <img src={session.student_avatar} alt={session.student_name} className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#1099A1]/10 flex items-center justify-center text-[10px] font-bold text-[#1099A1]">
                            {session.student_name?.charAt(0) || "S"}
                          </div>
                        )}
                        <span className="text-[13px] text-muted-foreground truncate">{session.student_name}</span>
                      </div>

                      {session.meeting_link && (
                        <div className="mt-4">
                          <a
                            href={session.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center w-full gap-2 px-4 py-2 bg-[#1099A1] text-white text-[13px] font-medium rounded-lg hover:bg-[#0d828a] transition-colors"
                          >
                            Join Session
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </PageWrapper>
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
