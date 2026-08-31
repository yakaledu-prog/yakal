import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import {
  PastSessions,
  UpcomingSessions,
  type SessionListItem,
} from "@/components/shared/SessionList";
import { CancelSessionDialog } from "@/components/shared/CancelSessionDialog";
import { BookAdvisingDialog } from "@/components/shared/BookAdvisingDialog";
import { getAdmissionsUsage } from "@/services/admissionsService";
import { getStudentSessions } from "@/services/sessions";

// ============================================================
// The hours a student gets with their counsellor.
//
// They existed before this page did, as ordinary sessions, and showed up on the
// general Sessions list. That list is locked behind tutoring, so a family who
// had bought counselling and nothing else could not see the hours they were
// paying for anywhere at all.
//
// The allowance belongs here rather than only on the parent's billing page: the
// student is the one deciding whether to book this week, and "two of four" is
// the whole of what they need to know to decide.
// ============================================================

export function StudentAdvising() {
  const { user, profile } = useAuth();
  const [cancelling, setCancelling] = useState<SessionListItem | null>(null);
  const [booking, setBooking] = useState(false);

  const { data: raw, isLoading } = useQuery({
    queryKey: ["student-sessions", user?.id],
    queryFn: () => getStudentSessions(user!.id),
    enabled: !!user?.id,
  });

  const { data: usage } = useQuery({
    queryKey: ["admissions-usage", user?.id],
    queryFn: () => getAdmissionsUsage(user!.id),
    enabled: !!user?.id,
  });

  // Advising only. The rest of a student's timetable is lessons, and mixing the
  // two here would make the allowance beside them look like it counted both.
  const advising: SessionListItem[] = useMemo(
    () =>
      ((raw?.data ?? []) as any[])
        .filter((s) => s.kind === "advising")
        .map((s) => ({
          id: s.id,
          date: s.date,
          startTime: s.start_time,
          durationMinutes: s.duration_minutes,
          status: s.status,
          title: s.subject,
          personName: s.tutor_name ?? null,
          personAvatarUrl: s.tutor_avatar ?? null,
        })),
    [raw]
  );

  const allowance = usage?.lines.find((l) => l.label.startsWith("Advising"));
  const left =
    allowance == null ? null : allowance.limit == null ? null : allowance.limit - allowance.used;

  return (
    <PageWrapper>
      <div className="min-h-screen flex-1 bg-background pb-12 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-primary px-6 pt-6 text-white md:px-10 md:pt-10">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col justify-between gap-6 border-b border-white/20 pb-8 md:flex-row md:items-end">
            <div className="space-y-1">
              <h1 className="mb-2 text-[14px] font-medium uppercase tracking-wider text-white/80">
                Advising
              </h1>
              <span className="text-4xl font-bold tracking-tight md:text-5xl">
                {allowance == null
                  ? "-"
                  : allowance.limit == null
                    ? allowance.used
                    : `${allowance.used} of ${allowance.limit}`}
              </span>
              <p className="pt-1 text-[14px] text-white/70">
                {allowance == null
                  ? "Counselling is not on this account."
                  : allowance.limit == null
                    ? "hours with your counsellor this month, with no ceiling"
                    : "hours with your counsellor this month"}
              </p>
            </div>

            {/* Either the student or a linked parent can book: the family
                function book_advising_session authorises both, so the student
                arranges their own hours here rather than being sent to a
                parent's billing page for a plan that may be their own. */}
            {allowance != null && (
              <div className="pb-2 text-left md:text-right">
                <button
                  onClick={() => setBooking(true)}
                  disabled={left != null && left <= 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CalendarDays size={16} /> Book a session
                </button>
                <p className="mt-1.5 text-[12px] text-white/70">
                  {left != null && left > 0
                    ? `${left} ${left === 1 ? "hour" : "hours"} left this month`
                    : left === 0
                      ? "You have used this month's hours"
                      : "You or your parent can book these"}
                </p>
              </div>
            )}
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] space-y-10 p-6 md:p-10">
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3">
              <CalendarDays size={18} className="text-primary" />
              <h2 className="text-[18px] font-semibold text-foreground">Coming up</h2>
            </div>
            <UpcomingSessions
              sessions={advising}
              isLoading={isLoading}
              emptyText="Nothing booked this month."
              onCancel={setCancelling}
            />
          </section>

          <section className="space-y-4">
            <div className="border-b border-border/50 pb-3">
              <h2 className="text-[18px] font-semibold text-foreground">Been and gone</h2>
            </div>
            <PastSessions sessions={advising} />
          </section>
        </div>
      </div>

      {cancelling && (
        <CancelSessionDialog session={cancelling} onClose={() => setCancelling(null)} />
      )}

      {booking && (
        <BookAdvisingDialog
          studentId={user!.id}
          studentName={profile?.full_name ?? null}
          remaining={left ?? 99}
          onClose={() => setBooking(false)}
        />
      )}
    </PageWrapper>
  );
}
