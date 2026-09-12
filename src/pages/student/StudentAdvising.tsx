import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { SessionsBanner } from "@/components/shared/SessionsBanner";
import { cn } from "@/utils/cn";

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

  /**
   * The balance, and one colour for the whole strip.
   *
   * "0 of 1 hours" made a student do the subtraction before they knew whether
   * they could book, and a sentence is a poor way to show a countable balance.
   * Monthly allowances here are one to eight hours, which is few enough to
   * draw: a pip per hour, filled for the ones spent, so what is left can be
   * counted rather than read.
   *
   * Gold on the last hour, because that is the one worth spending carefully.
   * Red when there are none: nothing is wrong, but the answer to "can I book"
   * is no until the month turns.
   */
  const tone =
    allowance == null
      ? null
      : left == null
        ? { rule: "border-primary", wash: "bg-primary/5", pip: "bg-primary", text: "text-primary", button: "bg-primary hover:bg-primary-hover text-white" }
        : left <= 0
          ? { rule: "border-[#d4183d]", wash: "bg-[#d4183d]/5", pip: "bg-[#d4183d]", text: "text-[#d4183d]", button: "bg-[#d4183d] text-white" }
          : left === 1
            ? { rule: "border-secondary", wash: "bg-secondary/10", pip: "bg-secondary", text: "text-secondary", button: "bg-secondary text-secondary-foreground hover:opacity-90" }
            : { rule: "border-primary", wash: "bg-primary/5", pip: "bg-primary", text: "text-primary", button: "bg-primary hover:bg-primary-hover text-white" };

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
              its own. The balance is the whole of the decision, so the button
              belongs beside that sentence, and a full-height card would spend
              a third of the page on one button and one number. */}
          {tone && allowance ? (
            <div
              className={cn(
                "mb-6 flex flex-wrap items-center justify-between gap-4 border-l-2 px-5 py-4",
                tone.rule,
                tone.wash
              )}
            >
              {/* The number and what it counts. The sentence it replaced made
                  a student do the subtraction, and a pip per hour was a
                  drawing of a figure already on the screen. */}
              <div>
                <p className={cn("text-2xl font-bold leading-none tabular-nums", tone.text)}>
                  {left == null ? "Unlimited" : `${left}/${allowance.limit}`}
                </p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  {left == null
                    ? "advising hours"
                    : left === 0
                      ? "hours left, back on the 1st"
                      : `${left === 1 ? "hour" : "hours"} left`}
                </p>
              </div>

              {/* Either the student or a linked parent can book: the family
                  function book_advising_session authorises both, so the student
                  arranges their own hours here rather than being sent to a
                  parent's billing page for a plan that may be their own. */}
              <button
                type="button"
                onClick={() => setBooking(true)}
                disabled={!canBook}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-5 text-[14px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60",
                  tone.button
                )}
              >
                <CalendarDays size={15} /> Book a session
              </button>
            </div>
          ) : (
            <p className="mb-6 text-[13px] text-muted-foreground">
              Counselling is not on this account.
            </p>
          )}

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
