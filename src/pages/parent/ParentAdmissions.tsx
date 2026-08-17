import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Download, Loader2, Star, X , ChevronLeft } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";
import { AvailabilityPicker, type PickedSlot } from "@/components/shared/AvailabilityPicker";
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
  // Picking somebody is a decision about who, and then about when. Choosing a
  // counsellor and being sent straight to a card form skips the question the
  // family most wants answered: can they actually meet at a useful hour.
  const [step, setStep] = useState<"counselor" | "slots">("counselor");
  const [slots, setSlots] = useState<PickedSlot[]>([]);

  const closePurchase = () => {
    setPendingTier(null);
    setChosenCounselor(null);
    setStep("counselor");
    setSlots([]);
  };

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

  async function choose(
    tier: AdmissionsTier,
    counselorId: string | null,
    picked: PickedSlot[]
  ) {
    if (!activeChildId) return toast.error("Choose which child this is for first.");
    setBusy(tier.id);
    const { error } = await buyTier({
      tierId: tier.id,
      studentId: activeChildId,
      counselorId,
      booking: picked.map((s) => ({ date: s.date, startTime: s.startTime, durationMinutes: 60 })),
    });
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
          <div
            className={cn(
              "flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl",
              // Wide enough for two counsellor cards side by side, and wider
              // again for a week of hours. A dialog sized for one paragraph
              // made both of those a column of squeezed thumbnails.
              step === "slots" ? "max-w-4xl" : counselors.length > 1 ? "max-w-3xl" : "max-w-md"
            )}
          >
            <div className="overflow-y-auto p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-[18px] font-bold text-foreground">Confirm purchase</h2>
              <button
                onClick={closePurchase}
                aria-label="Close"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60"
              >
                <X size={18} />
              </button>
            </div>

            {/* The summary as a card rather than two sentences, so what is
                being bought and who for is one object to check rather than a
                paragraph to read. The child's face because buying the right
                plan for the wrong child is the expensive mistake here. */}
            <div className="flex items-center gap-3 rounded-2xl border border-border p-4">
              <img
                src={activeChild.avatar_url || dicebearUrl(activeChild.full_name)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-foreground">
                  {pendingTier.name} admissions
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  for {activeChild.full_name}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[17px] font-bold leading-tight text-foreground">
                  {pendingTier.instalmentMonths > 1
                    ? `${money(monthlyCents(pendingTier))}/month`
                    : money(pendingTier.priceCents)}
                </p>
                <p className="text-[12px] leading-tight text-muted-foreground">
                  {pendingTier.instalmentMonths > 1
                    ? `${pendingTier.instalmentMonths} months · ${money(pendingTier.priceCents)}`
                    : "one payment"}
                </p>
              </div>
            </div>

            {/* Choosing the counsellor, but only when there is a choice.
                With one on the books a gallery is a screen with one card and a
                decision nobody is making; with none, the plan is bought
                unassigned and an admin places it, which is what already
                happened silently.

                Built like the course card: the photograph fills the top edge
                rather than sitting cropped into a circle, and the price is the
                large figure with its unit under it. This is the same kind of
                choice, so it should not need to be learned twice.

                No heading. The cards are people with a Choose action on them,
                which does not need a label to explain it. */}
            {step === "counselor" && counselors.length > 1 && (
              <div className="mt-5 grid max-h-[22rem] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
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
                        "cursor-pointer overflow-hidden rounded-2xl border transition-all",
                        picked
                          ? "border-primary ring-2 ring-primary/40"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="relative aspect-[4/3] w-full bg-muted">
                        <img
                          src={c.avatarUrl || dicebearUrl(c.name)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {picked && (
                          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-foreground">
                              {c.name}
                            </p>
                          </div>
                          <p className="shrink-0 whitespace-nowrap text-[15px] font-bold text-foreground">
                            {pendingTier.instalmentMonths > 1
                              ? money(monthlyCents(pendingTier))
                              : money(pendingTier.priceCents)}
                            <span className="text-[12px] font-normal text-muted-foreground">
                              {pendingTier.instalmentMonths > 1 ? "/month" : " one payment"}
                            </span>
                          </p>
                        </div>

                        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          {/* Said in words when there are none. An empty five
                              stars reads as a bad review, not no reviews. */}
                          {c.averageStars != null ? (
                            <>
                              <Star size={11} className="fill-secondary text-secondary" />
                              <span className="font-medium text-foreground">
                                {c.averageStars.toFixed(1)}
                              </span>
                              <span>({c.ratingCount})</span>
                            </>
                          ) : (
                            <span>No reviews yet</span>
                          )}
                          <span aria-hidden>·</span>
                          <span>
                            {c.activePlans} student{c.activePlans === 1 ? "" : "s"}
                          </span>
                        </p>

                        {/* Always drawn, disabled when there is no CV on file.
                            Rendered conditionally it simply vanished, which
                            looks identical to the feature not existing. */}
                        <div className="mt-3 border-t border-border pt-2.5">
                          {c.resumeUrl ? (
                            <a
                              href={c.resumeUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary hover:underline"
                            >
                              <Download size={13} /> Download CV
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                              <Download size={13} /> No CV on file
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {step === "counselor" && counselors.length > 1 && !chosenCounselor && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Skip to be matched automatically.
              </p>
            )}

            {/* The same grid the course booking uses, pointed at the
                counsellor. Advising sessions store them in sessions.tutor_id
                and availability is keyed the same way, so this needed nothing
                of its own. */}
            {step === "slots" && chosenCounselor && (
              <div className="mt-5">
                <p className="mb-3 text-[13px] text-muted-foreground">
                  When would you like to meet {chosenCounselor.name}? These become the first
                  advising sessions. You can skip this and book later from the plan.
                </p>
                <AvailabilityPicker
                  tutorId={chosenCounselor.id}
                  studentId={activeChildId}
                  selected={slots}
                  multiple
                  onToggle={(slot) =>
                    setSlots((cur) =>
                      cur.some((s) => s.key === slot.key)
                        ? cur.filter((s) => s.key !== slot.key)
                        : [...cur, slot]
                    )
                  }
                />
              </div>
            )}
            </div>
            <div className="flex gap-3 border-t border-border p-6 pt-4">
              <button
                onClick={() => (step === "slots" ? setStep("counselor") : closePurchase())}
                className="h-11 flex-1 rounded-xl border border-border text-[14px] font-semibold text-foreground hover:bg-muted/50"
              >
                {step === "slots" ? "Back" : "Cancel"}
              </button>
              <button
                onClick={() => {
                  // Chosen somebody and not yet seen their calendar: show it.
                  // Nobody chosen means no calendar to show, so that path goes
                  // straight on and an admin assigns afterwards as before.
                  if (step === "counselor" && chosenCounselor) {
                    setStep("slots");
                    return;
                  }
                  const t = pendingTier;
                  const picked = chosenCounselor?.id ?? null;
                  const chosenSlots = slots;
                  closePurchase();
                  void choose(t, picked, chosenSlots);
                }}
                disabled={!!busy}
                className="h-11 flex-1 rounded-xl bg-primary text-[14px] font-bold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                {step === "counselor" && chosenCounselor
                  ? "Choose times"
                  : slots.length > 0
                    ? `Continue to payment (${slots.length})`
                    : "Continue to payment"}
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
