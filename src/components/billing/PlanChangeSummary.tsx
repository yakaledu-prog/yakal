import { useQuery } from "@tanstack/react-query";

import { money } from "@/services/billingService";
import {
  previewPlanChange,
  type AdmissionsTier,
  type PlanChangePreview,
} from "@/services/admissionsService";

// ============================================================
// What changing tier will actually cost, said before it costs it.
//
// Shared, because there are two ways into a plan change and they must not give
// different answers. Billing has a Manage plan dialog; Admissions has a Switch
// to this plan button beside every tier. Somebody upgrading from either should
// see the same figure, and only one of them can be the one that gets updated
// when the policy changes.
//
// The figure comes from Stripe. Proration depends on how much of the month is
// left and what has already been credited, and a second implementation of that
// arithmetic would be wrong in a way nobody notices until a customer adds it up.
// ============================================================

/** Asks Stripe what this change would do. Idle until a different tier is picked. */
export function usePlanChangePreview(planId: string | null, tierId: string | null) {
  return useQuery({
    queryKey: ["plan-change-preview", planId, tierId],
    queryFn: () => previewPlanChange(planId!, tierId!),
    enabled: !!planId && !!tierId,
  });
}

/** "1 September", or an honest hedge when Stripe has not said yet. */
export function periodDate(iso: string | null | undefined): string {
  if (!iso) return "the end of the period";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

export function PlanChangeSummary({
  preview,
  from,
  to,
  fallbackPeriodEnd,
}: {
  preview: PlanChangePreview | undefined;
  from: AdmissionsTier;
  to: AdmissionsTier | undefined;
  fallbackPeriodEnd: string | null;
}) {
  if (!preview) return null;

  if (preview.error) {
    return <p className="text-[13px] text-secondary">{preview.error}</p>;
  }

  if (preview.direction === "upgrade") {
    return (
      <>
        <p className="text-[14px] leading-relaxed text-foreground">
          Moving to <strong>{to?.name}</strong> now.
        </p>
        {/* The two numbers separately. One figure covering both is how somebody
            reads a prorated amount as the new monthly price. */}
        <dl className="mt-3 space-y-2 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[13px] text-muted-foreground">Charged today</dt>
            <dd className="text-[15px] font-semibold tabular-nums text-foreground">
              {money(preview.dueNowCents ?? 0)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[13px] text-muted-foreground">
              Then from {periodDate(preview.nextChargeAt ?? fallbackPeriodEnd)}
            </dt>
            <dd className="text-[15px] tabular-nums text-foreground">
              {money(preview.monthlyCents)} a month
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
          Today's amount covers the rest of this month at the new rate, less what you have already
          paid for it. {to?.name} is available as soon as this goes through.
        </p>
      </>
    );
  }

  if (preview.direction === "downgrade") {
    return (
      <>
        <p className="text-[14px] leading-relaxed text-foreground">
          Moving to <strong>{to?.name}</strong> on{" "}
          {periodDate(preview.startsAt ?? fallbackPeriodEnd)}.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
          Nothing is charged today and nothing is refunded. You keep {from.name} and everything it
          includes until then.
        </p>
      </>
    );
  }

  if (preview.direction === "keep") {
    return (
      <p className="text-[14px] leading-relaxed text-foreground">
        Staying on <strong>{from.name}</strong>. The change that was due to happen will not, and
        nothing is charged.
      </p>
    );
  }

  return (
    <p className="text-[14px] leading-relaxed text-muted-foreground">
      They are already on {from.name}.
    </p>
  );
}
