import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, Loader2, Star, X , ChevronLeft } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";
import { money } from "@/services/billingService";
import { getLinkedChildren } from "@/services/parentService";
import {
  buyTier,
  getCounselors,
  type CounselorCard,
  getAdmissionsPlans,
  getTiers,
  monthlyCents,
  tierShade,
  type AdmissionsTier,
} from "@/services/admissionsService";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import { ChildSidebar } from "./billing/shared";

// ============================================================
// Choosing a counselling plan.
//
// The tiers are rows, so this page renders whatever is on offer rather than
// three hard-coded cards. Change the copy, the prices or the number of tiers
// in the table and this follows.
//
// A plan is bought for one child, so the child is picked first, on the left,
// the same way billing does it. Buying goes through the invoice and Stripe
// path everything else uses; the price is never sent from here.
// ============================================================

export function ParentAdmissions() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  // The child can arrive preselected, e.g. from "Add" on a child's row, so the
  // parent lands with the right child already chosen rather than picking again.
  const [childId, setChildId] = useState<string | null>(params.get("student"));
  // showDetail rather than the hook's listClass/detailClass: those carry
  // `flex`, and a grid child set to display:flex stops stretching to its
  // column, which leaves the header sized to its own text.
  const { showDetail, openDetail, closeDetail } = useMasterDetail();
  const listClass = showDetail ? "hidden md:block" : "block";
  const detailClass = showDetail ? "block" : "hidden md:block";
  const [busy, setBusy] = useState<string | null>(null);
  // The tier awaiting confirmation. Buying names the child first, because
  // buying the right plan for the wrong child is the expensive mistake here.
  const [pendingTier, setPendingTier] = useState<AdmissionsTier | null>(null);
  // Who the parent picked from the gallery. Null means they have not chosen,
  // and the server assigns the counsellor with the fewest families.
  const [chosenCounselor, setChosenCounselor] = useState<CounselorCard | null>(null);

  const { data: counselors = [] } = useQuery({
    queryKey: ["counselors"],
    queryFn: getCounselors,
  });

  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ["admissions-tiers"],
    queryFn: getTiers,
  });

  const studentIds = children.map((c) => c.id);
  const { data: plans } = useQuery({
    queryKey: ["admissions-plans", studentIds.join(",")],
    queryFn: () => getAdmissionsPlans(studentIds),
    enabled: studentIds.length > 0,
  });

  // A plan belongs to one child, so until one is chosen there is nothing to
  // buy. With a single child there is nothing to choose either.
  const activeChildId = childId ?? (children.length === 1 ? children[0].id : null);
  const activeChild = children.find((c) => c.id === activeChildId) ?? null;
  const currentPlan = activeChildId ? (plans?.get(activeChildId) ?? null) : null;

  async function choose(tier: AdmissionsTier, counselorId: string | null) {
    if (!activeChildId) return toast.error("Choose which child this is for first.");
    setBusy(tier.id);
    const { error } = await buyTier({ tierId: tier.id, studentId: activeChildId, counselorId });
    if (error) {
      toast.error(error);
      setBusy(null);
    }
  }

  return (
    <PageWrapper className="!p-0">
      {/* Header, then the children, then the plans. Same reason as billing:
          on a phone the rail sat above the page title, so the first thing you
          read was a list of names with nothing saying what they were for. */}
      <div className="grid h-full min-h-0 grid-cols-1 overflow-y-auto bg-background md:grid-cols-[260px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden">
        <div className={cn("md:order-2 md:col-start-2 md:row-start-1", detailClass)}>
          <header className="relative overflow-hidden bg-primary px-6 py-6 text-white md:px-8 md:py-8">
            <svg
              className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
              viewBox="0 0 400 200"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden="true"
            >
              <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            </svg>
            <div className="relative z-10">
              <button
                onClick={closeDetail}
                className="mb-2 flex items-center gap-1 text-[13px] text-white/80 transition-colors hover:text-white md:hidden"
              >
                <ChevronLeft size={15} /> Children
              </button>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">College counselling</h1>
              <p className="mt-1 text-[14px] text-white/80">
                {currentPlan
                  ? `${activeChild?.full_name} is on ${currentPlan.tier.name}.`
                  : activeChild
                    ? `Choose a plan for ${activeChild.full_name}.`
                    : "Choose a child, then a plan."}
              </p>
            </div>
          </header>
        </div>

        <div className={cn("md:order-1 md:col-start-1 md:row-span-2 md:h-full md:overflow-y-auto md:border-r md:border-border", listClass)}>
          <ChildSidebar
            children={children}
            activeId={activeChildId}
            onSelect={(id) => {
              setChildId(id);
              openDetail();
            }}
            countFor={(id) => (id ? (plans?.get(id) ? 1 : 0) : (plans?.size ?? 0))}
          />
        </div>

        <div className={cn("p-6 md:order-3 md:col-start-2 md:row-start-2 md:h-full md:overflow-y-auto md:p-8", detailClass)}>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : tiers.length === 0 ? (
              <p className="py-20 text-center text-[14px] text-muted-foreground">
                No plans are on offer at the moment.
              </p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-3">
                {tiers.map((t, i) => (
                  <TierCard
                    key={t.id}
                    tier={t}
                    shade={tierShade(i)}
                    current={currentPlan?.tier.id === t.id}
                    hasPlan={!!currentPlan}
                    disabled={!activeChildId}
                    busy={busy === t.id}
                    onChoose={() => setPendingTier(t)}
                  />
                ))}
              </div>
            )}

            {children.length > 1 && !activeChildId && (
              <p className="mt-6 text-center text-[13px] text-muted-foreground">
                Pick a child on the left to choose a plan for them.
              </p>
            )}
        </div>
      </div>

      {/* Naming the child at checkout. The most expensive, most common mistake
          is buying the right plan for the wrong child, so the confirmation
          leads with who it is for. */}
      {pendingTier && activeChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-[18px] font-bold text-foreground">Confirm purchase</h2>
              <button
                onClick={() => setPendingTier(null)}
                aria-label="Close"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-[14px] leading-relaxed text-foreground">
              Purchasing <span className="font-semibold">{pendingTier.name} admissions</span> for{" "}
              <span className="font-semibold">{activeChild.full_name}</span>.
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {pendingTier.instalmentMonths > 1
                ? `${money(monthlyCents(pendingTier))}/month for ${pendingTier.instalmentMonths} months (${money(pendingTier.priceCents)} total).`
                : `${money(pendingTier.priceCents)}, one payment.`}
            </p>

            {/* Choosing the counsellor, but only when there is a choice.
                With one on the books a gallery is a screen with one card and a
                decision nobody is making; with none, the plan is bought
                unassigned and an admin places it, which is what already
                happened silently.

                A grid of small cards rather than a list of sentences. This is
                a comparison, and a rating reads faster as a figure next to a
                star than as "4.7 from 3 reviews" repeated down a column. */}
            {counselors.length > 1 && (
              <div className="mt-5">
                <p className="mb-2 text-[13px] font-medium text-foreground">Counsellor</p>
                <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {counselors.map((c) => {
                    const picked = chosenCounselor?.id === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setChosenCounselor((cur) => (cur?.id === c.id ? null : c))}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setChosenCounselor((cur) => (cur?.id === c.id ? null : c));
                          }
                        }}
                        className={cn(
                          "cursor-pointer rounded-xl border p-3 text-center transition-colors",
                          picked ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <img
                          src={c.avatarUrl || dicebearUrl(c.name)}
                          alt=""
                          className="mx-auto h-12 w-12 rounded-full bg-muted object-cover"
                        />
                        <p className="mt-2 truncate text-[13px] font-medium text-foreground">{c.name}</p>
                        <p className="mt-0.5 flex items-center justify-center gap-1 text-[12px] text-muted-foreground">
                          {/* Said in words when there are none. An empty five
                              stars reads as a bad review rather than no
                              reviews. */}
                          {c.averageStars != null ? (
                            <>
                              <Star size={11} className="fill-secondary text-secondary" />
                              {c.averageStars.toFixed(1)}
                              <span>({c.ratingCount})</span>
                            </>
                          ) : (
                            "New"
                          )}
                          <span aria-hidden>·</span>
                          <span>{c.activePlans}</span>
                        </p>
                        {c.resumeUrl && (
                          <a
                            href={c.resumeUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
                          >
                            <Download size={12} /> CV
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!chosenCounselor && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Skip to be matched automatically.
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setPendingTier(null); setChosenCounselor(null); }}
                className="h-11 flex-1 rounded-xl border border-border text-[14px] font-semibold text-foreground hover:bg-muted/50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const t = pendingTier;
                  const picked = chosenCounselor?.id ?? null;
                  setPendingTier(null);
                  void choose(t, picked);
                }}
                disabled={!!busy}
                className="h-11 flex-1 rounded-xl bg-primary text-[14px] font-bold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                Continue to payment
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

function TierCard({
  tier,
  shade,
  current,
  hasPlan,
  disabled,
  busy,
  onChoose,
}: {
  tier: AdmissionsTier;
  shade: string;
  current: boolean;
  hasPlan: boolean;
  disabled: boolean;
  busy: boolean;
  onChoose: () => void;
}) {
  return (
    <article
      className="relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6"
      // Each tier carries its own brand shade on the top edge and border, so
      // the plans are distinguishable at a glance.
      style={{ borderColor: shade, borderTopWidth: 4 }}
    >
      {/* One line above the title rather than a floating tab, so the three
          cards stay the same height and start at the same place. */}
      <p className="mb-1 h-4 text-[11px] font-medium uppercase tracking-wider" style={{ color: shade }}>
        {current ? "Current plan" : tier.isRecommended ? "Most chosen" : ""}
      </p>

      <h2 className="text-[20px] font-bold text-foreground">{tier.name}</h2>
      {tier.blurb && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{tier.blurb}</p>
      )}

      {/* The monthly figure leads because it is what a family is deciding to
          pay, but the total is right underneath it: the commitment is the
          whole engagement, and burying that would be a trick. How often you
          meet is a feature and lives in the list below, not here, or a total
          reads as a rate. */}
      {tier.instalmentMonths > 1 ? (
        <>
          <p className="mt-4 text-[26px] font-bold text-foreground">
            {money(monthlyCents(tier))}
            <span className="text-[14px] font-normal text-muted-foreground"> /month</span>
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            {tier.instalmentMonths} monthly payments, {money(tier.priceCents)} in total
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-[26px] font-bold text-foreground">{money(tier.priceCents)}</p>
          <p className="text-[12.5px] text-muted-foreground">One payment</p>
        </>
      )}

      <ul className="mt-5 flex-1 space-y-2.5">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-foreground">
            <Check size={15} className="mt-0.5 shrink-0 text-tertiary" />
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>

      {tier.fits && (
        <p className="mt-5 rounded-xl bg-muted/40 p-3.5 text-[12.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Fits: </span>
          {tier.fits}
        </p>
      )}

      <button
        onClick={onChoose}
        disabled={disabled || busy || current}
        className={cn(
          "mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-50",
          current
            ? "border border-border text-muted-foreground"
            : "bg-primary text-white hover:bg-primary-hover"
        )}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : current ? (
          "You are on this plan"
        ) : hasPlan ? (
          "Switch to this plan"
        ) : (
          "Get started"
        )}
      </button>
    </article>
  );
}
