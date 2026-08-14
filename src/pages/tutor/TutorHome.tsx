import { Skeleton } from "@/components/ui/Skeleton";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { CalendarDays, Wallet, Settings, MessagesSquareIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { UpcomingSessions, type SessionListItem } from "@/components/shared/SessionList";
import { getTutorDashboard, SessionRow } from "@/services/tutorService";
import { getTutorEarnings } from "@/services/payoutService";
import { money } from "@/services/billingService";
import { dicebearUrl } from "@/utils/avatar";

export function TutorHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['tutor-dashboard', profile?.id],
    queryFn: () => getTutorDashboard(profile!.id),
    enabled: !!profile?.id,
  });

  const { data: earningRows = [] } = useQuery({
    queryKey: ['tutor-earnings', profile?.id],
    queryFn: () => getTutorEarnings(profile!.id),
    enabled: !!profile?.id,
  });

  const unclaimed = earningRows.filter((r) => r.payoutStatus === 'none');
  const totals = {
    unclaimed: unclaimed.reduce((n, r) => n + r.amountCents, 0),
    awaiting: earningRows.filter((r) => r.payoutStatus === 'requested').reduce((n, r) => n + r.amountCents, 0),
    paid: earningRows.filter((r) => r.payoutStatus === 'paid').reduce((n, r) => n + r.amountCents, 0),
  };

  if (isLoading || !data) {
    return (
      <PageWrapper>
        <div className="p-8 space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageWrapper>
    );
  }

  const { today, next, upcomingList, stats } = data;

  // Next is the soonest of the upcoming ones, so listing both would show it
  // twice. The shared list sorts and labels them itself.
  const agendaRows: SessionRow[] = [
    ...(next && !upcomingList.some((s) => s.id === next.id) ? [next] : []),
    ...upcomingList,
  ];

  const agendaItems: SessionListItem[] = agendaRows.map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    durationMinutes: s.duration_minutes,
    status: s.status,
    title: s.subject,
    personName: s.student_name ?? null,
    personAvatarUrl: s.student_avatar ?? null,
  }));
  // The banner used to multiply the profile's hourly rate by the completed
  // count and label it ETB, while the earnings page showed the real per
  // session figures in USD. One number, from the ledger, in one currency.
  const totalEarned = totals.unclaimed + totals.awaiting + totals.paid;

  const firstName = profile?.full_name?.split(" ")[0] || "Tutor";

  function join(session: SessionRow) {
    if (session.zoom_meeting_id) {
      navigate(`/tutor/meeting/${session.id}`);
      return;
    }
    const link = session.zoom_link || profile?.zoom_link;
    if (link) window.open(link, "_blank");
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Command Banner */}
        <div className="bg-primary text-white">
          <div className="max-w-[1440px] mx-auto p-6 md:p-10 space-y-8">

            {/* Top row: Welcome + Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="space-y-2">
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-white/70">Teaching Hub</p>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Welcome back, {firstName}!</h1>
                <p className="text-white/80 text-[15px]">
                  {today.length > 0
                    ? `You have ${today.length} session${today.length > 1 ? "s" : ""} scheduled today.`
                    : "You have no sessions scheduled today. Enjoy the breather!"}
                </p>
              </div>

              {/* Toolbar Quick Actions (No cards, just sleek icon buttons) */}
              <div className="flex items-center gap-2 bg-black/10 p-1.5 rounded-lg">
                <TooltipButton icon={<MessagesSquareIcon size={18} />} label="Messages" onClick={() => navigate("/tutor/messages")} />
                <TooltipButton icon={<Settings size={18} />} label="Availability" onClick={() => navigate("/tutor/profile")} />
                <div className="w-px h-6 bg-white/20 mx-2" />
                <TooltipButton icon={<Wallet size={18} />} label="Earnings" onClick={() => navigate("/tutor/earnings")} />
              </div>
            </div>

            {/* Bottom row: Integrated Stats + Sparkline */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-white/20">
              <IntegratedStat label="Active Students" value={stats.activeStudents} />
              <IntegratedStat label="Upcoming" value={stats.upcoming} />
              <IntegratedStat label="To Review" value={stats.pendingReviews} alert={stats.pendingReviews > 0} />

              <div className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity relative" onClick={() => navigate("/tutor/earnings")}>
                <p className="text-white/70 text-[13px] font-medium uppercase tracking-wider mb-1">Earnings</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold">{money(totalEarned)}</p>
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
              <h2 className="text-[18px] font-medium flex items-center gap-2 text-foreground"><Wallet size={20} className="text-primary" /> Earnings</h2>
              <button onClick={() => navigate("/tutor/earnings")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View all</button>
            </div>

            {/* Sessions taught and not yet claimed. Asking to be paid is the
                one step nobody else can do for a tutor, and it was buried a
                page away where a quiet week meant forgetting about it. */}
            <div className="grid grid-cols-3 gap-4 border-b border-border/50 pb-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Not requested</p>
                <p className="mt-1 text-2xl font-bold text-secondary">{money(totals.unclaimed)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Awaiting</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{money(totals.awaiting)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Paid</p>
                <p className="mt-1 text-2xl font-bold text-primary">{money(totals.paid)}</p>
              </div>
            </div>

            {unclaimed.length > 0 && (
              <>
                <div className="divide-y divide-border">
                  {unclaimed.slice(0, 5).map((r) => (
                    <div key={r.sessionId} className="flex items-center gap-4 py-4">
                      <img
                        src={r.studentAvatarUrl || dicebearUrl(r.studentName ?? "Yakal")}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-foreground">{r.subject}</p>
                        <p className="truncate text-[13px] text-muted-foreground">
                          {r.studentName ?? "Student"} ·{" "}
                          {new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span className="shrink-0 text-[14px] font-medium tabular-nums text-foreground">
                        {r.amountCents === 0 ? "-" : money(r.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/tutor/earnings")}
                  className="mt-2 h-11 w-full rounded-md bg-primary text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Request payment for {unclaimed.length}{" "}
                  {unclaimed.length === 1 ? "session" : "sessions"}
                </button>
              </>
            )}
          </div>

          {/* Right: Vertical Agenda */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <h2 className="text-[18px] font-medium flex items-center gap-2 text-foreground"><CalendarDays size={20} className="text-primary" /> Sessions</h2>
              <button onClick={() => navigate("/tutor/sessions")} className="text-[13px] text-muted-foreground hover:text-primary transition-colors">View all</button>
            </div>

            {/* The same rows as the sessions page, stacked so they fit this
                column. An agenda that invents its own layout is a second place
                a session can look different. */}
            <UpcomingSessions
              sessions={agendaItems}
              compact
              limit={6}
              emptyText="Your schedule is clear."
              onJoin={(s) => {
                const row = agendaRows.find((r) => r.id === s.id);
                if (row) join(row);
              }}
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
