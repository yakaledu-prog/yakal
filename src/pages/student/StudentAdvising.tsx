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
   * The hours left are the decision, not the hours used: "0 of 1" makes a
   * student work out the subtraction before they know whether they can book.
   * And the strip says what state it is in the way the earnings one does,
   * with the rule, the wash and the button agreeing rather than a teal button
   * sitting on a grey line whatever the number says.
   *
   * Gold on the last hour, because that is the one worth spending carefully.
   * Red when there are none: nothing is wrong, but the answer to "can I book"
   * is no until the month turns.
   */
  const balance =
    allowance == null
      ? null
      : left == null
        ? {
          text: "You have unlimited hours with your counsellor.",
          rule: "border-primary",
          wash: "bg-primary/5",
          button: "bg-primary hover:bg-primary-hover text-white",
        }
        : left <= 0
          ? {
            text: "No hours left this month. Your allowance resets on the 1st.",
            rule: "border-[#d4183d]",
            wash: "bg-[#d4183d]/5",
            button: "bg-[#d4183d] text-white",
          }
          : left === 1
            ? {
              text: `1 hour left this month, of ${allowance.limit}.`,
              rule: "border-secondary",
              wash: "bg-secondary/10",
              button: "bg-secondary text-secondary-foreground hover:opacity-90",
            }
            : {
              text: `${left} hours left this month, of ${allowance.limit}.`,
              rule: "border-primary",
              wash: "bg-primary/5",
              button: "bg-primary hover:bg-primary-hover text-white",
            };

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
          {balance ? (
            <div
              className={cn(
                "mb-6 flex flex-wrap items-center justify-between gap-4 border-l-2 px-5 py-4",
                balance.rule,
                balance.wash
              )}
            >
              <p className="text-[14px] text-foreground">{balance.text}</p>

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
                  balance.button
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
