import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Check, CreditCard, ExternalLink, Loader2, X, ChevronLeft, ChevronDown, List, LayoutGrid, Plus } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  PlanChangeSummary,
  periodDate,
  usePlanChangePreview,
} from "@/components/billing/PlanChangeSummary";
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
  cancelPlan,
  changePlanTier,
  getAdmissionsPlans,
  getPlanStatus,
  getTiers,
  resumePlan,
  getAdmissionsUsage,
  getAdvisingSessions,
  getPlanPeople,
  quotaLabel,
  type AdmissionsPlan,
} from "@/services/admissionsService";
import { StackedAvatars } from "@/components/shared/StackedAvatars";
import { AvailabilityPicker, type PickedSlot } from "@/components/shared/AvailabilityPicker";
import { BillingHeader, ChildSidebar, Empty, Money, Spinner } from "./billing/shared";
import { useMasterDetail } from "@/hooks/useMasterDetail";

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
// There is no add-slots or go-monthly here, and Add a plan is a link rather
// than a checkout. Tutoring is priced per session against a tutor's calendar
// and counselling is a tier, so both are bought on their own pages, where you
// can see what you are choosing. This page only saves the parent from going
// looking for them.
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

/** The chip's own colour behind its count, the way the testimonial filters do it. */
const tint = (hex: string, alpha = 0.16) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

type ServiceFilter = (typeof SERVICE_FILTERS)[number]["id"];

type StatusFilter = "all" | "active" | "completed";

/**
 * A course is finished when every session bought has happened.
 *
 * Counselling has no equivalent here: getAdmissionsPlans only asks for plans
 * with status 'active', so an ended one never reaches this page and is never
 * something Completed could hide.
 */
const isFinished = (p: CoursePackage) =>
  p.slotsPurchased > 0 && p.slotsCompleted >= p.slotsPurchased;

