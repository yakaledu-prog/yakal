import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartCard } from "@/components/feature/ChartCard";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Video, Clock, Users, ClipboardCheck, CalendarDays, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
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

  const { today, next, stats, weekly } = data;

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

        {/* Stat row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Users size={18} />} label="Active Students" value={stats.activeStudents} />
          <StatCard icon={<CalendarDays size={18} />} label="Upcoming" value={stats.upcoming} />
          <StatCard icon={<Clock size={18} />} label="Completed" value={stats.completed} />
          <StatCard icon={<ClipboardCheck size={18} />} label="To Review" value={stats.pendingReviews} highlight={stats.pendingReviews > 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Next session */}
            <Card className="border-l-4 border-l-primary shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="text-primary" size={20} /> Next Session
                </CardTitle>
              </CardHeader>
              <CardContent>
                {next ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{next.subject}</h3>
                      <p className="text-muted-foreground flex items-center gap-2 text-sm mb-2">
                        <Clock size={15} /> {formatDay(next.date)}, {formatTime(next.start_time)} · {next.duration_minutes} min
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <img src={next.student_avatar || dicebearUrl(next.student_name || "S")} alt="" className="h-6 w-6 rounded-full object-cover" />
                        <span className="font-medium">{next.student_name}</span>
                      </div>
                    </div>
                    <Button className="gap-2 bg-[#1099A1] hover:bg-[#0d848b] text-white shrink-0" onClick={() => join(next)}>
                      <Video size={18} /> Join Meeting
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No upcoming sessions.</p>
                )}
              </CardContent>
            </Card>

            <ChartCard title="Sessions this week" data={weekly} dataKey="sessions" xAxisKey="name" />
          </div>

          {/* Today's schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="text-primary" size={20} /> Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {today.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nothing scheduled today.</p>
              ) : (
                today.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{s.subject}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock size={12} /> {formatTime(s.start_time)} · {s.student_name}
                      </p>
                    </div>
                    <Button size="sm" className="h-8 gap-1.5 bg-[#1099A1] hover:bg-[#0d848b] text-white shrink-0" onClick={() => join(s)}>
                      <Video size={13} /> Join
                    </Button>
                  </div>
                ))
              )}
              <Button variant="secondary" className="w-full mt-1 text-xs border-none bg-muted/50" onClick={() => navigate("/tutor/calendar")}>
                Open Calendar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight && value > 0 ? "border-[#CAA25F]/40" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground truncate">{label}</p>
            <p className="text-3xl font-bold mt-1 leading-none">{value}</p>
          </div>
          <div className={`shrink-0 p-2.5 rounded-xl ${highlight && value > 0 ? "bg-[#CAA25F]/15 text-[#CAA25F]" : "bg-primary/10 text-primary"}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
