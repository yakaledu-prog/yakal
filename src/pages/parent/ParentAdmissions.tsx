import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import { getLinkedChildren } from "@/services/parentService";
import {
  buyTier,
  getAdmissionsPlans,
  getTiers,
  type AdmissionsTier,
} from "@/services/admissionsService";
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
  const [childId, setChildId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  async function choose(tier: AdmissionsTier) {
    if (!activeChildId) return toast.error("Choose which child this is for first.");
    setBusy(tier.id);
    const { error } = await buyTier({ tierId: tier.id, studentId: activeChildId });
    if (error) {
      toast.error(error);
      setBusy(null);
    }
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background md:flex-row md:overflow-hidden">
        <ChildSidebar
          children={children}
          activeId={activeChildId}
          onSelect={setChildId}
          countFor={(id) => (id ? (plans?.get(id) ? 1 : 0) : (plans?.size ?? 0))}
        />

        <section className="min-w-0 flex-1 md:h-full md:overflow-y-auto">
          <header className="relative overflow-hidden bg-[#1099A1] px-6 py-6 text-white md:px-8 md:py-8">
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

          <div className="p-6 md:p-8">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-[#1099A1]" />
              </div>
            ) : tiers.length === 0 ? (
              <p className="py-20 text-center text-[14px] text-muted-foreground">
                No plans are on offer at the moment.
              </p>
            ) : (
              <div className="grid gap-5 lg:grid-cols-3">
                {tiers.map((t) => (
                  <TierCard
                    key={t.id}
                    tier={t}
                    current={currentPlan?.tier.id === t.id}
                    hasPlan={!!currentPlan}
                    disabled={!activeChildId}
                    busy={busy === t.id}
                    onChoose={() => void choose(t)}
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
        </section>
      </div>
    </PageWrapper>
  );
}

function TierCard({
  tier,
  current,
  hasPlan,
  disabled,
  busy,
  onChoose,
}: {
  tier: AdmissionsTier;
  current: boolean;
  hasPlan: boolean;
  disabled: boolean;
  busy: boolean;
  onChoose: () => void;
}) {
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border bg-card p-6",
        current
          ? "border-[#1099A1]"
          : tier.isRecommended
            ? "border-[#1099A1]/40"
            : "border-border"
      )}
    >
      {/* One line above the title rather than a floating tab, so the three
          cards stay the same height and start at the same place. */}
      <p className="mb-1 h-4 text-[11px] font-medium uppercase tracking-wider text-[#1099A1]">
        {current ? "Current plan" : tier.isRecommended ? "Most chosen" : ""}
      </p>

      <h2 className="text-[20px] font-bold text-foreground">{tier.name}</h2>
      {tier.blurb && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{tier.blurb}</p>
      )}

      {/* The cadence used to sit directly under the price, which made a
          one-off price read as a monthly rate. How often you meet is a feature
          and it is already in the list below; what belongs here is what the
          number actually is. */}
      <p className="mt-4 text-[26px] font-bold text-foreground">{money(tier.priceCents)}</p>
      <p className="text-[12.5px] text-muted-foreground">
        One payment, not a subscription
      </p>

      <ul className="mt-5 flex-1 space-y-2.5">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-foreground">
            <Check size={15} className="mt-0.5 shrink-0 text-[#97CE9D]" />
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
            : "bg-[#1099A1] text-white hover:bg-[#0d7f86]"
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
