import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, CreditCard, ExternalLink, Loader2, X } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { getLinkedChildren } from "@/services/parentService";
import { getBilling, type CoursePackage } from "@/services/packageService";
import {
  confirmCheckout,
  getCustomerPortalUrl,
  getPaymentMethods,
  money,
  startCheckout,
  type SavedCard,
} from "@/services/billingService";
import {
  bookAdvisingSlots,
  cancelAdvisingSession,
  getAdmissionsPlans,
  getAdmissionsUsage,
  getAdvisingSessions,
  getPlanPeople,
  quotaLabel,
  type AdmissionsPlan,
} from "@/services/admissionsService";
import { StackedAvatars } from "@/components/shared/StackedAvatars";
import { AvailabilityPicker, type PickedSlot } from "@/components/shared/AvailabilityPicker";
import { BillingHeader, ChildSidebar, Empty, Money, Spinner } from "./billing/shared";

// ============================================================
// Billing.
//
// A parent arrives with one of three separate questions, and the old page
// mixed all three into one column:
//
//   Plans     what is my child on and how far through it are they
//   Payments  what have I been charged
//   Methods   which card pays for it
//
// Tabs keep each answer whole, and the sidebar scopes all three to one child.
//
// There is no add-slots or go-monthly here. Slots are chosen on the course
// page, against the tutor's calendar, because that is where you can see what
// is free. A button here would only send you there.
// ============================================================

const TABS = [
  { id: "plans", label: "Plans" },
  { id: "payments", label: "Payments" },
  { id: "methods", label: "Payment methods" },
] as const;

/** The dot colours match the card outlines, so the filter names what it filters. */
const SERVICE_FILTERS = [
  { id: "all", label: "All", dot: null as string | null },
  { id: "counselling", label: "Counselling", dot: "#1099A1" },
  { id: "tutoring", label: "Tutoring", dot: "#CAA25F" },
] as const;

type ServiceFilter = (typeof SERVICE_FILTERS)[number]["id"];

