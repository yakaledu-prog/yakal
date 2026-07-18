import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Video, Clock, CalendarDays, Activity, MessagesSquareIcon, Settings, X, GraduationCap } from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { studentService } from "@/services/studentService"; // reusing student service for mock data
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";

export function ParentHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const { sidebarOpen } = useOutletContext<{ sidebarOpen: boolean }>();

  useEffect(() => {
    // Reusing student dashboard mock data for now, but pretending it's the child's data
    studentService.getDashboardSummary().then(setData);
  }, []);

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

  const firstName = profile?.full_name?.split(" ")[0] || "Parent";
  const { nextSession, progress } = data;

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
                    ? `Your child has a ${nextSession.subject.toLowerCase()} session coming up today.`
                    : "Your children have no sessions scheduled today."}
                </p>
              </div>

              {/* Toolbar Quick Actions (No cards, just sleek icon buttons) */}
              <div className="flex items-center gap-2 bg-black/10 p-1.5 rounded-lg">
                <TooltipButton icon={<CalendarDays size={18} />} label="Browse Courses" onClick={() => navigate("/parent/courses")} />
                <TooltipButton icon={<MessagesSquareIcon size={18} />} label="Messages" onClick={() => navigate("/parent/messages")} />
                <TooltipButton icon={<Settings size={18} />} label="Profile" onClick={() => navigate("/parent/profile")} />
              </div>
            </div>

            {/* Bottom row: Integrated Stats + Sparkline */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/20">
              <IntegratedStat label="Enrolled Courses" value="3" />
              <IntegratedStat label="My Children" value="2" />
              <IntegratedStat label="New Messages" value="1" alert={true} />

              <div className="flex flex-col cursor-default opacity-80">
                <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1">Upcoming Classes</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold">4</p>
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
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground"><Activity size={20} className="text-[#1099A1]" /> Recent Activity</h2>
            </div>
            <div className="space-y-0">
              <FeedItem text={`Brooklyn submitted ${data.homeworkDue[0]?.title || 'Homework'}`} time="2 hours ago" />
              <FeedItem text={`Dr. Alex left feedback for Brooklyn's ${data.homeworkDue[1]?.title || 'Lab Report'}`} time="5 hours ago" />
              <FeedItem text="System processed your payment for AP Calculus" time="Yesterday" />
            </div>
          </div>

          {/* Right: Vertical Agenda */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground"><CalendarDays size={20} className="text-[#1099A1]" /> Children's Agenda</h2>
              <button onClick={() => navigate("/parent/children")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View children</button>
            </div>

            <div className="space-y-6">
              {!nextSession && data.homeworkDue.length === 0 ? (
                <p className="text-muted-foreground text-[14px]">The schedule is clear!</p>
              ) : (
                <>
                  {nextSession && (
                    <div className="relative pl-6 border-l-2 border-[#1099A1]">
                      <div className="absolute w-3 h-3 bg-[#1099A1] rounded-full -left-[7px] top-1.5 shadow-[0_0_0_4px_rgba(16,153,161,0.2)]" />
                      <span className="text-[#1099A1] text-[11px] font-bold uppercase tracking-wider block mb-1">Next Up for Brooklyn</span>
                      <p className="text-[16px] font-semibold text-foreground">{nextSession.subject}</p>
                      <div className="flex items-center gap-2 mt-2 text-muted-foreground text-[13px]">
                        <Clock size={14} /> {nextSession.date}
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <img src={nextSession.image || dicebearUrl(nextSession.tutor)} alt="" className="w-6 h-6 rounded-full" />
                        <span className="text-[13px] font-medium text-foreground">{nextSession.tutor}</span>
                      </div>
                    </div>
                  )}

                  {data.homeworkDue.map((h: any) => (
                    <div key={h.id} className="relative pl-6 border-l-2 border-border/50">
                      <div className="absolute w-2 h-2 bg-border rounded-full -left-[5px] top-1.5" />
                      <p className="text-[15px] font-medium text-foreground">{h.title} (Brooklyn)</p>
                      <div className="flex items-center gap-3 mt-1.5 text-muted-foreground text-[13px]">
                        <span className="flex items-center gap-1.5"><CalendarDays size={13} /> {h.due}</span>
                        <span className="text-xs text-muted-foreground">{h.subject}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
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
