import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Clock, CalendarDays, MessagesSquareIcon, Settings, BadgeDollarSignIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getParentDashboard } from "@/services/parentService";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";

export function ParentHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["parent-dashboard", user?.id],
    queryFn: () => getParentDashboard(user!.id),
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

  const firstName = profile?.full_name?.split(" ")[0] || "Parent";
  const next = data.upcoming[0] ?? null;

  /** "Today", "Tomorrow", or the weekday. Nothing here is a fixed string. */
  const whenLabel = (d: Date) => {
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (sameDay) return `Today, ${time}`;
    if (isTomorrow) return `Tomorrow, ${time}`;
    return `${d.toLocaleDateString(undefined, { weekday: "long" })}, ${time}`;
  };

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
                {/* A real line when there is one, a welcome when there is
                    not. A new parent has no children, no sessions and no
                    homework, so anything derived would read as an empty
                    dashboard on their first visit; an established one would
                    rather know their child is on in an hour than be greeted
                    again. */}
                <p className="text-white/80 text-[15px]">
                  {next
                    ? `${next.childName.split(" ")[0]} has ${next.subject} ${whenLabel(next.startsAt).toLowerCase()}.`
                    : data.childCount === 0
                      ? "Invite your children to get started, then choose the tutoring or counselling they need."
                      : "Nothing booked at the moment. Browse courses or counselling whenever you are ready."}
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
              <IntegratedStat label="Enrolled Courses" value={String(data.enrolledCourses)} />
              <IntegratedStat label="My Children" value={String(data.childCount)} />
              <IntegratedStat
                label="New Messages"
                value={String(data.unreadMessages)}
                alert={data.unreadMessages > 0}
              />

              <div className="flex flex-col cursor-default opacity-80">
                <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1">Upcoming Classes</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold">{data.upcomingSessions}</p>
                  <Sparkline />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Content Below Banner (Borderless, Typography Driven) */}
        <div className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">

          {/* Left: Recent Activity Feed */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground"><BadgeDollarSignIcon size={20} className="text-[#1099A1]" /> Recent payments</h2>
            </div>
            <div className="space-y-0">
              {data.recentPayments.length === 0 ? (
                <p className="py-6 text-[14px] text-muted-foreground">
                  No payments yet. Courses and counselling plans appear here once they are bought.
                </p>
              ) : (
                data.recentPayments.map((p) => (
                  <FeedItem
                    key={p.id}
                    text={`${p.description}${p.childName ? ` for ${p.childName.split(" ")[0]}` : ""}`}
                    time={money(p.amountCents)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: Vertical Agenda */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-semibold flex items-center gap-2 text-foreground"><CalendarDays size={20} className="text-[#1099A1]" /> Children's Agenda</h2>
              <button onClick={() => navigate("/parent/children")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View children</button>
            </div>

            <div className="space-y-6">
              {data.upcoming.length === 0 && data.dueSoon.length === 0 ? (
                <p className="text-muted-foreground text-[14px]">The schedule is clear.</p>
              ) : (
                <>
                  {data.upcoming.map((sess, i) => (
                    <div
                      key={sess.id}
                      className={cn(
                        "relative border-l-2 pl-6",
                        i === 0 ? "border-[#1099A1]" : "border-border/50"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute rounded-full",
                          i === 0
                            ? "-left-[7px] top-1.5 h-3 w-3 bg-[#1099A1] shadow-[0_0_0_4px_rgba(16,153,161,0.2)]"
                            : "-left-[5px] top-1.5 h-2 w-2 bg-border"
                        )}
                      />
                      {/* Named, because a parent with two children needs to
                          know whose hour this is before anything else. */}
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#1099A1]">
                        {i === 0 ? `Next up for ${sess.childName.split(" ")[0]}` : sess.childName.split(" ")[0]}
                      </span>
                      <p className="text-[16px] font-semibold text-foreground">{sess.subject}</p>
                      <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Clock size={14} /> {whenLabel(sess.startsAt)}
                      </div>
                      {sess.tutorName && (
                        <div className="mt-4 flex items-center gap-2">
                          <img
                            src={sess.tutorAvatarUrl || dicebearUrl(sess.tutorName)}
                            alt=""
                            className="h-6 w-6 rounded-full ring-2 ring-secondary"
                          />
                          <span className="text-[13px] font-medium text-foreground">
                            {sess.tutorName}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}

                  {data.dueSoon.map((t) => (
                    <div key={t.id} className="relative border-l-2 border-border/50 pl-6">
                      <div className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-border" />
                      <p className="text-[15px] font-medium text-foreground">
                        {t.title} ({t.childName.split(" ")[0]})
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-[13px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays size={13} /> {t.dueDate ?? "No due date"}
                        </span>
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
        <div className="hidden md:block lg:block w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-[#1099A1] transition-colors" />
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