export function ParentBilling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [childId, setChildId] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("plans");
  const [service, setService] = useState<ServiceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  // Two per row on a wide screen. Only the layout changes: the same card,
  // with its quota lines wrapped rather than strung across one line.
  const [view, setView] = useState<"list" | "grid">("list");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  // One pane at a time on a phone: the children, then the child. The same
  // hook the other master-detail pages use.
  // showDetail rather than listClass/detailClass: those carry `flex`, and a
  // grid child set to display:flex stops stretching to its column, which left
  // the header sized to its own text instead of the full width.
  const { showDetail, openDetail, closeDetail } = useMasterDetail();
  const listClass = showDetail ? "hidden md:block" : "block";
  const detailClass = showDetail ? "block" : "hidden md:block";

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
  // Money a parent can actually do something about. An abandoned checkout is
  // not a debt and should not be totted up as one.
  const open = invoices.filter((i) => i.status === "failed");
  const dueCents = open.reduce((n, i) => n + i.amountCents, 0);

  // The two filters compose in the order they are read: service, then status.
  // Each control counts what reaches it, so the status dropdown never offers a
  // number the list underneath cannot produce.
  const serviceCount: Record<ServiceFilter, number> = {
    all: planCount,
    counselling: admissionsPlans.length,
    tutoring: packages.length,
  };

  const byService = {
    admissions: service === "tutoring" ? [] : admissionsPlans,
    packages: service === "counselling" ? [] : packages,
  };
  const finishedCount = byService.packages.filter(isFinished).length;
  const activeCount =
    byService.admissions.length + byService.packages.length - finishedCount;

  const shownAdmissions = status === "completed" ? [] : byService.admissions;
  const shownPackages = byService.packages.filter((p) =>
    status === "all" ? true : status === "completed" ? isFinished(p) : !isFinished(p)
  );
  const shownCount = shownAdmissions.length + shownPackages.length;

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
      {/* content-start, or a short tab floats. Below md the rows are implicit
          and auto-sized, and a grid distributes its leftover height across
          those, which left a single saved card sitting halfway down the page
          with the header pushed away from it. */}
      <div className="grid h-full min-h-0 grid-cols-1 content-start overflow-y-auto bg-background md:grid-cols-[260px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden">
        <div className={cn("md:order-2 md:col-start-2 md:row-start-1", detailClass)}>
          <BillingHeader
            subtitle={
              childId
                ? (children.find((c) => c.id === childId)?.full_name ?? "")
                : "Everything across your children"
            }
            stats={stats}
            leading={
              <button
                onClick={closeDetail}
                className="mb-2 flex items-center gap-1 text-[13px] text-white/80 transition-colors hover:text-white md:hidden"
              >
                <ChevronLeft size={15} /> Children
              </button>
            }
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

        <div className={cn("md:order-1 md:col-start-1 md:row-span-2 md:h-full md:overflow-y-auto md:border-r md:border-border", listClass)}>
          <ChildSidebar
            children={children}
            activeId={childId}
            onSelect={(id) => {
              setChildId(id);
              openDetail();
            }}
            countFor={countFor}
          />
        </div>

        <div className={cn("p-6 md:order-3 md:col-start-2 md:row-start-2 md:h-full md:overflow-y-auto", detailClass)}>
          {isLoading ? (
            <Spinner />
          ) : tab === "plans" ? (
            planCount === 0 ? (
              <Empty
                title="No plans yet"
                body="A plan appears here once you book a course or start college counselling for one of your children."
                action={<AddPlanMenu childId={childId} />}
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 pb-1">
                  {/* Only worth offering when there is something to sift. With
                        one of each it is three buttons standing over two rows.
                        The count is what makes them worth the width: it says
                        what is behind the filter before you spend a click. */}
                  {admissionsPlans.length > 0 && packages.length > 0 && SERVICE_FILTERS.map((f) => {
                    const on = service === f.id;
                    const count = serviceCount[f.id];
                    return (
                      <button
                        key={f.id}
                        onClick={() => setService(on ? "all" : f.id)}
                        aria-pressed={on}
                        disabled={count === 0 && !on}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors disabled:opacity-40",
                          on ? "font-medium" : "border-border text-muted-foreground hover:text-foreground",
                          // All is the resting state and has no colour of its
                          // own, so it gets a grey ring rather than shouting
                          // louder than a real filter.
                          on && !f.dot && "border-black/25 text-foreground/70 dark:border-white/30"
                        )}
                        style={on && f.dot ? { borderColor: f.dot } : undefined}
                      >
                        {f.dot && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: f.dot }}
                          />
                        )}
                        {f.label}
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-[11px] font-medium",
                            !f.dot && "bg-black/[0.07] text-foreground/70 dark:bg-white/10 dark:text-white/70"
                          )}
                          style={f.dot ? { backgroundColor: tint(f.dot), color: f.dot } : undefined}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}

                  {/* Its own full-width line below md, ends apart, because the
                        chips above have already wrapped and leaving these two
                        huddled against the right edge only looked like the row
                        had run out of room. */}
                  <div className="flex w-full shrink-0 items-center justify-between gap-2 md:ml-auto md:w-auto md:justify-normal">
                    {/* Both of these need more than one card to mean
                          anything, but neither needs one of each service. */}
                    {planCount > 1 && (
                      <>
                        <Dropdown
                          value={status}
                          onChange={setStatus}
                          options={[
                            { value: "all", label: `All (${activeCount + finishedCount})` },
                            { value: "active", label: `Active (${activeCount})` },
                            { value: "completed", label: `Completed (${finishedCount})` },
                          ]}
                          size="sm"
                          ariaLabel="Filter by status"
                          className="w-[140px]"
                          buttonClassName="text-foreground/70"
                        />

                        {/* The same control as the admin lists. Two togglers
                              doing the same job should not look like two
                              different components.

                              Gone below md, where it has nothing to switch: one
                              column is all that fits either way, so the cards
                              just use the denser layout there. */}
                        <div className="hidden rounded-lg border border-[#e9edef] bg-gray-100 p-1 dark:border-[#2a3942] dark:bg-[#182329] md:flex">
                          {([
                            ["list", List, "One per row"],
                            ["grid", LayoutGrid, "Two per row"],
                          ] as const).map(([mode, Icon, title]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setView(mode)}
                              aria-label={title}
                              aria-pressed={view === mode}
                              title={title}
                              className={cn(
                                "rounded-md p-1.5 transition-colors",
                                view === mode
                                  ? "bg-white shadow-sm dark:bg-[#202c33]"
                                  : "text-muted-foreground hover:text-[#111] dark:hover:text-white"
                              )}
                            >
                              <Icon size={18} />
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    <AddPlanMenu childId={childId} />
                  </div>
                </div>

                {shownCount === 0 ? (
                  <p className="py-16 text-center text-[13.5px] text-muted-foreground">
                    Nothing here with those filters.
                  </p>
                ) : (
                  <div
                    className={cn(
                      view === "grid" ? "grid grid-cols-1 gap-3 xl:grid-cols-2" : "space-y-3"
                    )}
                  >
                    {shownAdmissions.map((p) => (
                      <AdmissionsCard key={p.id} plan={p} compact={view === "grid"} />
                    ))}
                    {shownPackages.map((p) => (
                      <PlanCard
                        key={`${p.courseId}|${p.studentId}`}
                        pkg={p}
                        compact={view === "grid"}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          ) : tab === "payments" ? (
            invoices.length === 0 ? (
              <Empty title="Nothing yet" body="Payments appear here once you have made one." />
            ) : (
              // Four columns, in the same place on every row: what it was for,
              // where it got to, how much, and an action only where there is
              // one. The amount used to be followed by a Pay button on some
              // rows and nothing on others, so the figures did not line up with
              // each other down the page.
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

                    {/* Said in words rather than echoing the column. "Open" is
                        a database value; what a parent needs to know is whether
                        anything is expected of them. */}
                    <span
                      className={cn(
                        "hidden w-32 shrink-0 text-right text-[12.5px] font-medium sm:block",
                        i.status === "paid" ? "text-primary" : "text-[#8a6a2a] dark:text-secondary"
                      )}
                    >
                      {i.status === "paid"
                        ? "Paid"
                        : i.status === "failed"
                          ? "Payment failed"
                          : "Not finished"}
                    </span>

                    <span className="w-24 shrink-0 text-right text-[14px] tabular-nums text-foreground">
                      <Money cents={i.amountCents} />
                    </span>

                    {/* Only a declined card is worth a button. Everything else
                        on this page has either happened or been abandoned, and
                        a Pay button beside a payment that already went through
                        is an invitation to pay twice. */}
                    <span className="flex w-20 shrink-0 justify-end">
                      {i.status === "failed" && (
                        <Button
                          size="sm"
                          onClick={() => pay([i.id], i.id)}
                          disabled={busy !== null}
                          className="h-8 bg-primary px-3 text-[12px] text-white hover:bg-primary-hover"
                        >
                          {busy === i.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            "Try again"
                          )}
                        </Button>
                      )}
                    </span>
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
 * Where a new plan is started from.
 *
 * A link, not a checkout. Tutoring is priced per session against a tutor's
 * calendar and counselling is a tier, so neither can be bought from a list of
 * what you already have; both pages already exist and both already accept a
 * preselected child, so this carries the one in the sidebar across rather than
 * asking for it again.
 */
function AddPlanMenu({ childId }: { childId: string | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const forChild = childId ? `?student=${childId}` : "";
  const items = [
    { label: "Book tutoring", hint: "Browse courses and pick a tutor", to: `/parent/courses${forChild}` },
    { label: "College counselling", hint: "Compare the tiers", to: `/parent/admissions${forChild}` },
  ];

  return (
    <div ref={ref} className="relative">
      <Button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 gap-1.5 px-3.5 text-[13px]"
      >
        <Plus size={16} /> Add a plan
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1.5 w-[230px] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.to}
              role="menuitem"
              onClick={() => navigate(item.to)}
              className="block w-full px-3.5 py-2.5 text-left transition-colors hover:bg-muted/60"
            >
              <span className="block text-[13.5px] font-medium text-foreground">{item.label}</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The dense layout is the base and the roomy one is an md override, in both
// cards below. The toggler only exists from md up, so a phone always gets the
// dense card whatever `compact` says, rather than four quota columns in 360px.

/**
 * One course, for one child, with the tutor teaching it.
 *
 * It used to say "3 of 3 sessions still to come" and "0 completed" side by
 * side, which is the same fact told twice and subtracted once. How far through
 * they are is the only part worth reading, so that is all it says now.
 */
function PlanCard({ pkg, compact }: { pkg: CoursePackage; compact?: boolean }) {
  const total = Math.max(pkg.slotsPurchased, 1);
  const done = (pkg.slotsCompleted / total) * 100;

  return (
    // Gold for tutoring, teal for counselling. One glance says which of the two
    // services a row belongs to, which a list mixing both otherwise does not.
    <article className={cn("rounded-xl border border-secondary bg-card p-4", !compact && "md:p-5")}>
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

      {/* Its own row rather than floated against the title: the amount used to
          wrap onto a line of its own anyway the moment a name ran long, which
          left it sitting under the avatars looking accidental. The subject
          fills the left, since a course has no start date to put there. */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="truncate">{pkg.subject || "Tutoring"}</span>
        <span className="shrink-0">
          <Money cents={pkg.totalPaidCents} /> paid
        </span>
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
function AdmissionsCard({ plan, compact }: { plan: AdmissionsPlan; compact?: boolean }) {
  const [booking, setBooking] = useState(false);
  const [managing, setManaging] = useState(false);
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
    <article className={cn("rounded-xl border border-primary bg-card p-4", !compact && "md:p-5")}>
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
          </p>
        </div>
      </div>

      {/* Since and what happens next, one row, ends apart. The right hand side
          used to say what had been paid, which under a subscription is the one
          number that keeps changing and the least useful thing to show. What a
          parent wants from this line is when they are next charged, and whether
          anything is about to change. */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
        <span className="truncate">
          {"since "}
          {new Date(plan.startedAt).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="shrink-0">
          <Money cents={plan.tier.priceCents} /> a month
        </span>
      </div>

      {/* Said plainly rather than as a countdown. A clock ticking down to a
          cancellation deadline reads as a nudge to use it, and generates a
          support ticket every time somebody misses it by a minute. */}
      <p
        className={cn(
          "mt-1 text-[12.5px]",
          plan.cancelAtPeriodEnd || plan.status === "past_due"
            ? "text-secondary"
            : "text-muted-foreground"
        )}
      >
        {plan.status === "past_due"
          ? "Your last payment did not go through. Counselling carries on, update your card when you can."
          : plan.cancelAtPeriodEnd
            ? `Ends ${periodDate(plan.currentPeriodEnd)}. Everything stays available until then.`
            : plan.pendingTierName
              ? `Changes to ${plan.pendingTierName} on ${periodDate(plan.currentPeriodEnd)}.`
              : plan.currentPeriodEnd
                ? `Renews ${periodDate(plan.currentPeriodEnd)}. Cancel any time.`
                : "Billed monthly. Cancel any time."}
      </p>

      {usage && usage.lines.length > 0 && (
        <div
          className={cn(
            "mt-4 flex flex-col items-stretch gap-4 border-t border-border pt-3",
            !compact && "md:flex-row md:flex-wrap md:items-end md:justify-between"
          )}
        >
          {/* Two columns rather than one line when the card is half as wide:
              four quota lines side by side would each be a few characters. */}
          <dl
            className={cn(
              "grid grid-cols-2 gap-x-4 gap-y-2",
              !compact && "md:flex md:flex-wrap md:gap-x-8"
            )}
          >
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

          <div className={cn("flex items-center gap-3", !compact && "md:shrink-0")}>
          <button
            type="button"
            onClick={() => setManaging(true)}
            className="h-9 whitespace-nowrap text-[13px] font-medium text-primary hover:underline"
          >
            Manage plan
          </button>
          {advising && (
            // Enabled whenever there is something to do: hours left to book, or
            // hours already booked that can be given back and taken elsewhere.
            // Disabling it the moment the allowance is spent killed it exactly
            // when somebody wants to move an hour.
            <Button
              onClick={() => setBooking(true)}
              disabled={remaining <= 0 && !hasBooked}
              className={cn(
                "h-9 w-full gap-2 bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-hover disabled:opacity-50",
                !compact && "md:w-auto md:shrink-0"
              )}
            >
              <CalendarPlus size={15} />
              {hasBooked ? "Change slots" : "Choose slots"}
              {remaining !== Infinity && ` (${Math.max(0, remaining)})`}
            </Button>
          )}
          </div>
        </div>
      )}

      {booking && (
        <BookAdvisingDialog
          plan={plan}
          remaining={remaining === Infinity ? 99 : remaining}
          onClose={() => setBooking(false)}
        />
      )}

      {managing && <ManagePlanDialog plan={plan} onClose={() => setManaging(false)} />}
    </article>
  );
}

/** Reasons people actually give, plus room to say something else. */
const CANCEL_REASONS = [
  { value: "", label: "Prefer not to say" },
  { value: "Too expensive", label: "Too expensive" },
  { value: "Applications are finished", label: "Applications are finished" },
  { value: "Not using it enough", label: "Not using it enough" },
  { value: "Not what we expected", label: "Not what we expected" },
  { value: "Going elsewhere", label: "Going elsewhere" },
  { value: "other", label: "Something else" },
];

/**
 * Changing or ending a counselling subscription.
 *
 * Nothing here charges a card without saying what it will cost first. An
 * upgrade takes money immediately, so the amount comes from Stripe and is shown
 * on its own confirmation step: "you have been upgraded" arriving before the
 * customer agreed to a figure is how a chargeback starts.
 *
 * The two directions are deliberately not symmetrical, and the wording says so
 * rather than leaving somebody to find out on their statement. Moving up costs
 * the difference today and applies today. Moving down, and cancelling, wait
 * until the month already paid for runs out, so nothing is refunded and nothing
 * a family has already used this month has to be unpicked.
 */
function ManagePlanDialog({ plan, onClose }: { plan: AdmissionsPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"main" | "confirmChange" | "confirmCancel">("main");
  const [tierId, setTierId] = useState(plan.tier.id);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tiers = [] } = useQuery({ queryKey: ["tiers"], queryFn: getTiers });
  const chosen = tiers.find((t) => t.id === tierId);

  // Asked of Stripe when the dialog opens, because the row can be stale and
  // this is the screen that has to name a date. A plan created before period
  // tracking existed carries no date at all, and "the end of the period" is not
  // an answer to when somebody's counselling stops.
  const { data: live } = useQuery({
    queryKey: ["plan-status", plan.id],
    queryFn: () => getPlanStatus(plan.id),
  });
  const periodEnd = live?.periodEnd ?? plan.currentPeriodEnd;

  // The same two faces the card underneath shows. A dialog about ending
  // somebody's counselling should say whose, and who they would be leaving.
  const { data: people } = useQuery({
    queryKey: ["plan-people", plan.studentId],
    queryFn: () => getPlanPeople(plan.studentId),
  });
  const changed = tierId !== plan.tier.id || !!plan.pendingTierId;

  // Asked of Stripe, and only once somebody has actually picked something. The
  // figure is the whole point of the confirmation step, so the button waits for
  // it rather than letting anybody agree to an amount that is still loading.
  const { data: preview, isFetching: previewing } = usePlanChangePreview(
    plan.id,
    changed ? tierId : null
  );

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admissions-plans"] }),
      qc.invalidateQueries({ queryKey: ["admissions-usage"] }),
      qc.invalidateQueries({ queryKey: ["parent-invoices"] }),
    ]);
  }

  async function applyChange() {
    setBusy(true);
    const res = await changePlanTier(plan.id, tierId);
    setBusy(false);
    if (res.error) return toast.error(res.error);

    toast.success(
      res.applied === "now"
        ? `Moved to ${chosen?.name}.`
        : res.applied === "kept"
          ? `Staying on ${plan.tier.name}.`
          : `${chosen?.name} starts ${periodDate(res.startsAt ?? periodEnd)}.`
    );
    await refresh();
    onClose();
  }

  async function endIt() {
    setBusy(true);
    const said = reason === "other" ? note.trim() : reason;
    const res = await cancelPlan(plan.id, said || undefined);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Counselling ends ${periodDate(periodEnd)}. Nothing changes before then.`);
    await refresh();
    onClose();
  }

  async function keepIt() {
    setBusy(true);
    const res = await resumePlan(plan.id);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success("Your counselling carries on.");
    await refresh();
    onClose();
  }

  const heading =
    view === "confirmCancel"
      ? "Before you go"
      : view === "confirmChange"
        ? "Confirm the change"
        : "Manage counselling";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="border-b border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-foreground">{heading}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-3">
            <StackedAvatars
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
              <p className="truncate text-[14px] font-medium text-foreground">
                {people?.student?.fullName ?? plan.studentName}
                {people?.counselor ? ` with ${people.counselor.fullName}` : ""}
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {plan.tier.name}, {money(plan.tier.priceCents)} a month
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {view === "main" && (
            <div className="space-y-5">
              <div>
                <label className="text-[12.5px] font-medium text-foreground">Plan</label>
                <Dropdown
                  value={tierId}
                  onChange={setTierId}
                  className="mt-1.5 w-full"
                  options={tiers.map((t) => ({
                    value: t.id,
                    label: `${t.name} - ${money(t.priceCents)} a month`,
                  }))}
                />

                <Button
                  onClick={() => setView("confirmChange")}
                  disabled={!changed || previewing}
                  className="mt-3 h-10 w-full bg-primary text-[14px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {previewing ? "Checking..." : "Review change"}
                </Button>
              </div>

              <div className="border-t border-border pt-4">
                {plan.cancelAtPeriodEnd ? (
                  <>
                    <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                      Counselling is set to end {periodDate(periodEnd)}. You can carry on instead,
                      and nothing will have changed.
                    </p>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void keepIt()}
                        disabled={busy}
                        className="text-[13px] font-medium text-primary transition-colors hover:underline disabled:opacity-50"
                      >
                        {busy ? "Working..." : "Keep my counselling"}
                      </button>
                    </div>
                  </>
                ) : (
                  // Right, under the end of the control above it, rather than
                  // starting a second column of its own on the left.
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setView("confirmCancel")}
                      className="text-[13px] font-medium text-primary transition-colors hover:underline"
                    >
                      Cancel counselling
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nothing has been charged at this point. What the customer agreed to
              is whatever this screen said, so it says the figure Stripe gave
              us rather than a description of one. */}
          {view === "confirmChange" && (
            <div className="space-y-4">
              <PlanChangeSummary
                preview={preview}
                from={plan.tier}
                to={chosen}
                fallbackPeriodEnd={periodEnd}
              />

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => void applyChange()}
                  disabled={busy || previewing || !!preview?.error}
                  className="h-10 flex-1 bg-primary text-[14px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {busy
                    ? "Working..."
                    : preview?.direction === "upgrade"
                      ? `Pay ${money(preview.dueNowCents ?? 0)} and upgrade`
                      : "Confirm"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setView("main")}
                  disabled={busy}
                  className="h-10 border-border text-[14px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          {/* One screen, not a gauntlet. It says what they keep, offers the two
              things that genuinely fix most reasons for leaving, and asks why
              without requiring an answer. Anything more would be a business
              making itself hard to leave, which is a thing customers remember. */}
          {view === "confirmCancel" && (
            <div className="space-y-4">
              <p className="text-[14px] leading-relaxed text-foreground">
                You keep {plan.tier.name} and everything in it until{" "}
                {periodDate(periodEnd)}. After that counselling stops, and the month you are in is
                not refunded.
              </p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                If it is the cost, a smaller plan keeps your counsellor and your work in place. You
                can also come back later, though your counsellor may not be free by then.
              </p>

              <div>
                <label className="text-[12.5px] font-medium text-foreground">
                  What made you decide? Optional.
                </label>
                <Dropdown
                  value={reason}
                  onChange={setReason}
                  className="mt-1.5 w-full"
                  options={CANCEL_REASONS}
                />
                {reason === "other" && (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder="In your own words"
                    className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-[13.5px] text-foreground outline-none focus:border-primary"
                  />
                )}
              </div>

              {/* Side by side and the same size. Keeping it is the suggested
                  answer, which is what the fill says; leaving is a legitimate
                  choice and hiding it in a text link is the kind of thing
                  people notice and hold against a business. */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => setView("main")}
                  disabled={busy}
                  className="h-10 flex-1 bg-primary text-[14px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  Keep counselling
                </Button>
                {/* variant="outline", not a className. Button builds its
                    classes by concatenation and cn does not resolve conflicts,
                    so bg-transparent passed in sat alongside the default
                    variant's bg-primary and lost: the button was invisible
                    until hover, then turned teal. */}
                <Button
                  variant="outline"
                  onClick={() => void endIt()}
                  disabled={busy}
                  className="h-10 flex-1 border-border text-[14px] font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
                >
                  {busy ? "Working..." : "Cancel counselling"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
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
                        className="text-[12.5px] font-medium text-primary transition-opacity hover:underline disabled:opacity-50"
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
              <Loader2 className="animate-spin text-primary" size={22} />
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
            className="h-10 bg-primary px-5 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
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

/**
 * The scheme's mark, at the size it reads at on the card itself.
 *
 * Visa's own artwork, so its blue and gold are Visa's rather than ours and the
 * palette rule does not reach it. Every other scheme falls back to its name in
 * a box: showing this mark for a Mastercard would be a lie about which card is
 * on file, and a wrong logo is worse than no logo.
 */
function CardMark({ brand }: { brand: string }) {
  if (brand.toLowerCase() !== "visa") {
    return (
      <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 text-[10px] font-bold uppercase text-muted-foreground">
        {brand}
      </span>
    );
  }

  return (
    // Cropped to the artwork. The source viewBox is 48 square around a card
    // that is 42 by 30, so at any height a third of the box was empty.
    <svg viewBox="3 9 42 30" className="h-10 w-14 shrink-0" role="img" aria-label="Visa">
      <path
        fill="#1565C0"
        d="M45,35c0,2.209-1.791,4-4,4H7c-2.209,0-4-1.791-4-4V13c0-2.209,1.791-4,4-4h34c2.209,0,4,1.791,4,4V35z"
      />
      <path
        fill="#FFF"
        d="M15.186 19l-2.626 7.832c0 0-.667-3.313-.733-3.729-1.495-3.411-3.701-3.221-3.701-3.221L10.726 30v-.002h3.161L18.258 19H15.186zM17.689 30L20.56 30 22.296 19 19.389 19zM38.008 19h-3.021l-4.71 11h2.852l.588-1.571h3.596L37.619 30h2.613L38.008 19zM34.513 26.328l1.563-4.157.818 4.157H34.513zM26.369 22.206c0-.606.498-1.057 1.926-1.057.928 0 1.991.674 1.991.674l.466-2.309c0 0-1.358-.515-2.691-.515-3.019 0-4.576 1.444-4.576 3.272 0 3.306 3.979 2.853 3.979 4.551 0 .291-.231.964-1.888.964-1.662 0-2.759-.609-2.759-.609l-.495 2.216c0 0 1.063.606 3.117.606 2.059 0 4.915-1.54 4.915-3.752C30.354 23.586 26.369 23.394 26.369 22.206z"
      />
      <path
        fill="#FFC107"
        d="M12.212,24.945l-0.966-4.748c0,0-0.437-1.029-1.573-1.029c-1.136,0-4.44,0-4.44,0S10.894,20.84,12.212,24.945z"
      />
    </svg>
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
            <li key={card.id} className="flex items-center gap-4 p-5">
              <CardMark brand={card.brand} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[15px] font-medium text-foreground">
                    <span className="capitalize">{card.brand}</span> ending in {card.last4}
                  </p>
                  {card.addedAt && (
                    <p className="text-[12.5px] text-muted-foreground">
                      Added{" "}
                      {new Date(card.addedAt * 1000).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>

                {/* Under the card itself rather than trailing the digits, where
                    it read as part of the number. */}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3">
                  {card.exp_month && card.exp_year && (
                    <p className="text-[12.5px] text-muted-foreground">
                      Expires {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
                    </p>
                  )}
                  {card.isDefault && (
                    <span className="ml-auto flex items-center gap-1 text-[12.5px] text-primary">
                      <Check size={14} /> Default
                    </span>
                  )}
                </div>
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
