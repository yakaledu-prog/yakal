import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { SessionsBanner } from "@/components/shared/SessionsBanner";

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
  const [tab, setTab] = useState("upcoming");

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

  const completed = advising.filter((s) => s.status === "completed").length;
  const upcomingCount = advising.filter((s) => s.status === "upcoming").length;
  const canBook = allowance != null && (left == null || left > 0);

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background pb-12 dark:bg-[#111b21]">
        <SessionsBanner
          title="Advising"
          total={advising.length}
          completed={completed}
          upcoming={upcomingCount}
          tabs={[
            { id: "upcoming", label: "Upcoming" },
            { id: "past", label: "Past Sessions" },
          ]}
          activeTab={tab}
          onTab={setTab}
        />

        <div className="p-4 md:p-8">
          {/* Booking sits with the list rather than in the banner or a card of
              its own. The allowance is the whole of the decision - "two of four
              this month" is what tells a student whether to book at all - and a
              full-height card beside the list would spend a third of the page
              on one button and one number. */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">
              {allowance == null
                ? "Counselling is not on this account."
                : allowance.limit == null
                  ? `${allowance.used} ${allowance.used === 1 ? "hour" : "hours"} with your counsellor this month, with no ceiling`
                  : `${allowance.used} of ${allowance.limit} hours with your counsellor this month`}
            </p>

            {/* Either the student or a linked parent can book: the family
                function book_advising_session authorises both, so the student
                arranges their own hours here rather than being sent to a
                parent's billing page for a plan that may be their own. */}
            {allowance != null && (
              <button
                type="button"
                onClick={() => setBooking(true)}
                disabled={!canBook}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                title={canBook ? undefined : "You have used this month's hours"}
              >
                <CalendarDays size={15} /> Book a session
              </button>
            )}
          </div>

          {tab === "upcoming" ? (
            <UpcomingSessions
              // Whether a lesson is billable is not a student's question.
              showAwaitingConfirmation={false}
              sessions={advising}
              isLoading={isLoading}
              emptyText="Nothing booked yet."
              onCancel={setCancelling}
            />
          ) : (
            <PastSessions
              sessions={advising}
              isLoading={isLoading}
              emptyText="No past sessions."
            />
          )}
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
