import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Video, Clock, Users, ClipboardCheck, CalendarDays, Wallet, ChevronRight, MessageSquare, Settings, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorDashboard, TutorDashboard, SessionRow } from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";

function formatTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDay(d?: string) {
  if (!d) return "";
  const today = new Date().toISOString().slice(0, 10);
  const tmr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (d === today) return "Today";
  if (d === tmr) return "Tomorrow";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function TutorHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<TutorDashboard | null>(null);

  useEffect(() => {
    if (!profile) return;
    getTutorDashboard(profile.id).then(setData);
  }, [profile]);

  const firstName = (profile?.full_name || "there").split(" ")[0];

  const join = (s: SessionRow) => {
    const link = s.zoom_link || profile?.zoom_link;
    if (link) window.open(link, "_blank");
  };

  if (!data) {
    return (
      <PageWrapper>
        <div className="space-y-6 p-5">
          <Skeleton className="h-[180px] w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[300px] lg:col-span-2" />
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      </PageWrapper>
    );
  }

  const { today, next, upcomingList, stats } = data;
  const rate = profile?.hourly_rate ?? 0;
  const currency = profile?.rate_currency || "ETB";
  const earnings = stats.completed * rate;

  return (
    <PageWrapper>
      <div className="space-y-6 p-5 dark:bg-[#111b21]">
        {/* Welcome Banner */}
        <div className="rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-8 flex flex-col sm:flex-row items-center justify-between shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {firstName}!</h1>
            <p className="text-primary-foreground/80">
              {today.length > 0
                ? `You have ${today.length} session${today.length > 1 ? "s" : ""} scheduled today.`
                : "You have no sessions scheduled today. Enjoy the breather!"}
            </p>
          </div>
          <div className="relative z-10 mt-4 sm:mt-auto sm:-mb-1">
            <Button variant="secondary" size="lg" className="gap-2 dark:bg-[#111b21]" onClick={() => navigate("/tutor/sessions")}>
              View Sessions <ChevronRight size={18} />
            </Button>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute right-20 -bottom-20 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        </div>

        {/* Unified Metrics Strip */}
        <div className="border rounded-xl bg-card dark:bg-[#182329] overflow-hidden grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-border shadow-sm">
          <MetricCell icon={<Users size={18} />} label="Active Students" value={stats.activeStudents} />
          <MetricCell icon={<CalendarDays size={18} />} label="Upcoming" value={stats.upcoming} />
          <MetricCell icon={<Clock size={18} />} label="Completed" value={stats.completed} />
          <MetricCell icon={<ClipboardCheck size={18} />} label="To Review" value={stats.pendingReviews} highlight={stats.pendingReviews > 0} />
          <button onClick={() => navigate("/tutor/earnings")} className="text-left block h-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">
            <MetricCell icon={<Wallet size={18} />} label="Earnings" value={`${earnings.toLocaleString()} ${currency}`} />
          </button>
        </div>

        {/* 2-Column Bento Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Quick Actions & Activity */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <ActionCard icon={<CalendarDays size={18} />} label="New Assignment" onClick={() => navigate("/tutor/assignments/new")} />
              <ActionCard icon={<MessageSquare size={18} />} label="Message Student" onClick={() => navigate("/tutor/messages")} />
              <ActionCard icon={<Settings size={18} />} label="Availability" onClick={() => navigate("/tutor/profile")} />
              <ActionCard icon={<Wallet size={18} />} label="Withdraw Funds" onClick={() => navigate("/tutor/earnings")} />
            </div>

            {/* Recent Activity */}
            <Card className="shadow-sm border bg-card dark:bg-[#182329]">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity size={20} className="text-[#1099A1]" /> Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  <ActivityRow text="Bethlehem submitted Math Homework #3" time="2 hours ago" />
                  <ActivityRow text="Eyob booked a new session for tomorrow" time="5 hours ago" />
                  <ActivityRow text="System processed your payout of 1500 ETB" time="Yesterday" />
                </div>
                <div className="p-3 border-t border-border/50 bg-muted/20 text-center">
                  <span className="text-[13px] text-muted-foreground">End of recent activity</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Vertical Agenda */}
          <div className="lg:col-span-1">
            <Card className="shadow-sm h-full flex flex-col border bg-card dark:bg-[#182329]">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="text-[#1099A1]" size={20} /> Today's Agenda
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col">
                <div className="divide-y divide-border/50 flex-1">
                  {upcomingList.length === 0 && !next ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      Your schedule is clear!
                    </div>
                  ) : (
                    <>
                      {/* Emphasize the NEXT session if it exists */}
                      {next && (
                         <div className="p-5 bg-primary/5 border-l-4 border-l-primary relative">
                           <span className="absolute top-3 right-4 text-[10px] font-bold uppercase tracking-wider text-[#1099A1] bg-primary/10 px-2 py-0.5 rounded-full">Next Up</span>
                           <p className="font-semibold text-[15px] pr-16">{next.subject}</p>
                           <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-1">
                             <Clock size={13} /> {formatTime(next.start_time)} ({next.duration_minutes}m)
                           </p>
                           <div className="flex items-center gap-2 mt-3">
                             <img src={next.student_avatar || dicebearUrl(next.student_name || "S")} alt="" className="w-6 h-6 rounded-full" />
                             <span className="text-[13px]">{next.student_name}</span>
                           </div>
                           <Button className="w-full mt-4 gap-2 bg-[#1099A1] hover:bg-[#0d848b] text-white" size="sm" onClick={() => join(next)}>
                             <Video size={15} /> Join Meeting
                           </Button>
                         </div>
                      )}
                      {upcomingList.slice(0, 5).map(s => (
                        <div key={s.id} className="p-4 hover:bg-muted/20 transition-colors">
                           <p className="font-medium text-[14px]">{s.subject}</p>
                           <p className="text-[12px] text-muted-foreground flex items-center gap-1.5 mt-1">
                             <CalendarDays size={12} /> {formatDay(s.date)}, {formatTime(s.start_time)}
                           </p>
                           <div className="flex items-center gap-2 mt-2">
                             <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                               {s.student_name?.[0] || '?'}
                             </div>
                             <span className="text-[12px] text-muted-foreground">{s.student_name || 'Unknown'}</span>
                           </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <Button variant="ghost" className="rounded-none border-t border-border/50 text-muted-foreground hover:text-primary w-full h-12" onClick={() => navigate("/tutor/sessions")}>
                  View full schedule
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function MetricCell({ icon, label, value, highlight, accent }: { icon: React.ReactNode; label: string; value: number | string; highlight?: boolean; accent?: boolean }) {
  const alert = highlight && Number(value) > 0;
  return (
    <div className={cn("group flex flex-col p-5 transition-colors h-full relative", accent ? "bg-[#1099A1] hover:bg-[#0d848b]" : "hover:bg-muted/30")}>
      {alert && <div className="absolute top-0 left-0 w-full h-[3px] bg-[#CAA25F]" />}
      <div className={cn("flex items-center gap-2 mb-3 transition-colors", accent ? "text-white/80 group-hover:text-white" : "text-muted-foreground group-hover:text-primary")}>
        <div className={cn(alert ? "text-[#CAA25F]" : "")}>
          {icon}
        </div>
        <p className="text-[13px] font-medium truncate uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn("text-2xl font-bold leading-none truncate tracking-tight", accent ? "text-white" : "text-foreground")}>{value}</p>
    </div>
  );
}

function ActionCard({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="h-auto py-3 px-4 flex items-center justify-start gap-3 w-full bg-transparent hover:bg-muted/30 shadow-none">
      <div className="text-muted-foreground shrink-0">{icon}</div>
      <span className="font-medium text-[13px]">{label}</span>
    </Button>
  );
}

function ActivityRow({ text, time }: { text: string, time: string }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
        <p className="text-[14px] text-foreground">{text}</p>
      </div>
      <span className="text-[12px] text-muted-foreground shrink-0">{time}</span>
    </div>
  );
}