export function ParentBilling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [childId, setChildId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("plans");
  const [service, setService] = useState<ServiceFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["billing", user?.id],
    queryFn: () => getBilling(user!.id),
    enabled: !!user?.id,
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["payment-methods", user?.id],
    queryFn: () => getPaymentMethods(),
    enabled: !!user?.id,
  });

  const packages = useMemo(
    () => (data?.packages ?? []).filter((p) => !childId || p.studentId === childId),
    [data, childId]
  );
  const invoices = useMemo(
    () => (data?.invoices ?? []).filter((i) => !childId || i.studentId === childId),
    [data, childId]
  );

  // College counselling is bought as a tier rather than as sessions, so it is
  // not a package. It belongs on this tab all the same: it is a thing they pay
  // for, and Plans is where a parent looks for those.
  const studentIds = children.map((c) => c.id);
  const { data: admissionsByStudent } = useQuery({
    queryKey: ["admissions-plans", studentIds.join(",")],
    queryFn: () => getAdmissionsPlans(studentIds),
    enabled: studentIds.length > 0,
  });

  const admissionsPlans = useMemo(
    () =>
      [...(admissionsByStudent?.values() ?? [])].filter(
        (p) => !childId || p.studentId === childId
      ),
    [admissionsByStudent, childId]
  );

  const countFor = (id: string | null) =>
    (data?.packages ?? []).filter((p) => !id || p.studentId === id).length +
    [...(admissionsByStudent?.values() ?? [])].filter((p) => !id || p.studentId === id).length;

  // Both stats count everything on the tab, not only the course packages, or
  // the header disagrees with the list underneath it.
  const paidTotal =
    packages.reduce((n, p) => n + p.totalPaidCents, 0) +
    admissionsPlans.reduce((n, p) => n + p.tier.priceCents, 0);
  const planCount = packages.length + admissionsPlans.length;
  const open = invoices.filter((i) => i.status === "open");
  const dueCents = open.reduce((n, i) => n + i.amountCents, 0);

  // Coming back from Stripe Checkout. The webhook is the backstop; confirming
  // on return is what makes the page correct before the parent has to reload.
  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      const sessionId = searchParams.get("session_id");
      (async () => {
        if (sessionId) await confirmCheckout(sessionId);
        toast.success("Payment received, thank you.");
        qc.invalidateQueries({ queryKey: ["billing", user?.id] });
        qc.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
        // Counselling is a separate query from the course packages, so it was
        // left holding the answer from before the payment: a parent came back
        // from Stripe and their new plan was not there until they reloaded.
        qc.invalidateQueries({ queryKey: ["admissions-plans"] });
        qc.invalidateQueries({ queryKey: ["admissions-usage"] });
      })();
      searchParams.delete("paid");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("canceled") === "1") {
      toast("Checkout canceled, no charge was made.");
      searchParams.delete("canceled");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function pay(ids: string[], key: string) {
    if (ids.length === 0) return;
    setBusy(key);
    const { error } = await startCheckout(ids);
    if (error) {
      toast.error(error);
      setBusy(null);
    }
  }

  // Open the tab synchronously, before the await, or a popup blocker eats it.
  async function portal() {
    const w = window.open("", "_blank");
    setBusy("portal");
    const { url, error } = await getCustomerPortalUrl();
    setBusy(null);
    if (error || !url) {
      w?.close();
      toast.error(error || "Could not open the billing portal.");
      return;
    }
    if (w) w.location.href = url;
    else window.open(url, "_blank");
  }

  const stats: { label: string; value: string | number }[] = [
    { label: "Plans", value: planCount },
    { label: "Paid to date", value: money(paidTotal) },
  ];
  if (dueCents > 0) stats.unshift({ label: "Due now", value: money(dueCents) });

  return (
    <PageWrapper className="!p-0">
      {/* Header, then the children, then the content. On a phone the rail
          used to sit above the page title, so the first thing you read was a
          list of names with no heading explaining what they were a list of.
          A grid keeps one DOM order and moves the rail into its own column at
          md, rather than rendering it twice. */}
      <div className="grid h-full min-h-0 grid-cols-1 overflow-y-auto bg-background md:grid-cols-[300px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden">
        <div className="md:order-2 md:col-start-2 md:row-start-1">
          <BillingHeader
            subtitle={
              childId
                ? (children.find((c) => c.id === childId)?.full_name ?? "")
                : "Everything across your children"
            }
            stats={stats}
          >
            <nav className="mt-6 flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "whitespace-nowrap border-b-[3px] px-4 py-3 text-[14px] transition-colors",
                    tab === t.id
                      ? "border-white font-semibold text-white"
                      : "border-transparent text-white/60 hover:text-white"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </BillingHeader>
        </div>

        <div className="md:order-1 md:col-start-1 md:row-span-2 md:h-full md:overflow-y-auto md:border-r md:border-border">
          <ChildSidebar
            children={children}
            activeId={childId}
            onSelect={setChildId}
            countFor={countFor}
          />
        </div>

        <div className="p-6 md:order-3 md:col-start-2 md:row-start-2 md:h-full md:overflow-y-auto">
            {isLoading ? (
              <Spinner />
            ) : tab === "plans" ? (
              packages.length === 0 && admissionsPlans.length === 0 ? (
                <Empty
                  title="No plans yet"
                  body="A plan appears here once you book a course or start college counselling for one of your children."
                />
              ) : (
                <div className="space-y-3">
                  {/* Only worth offering when there is something to sift. With
                      one of each it is three buttons standing over two rows. */}
                  {admissionsPlans.length > 0 && packages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-1">
                      {SERVICE_FILTERS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setService(f.id)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
                            service === f.id
                              ? "border-transparent bg-foreground text-background"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {f.dot && (
                            <span
                              className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                              style={{ backgroundColor: f.dot }}
                            />
                          )}
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {service !== "tutoring" &&
                    admissionsPlans.map((p) => <AdmissionsCard key={p.id} plan={p} />)}
                  {service !== "counselling" &&
                    packages.map((p) => (
                      <PlanCard key={`${p.courseId}|${p.studentId}`} pkg={p} />
                    ))}
                </div>
              )
            ) : tab === "payments" ? (
              invoices.length === 0 ? (
                <Empty title="Nothing yet" body="Payments appear here once you have made one." />
              ) : (
                <ul className="divide-y divide-border">
                  {invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-foreground">{i.description}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {i.studentName ?? "You"}
                          {" - "}
                          {new Date(i.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[12.5px] font-medium capitalize",
                          i.status === "paid"
                            ? "text-[#1099A1]"
                            : "text-[#8a6a2a] dark:text-[#CAA25F]"
                        )}
                      >
                        {i.status}
                      </span>
                      <span className="w-24 text-right text-[14px] text-foreground">
                        <Money cents={i.amountCents} />
                      </span>
                      {i.status === "open" && (
                        <Button
                          size="sm"
                          onClick={() => pay([i.id], i.id)}
                          disabled={busy !== null}
                          className="h-8 shrink-0 bg-[#1099A1] px-4 text-[12px] text-white hover:bg-[#0d7f86]"
                        >
                          {busy === i.id ? <Loader2 size={14} className="animate-spin" /> : "Pay"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <Methods cards={cards} isLoading={cardsLoading} busy={busy} onPortal={portal} />
            )}
        </div>
      </div>
    </PageWrapper>
  );
}

/**
 * One course, for one child, with the tutor teaching it.
 *
 * It used to say "3 of 3 sessions still to come" and "0 completed" side by
 * side, which is the same fact told twice and subtracted once. How far through
 * they are is the only part worth reading, so that is all it says now.
 */
function PlanCard({ pkg }: { pkg: CoursePackage }) {
  const total = Math.max(pkg.slotsPurchased, 1);
  const done = (pkg.slotsCompleted / total) * 100;

  return (
    // Gold for tutoring, teal for counselling. One glance says which of the two
    // services a row belongs to, which a list mixing both otherwise does not.
    <article className="rounded-xl border border-[#CAA25F] bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <StackedAvatars
            className="pt-0.5"
            people={[
              { id: pkg.studentId, name: pkg.studentName, avatarUrl: pkg.studentAvatarUrl },
              pkg.tutorName
                ? { id: pkg.tutorId ?? undefined, name: pkg.tutorName, avatarUrl: pkg.tutorAvatarUrl }
                : null,
            ]}
          />
          <div className="min-w-0">
            <h3 className="text-[16px] font-medium text-foreground">{pkg.courseTitle}</h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {pkg.studentName}
              {pkg.tutorName && ` with ${pkg.tutorName}`}
            </p>
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground">
          <Money cents={pkg.totalPaidCents} /> paid
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[13px] text-foreground">
          <span className="text-[18px] font-medium">{pkg.slotsCompleted}</span>
          <span className="text-muted-foreground">
            {" "}
            of {pkg.slotsPurchased} sessions completed
          </span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${done}%`,
              backgroundImage: "linear-gradient(90deg, #1099A1 0%, #CAA25F 100%)",
            }}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * College counselling.
 *
 * Shows what the tier includes and how much of it has gone. The numbers are
 * there so a parent can see where they stand before asking for one more round,
 * not because anything is about to be cut off.
 */
function AdmissionsCard({ plan }: { plan: AdmissionsPlan }) {
  const [booking, setBooking] = useState(false);
  const { data: usage } = useQuery({
    queryKey: ["admissions-usage", plan.studentId],
    queryFn: () => getAdmissionsUsage(plan.studentId),
  });
  const { data: people } = useQuery({
    queryKey: ["plan-people", plan.studentId],
    queryFn: () => getPlanPeople(plan.studentId),
  });

  // The advising line is the only one a parent can act on from here, so it is
  // what decides whether there is a button and what it says.
  const advising = usage?.lines.find((l) => l.label.startsWith("Advising"));
  const remaining =
    advising == null ? 0 : advising.limit == null ? Infinity : advising.limit - advising.used;
  const hasBooked = (advising?.used ?? 0) > 0;

  return (
    <article className="rounded-xl border border-[#1099A1] bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <StackedAvatars
            className="pt-0.5"
            people={[
              people?.student && {
                id: people.student.id,
                name: people.student.fullName,
                avatarUrl: people.student.avatarUrl,
              },
              people?.counselor && {
                id: people.counselor.id,
                name: people.counselor.fullName,
                avatarUrl: people.counselor.avatarUrl,
              },
            ]}
          />
          <div className="min-w-0">
            <h3 className="text-[16px] font-medium text-foreground">
              {plan.tier.name} college counselling
            </h3>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {plan.studentName}
              {people?.counselor ? ` with ${people.counselor.fullName}` : ""}
              {" - since "}
              {new Date(plan.startedAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground">
          <Money cents={plan.tier.priceCents} /> paid
        </p>
      </div>

      {usage && usage.lines.length > 0 && (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-3">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            {usage.lines.map((l) => (
              <div key={l.label}>
                <dt className="text-[12px] text-muted-foreground">{l.label}</dt>
                <dd className="text-[14px] text-foreground">
                  {quotaLabel(l)}
                  {l.limit == null && (
                    <span className="text-muted-foreground"> - no limit</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {advising && (
            // Enabled whenever there is something to do: hours left to book, or
            // hours already booked that can be given back and taken elsewhere.
            // Disabling it the moment the allowance is spent killed it exactly
            // when somebody wants to move an hour.
            <Button
              onClick={() => setBooking(true)}
              disabled={remaining <= 0 && !hasBooked}
              className="h-9 shrink-0 gap-2 bg-[#1099A1] px-4 text-[13px] font-medium text-white hover:bg-[#0d848b] disabled:opacity-50"
            >
              <CalendarPlus size={15} />
              {hasBooked ? "Change slots" : "Choose slots"}
              {remaining !== Infinity && ` (${Math.max(0, remaining)})`}
            </Button>
          )}
        </div>
      )}

      {booking && (
        <BookAdvisingDialog
          plan={plan}
          remaining={remaining === Infinity ? 99 : remaining}
          onClose={() => setBooking(false)}
        />
      )}
    </article>
  );
}

/**
 * Picking advising hours from the counsellor's calendar.
 *
 * Deliberately not part of checkout. Payment and the calendar are separate
 * problems: a card that fails would otherwise leave hours held, and by the
 * time anyone is here the counsellor is already assigned, so there is exactly
 * one calendar to draw.
 *
 * The cap below is a courtesy, not the rule. book_advising_session enforces
 * the allowance, the counsellor's other bookings and who may book for whom,
 * and it is the only thing that can: a parent has no insert on sessions.
 */
function BookAdvisingDialog({
  plan,
  remaining,
  onClose,
}: {
  plan: AdmissionsPlan;
  remaining: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<PickedSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  const { data: people, isLoading } = useQuery({
    queryKey: ["plan-people", plan.studentId],
    queryFn: () => getPlanPeople(plan.studentId),
  });
  const counselorId = people?.counselor?.id ?? null;

  const { data: booked = [] } = useQuery({
    queryKey: ["advising-sessions", plan.studentId],
    queryFn: () => getAdvisingSessions(plan.studentId),
  });

  async function release(sessionId: string) {
    setReleasing(sessionId);
    const { error } = await cancelAdvisingSession(sessionId);
    setReleasing(null);
    if (error) return toast.error(error);
    toast.success("That hour is free again.");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["advising-sessions", plan.studentId] }),
      qc.invalidateQueries({ queryKey: ["admissions-usage", plan.studentId] }),
      qc.invalidateQueries({ queryKey: ["slot-conflicts"] }),
    ]);
  }

  function toggle(slot: PickedSlot) {
    setPicked((prev) => {
      const on = prev.some((s) => s.key === slot.key);
      if (on) return prev.filter((s) => s.key !== slot.key);
      if (prev.length >= remaining) {
        toast.error(
          remaining === 1
            ? "One hour left this month."
            : `Only ${remaining} hours left this month.`
        );
        return prev;
      }
      return [...prev, slot];
    });
  }

  async function confirm() {
    if (picked.length === 0) return;
    setSaving(true);
    const { booked: madeCount, errors } = await bookAdvisingSlots(
      plan.studentId,
      picked.map((s) => ({ date: s.date, startTime: s.startTime, durationMinutes: 60 }))
    );
    setSaving(false);

    if (madeCount > 0) {
      toast.success(`${madeCount} ${madeCount === 1 ? "session" : "sessions"} booked.`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admissions-usage", plan.studentId] }),
        qc.invalidateQueries({ queryKey: ["advising-sessions", plan.studentId] }),
        qc.invalidateQueries({ queryKey: ["slot-conflicts"] }),
      ]);
    }
    // Reported rather than swallowed: an hour taken while this was open is the
    // one thing a parent needs to hear about, and the rest still landed.
    for (const message of errors) toast.error(message);
    if (errors.length === 0) onClose();
    else setPicked([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-foreground">Choose advising slots</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              For {plan.studentName}. {remaining} {remaining === 1 ? "hour" : "hours"} left
              this month.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* What is already booked, and the way to give one back. Without
              this the dialog can only ever add, so a family whose allowance is
              spent has no way to move an hour. */}
          {booked.length > 0 && (
            <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
              <p className="mb-2 text-[13px] font-medium text-foreground">Booked this month</p>
              <ul className="space-y-1.5">
                {booked.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">
                      {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {" at "}
                      {session.startTime}
                    </span>
                    {session.status === "upcoming" ? (
                      <button
                        type="button"
                        onClick={() => void release(session.id)}
                        disabled={releasing === session.id}
                        className="text-[12.5px] font-medium text-[#1099A1] transition-opacity hover:underline disabled:opacity-50"
                      >
                        {releasing === session.id ? "Releasing..." : "Release"}
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-muted-foreground">Done</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-[#1099A1]" size={22} />
            </div>
          ) : !counselorId ? (
            <p className="py-12 text-center text-[14px] text-muted-foreground">
              No counsellor has been assigned yet. This usually sorts itself out within a
              day; get in touch if it does not.
            </p>
          ) : (
            <AvailabilityPicker
              tutorId={counselorId}
              studentId={plan.studentId}
              selected={picked}
              onToggle={toggle}
              multiple
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 p-5">
          <Button variant="outline" onClick={onClose} className="h-10 px-5">
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={picked.length === 0 || saving}
            className="h-10 bg-[#1099A1] px-5 font-medium text-white hover:bg-[#0d848b] disabled:opacity-50"
          >
            {saving
              ? "Booking..."
              : picked.length === 0
                ? "Book"
                : `Book ${picked.length} ${picked.length === 1 ? "session" : "sessions"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Methods({
  cards,
  isLoading,
  busy,
  onPortal,
}: {
  cards: SavedCard[];
  isLoading: boolean;
  busy: string | null;
  onPortal: () => void;
}) {
  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-xl space-y-4">
      {cards.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted/40 text-muted-foreground">
            <CreditCard size={18} />
          </span>
          <div>
            <p className="text-[14px] font-medium text-foreground">No card on file</p>
            <p className="text-[12.5px] text-muted-foreground">
              Your first card is saved when you pay for a course.
            </p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {cards.map((card) => (
            <li key={card.id} className="flex items-center gap-3 p-4">
              <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-[10px] font-bold uppercase text-muted-foreground">
                {card.brand}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                  <span className="capitalize">{card.brand}</span> ....{card.last4}
                  {card.isDefault && (
                    <span className="text-[11.5px] font-medium text-[#1099A1]">Default</span>
                  )}
                </p>
                {card.exp_month && card.exp_year && (
                  <p className="text-[12px] text-muted-foreground">
                    Expires {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button
        onClick={onPortal}
        disabled={busy !== null}
        variant="outline"
        className="flex w-full items-center justify-center gap-2 border border-primary text-[14px] font-semibold text-primary"
      >
        {busy === "portal" ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            {cards.length ? "Manage payment methods" : "Add payment method"}
            <ExternalLink size={14} />
          </>
        )}
      </Button>

      <p className="text-[12px] text-muted-foreground">
        Cards are held by Stripe, never by us. The portal opens in a new tab and can add, remove
        or change which one is default.
      </p>
    </div>
  );
}
