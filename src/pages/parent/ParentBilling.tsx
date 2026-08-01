import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
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
  getAdmissionsPlans,
  getAdmissionsUsage,
  quotaLabel,
  type AdmissionsPlan,
} from "@/services/admissionsService";
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

export function ParentBilling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [childId, setChildId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("plans");
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
      <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background md:flex-row md:overflow-hidden">
        <ChildSidebar
          children={children}
          activeId={childId}
          onSelect={setChildId}
          countFor={countFor}
        />

        <section className="min-w-0 flex-1 md:h-full md:overflow-y-auto">
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

          <div className="p-6">
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
                  {admissionsPlans.map((p) => (
                    <AdmissionsCard key={p.id} plan={p} />
                  ))}
                  {packages.map((p) => (
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
        </section>
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
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <img
            src={pkg.tutorAvatarUrl || dicebearUrl(pkg.tutorName ?? pkg.courseTitle)}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover"
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
          <div className="h-full bg-[#1099A1]" style={{ width: `${done}%` }} />
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
  const { data: usage } = useQuery({
    queryKey: ["admissions-usage", plan.studentId],
    queryFn: () => getAdmissionsUsage(plan.studentId),
  });

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[16px] font-medium text-foreground">
            {plan.tier.name} college counselling
          </h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {plan.studentName}
            {" - since "}
            {new Date(plan.startedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <p className="text-[13px] text-muted-foreground">
          <Money cents={plan.tier.priceCents} /> paid
        </p>
      </div>

      {usage && usage.lines.length > 0 && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-3">
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
      )}
    </article>
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
