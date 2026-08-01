import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, ExternalLink, Loader2, ShieldCheck } from "lucide-react";

import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import {
  getConnectStatus,
  getPayoutYearTotal,
  getTutorPayoutHistory,
  methodLabel,
  startConnectOnboarding,
} from "@/services/payoutService";

// ============================================================
// What a tutor has been paid, and how to get paid.
//
// Before this, a tutor had no way to tell whether money had moved: an admin
// clicked a button and a column changed, entirely out of sight. Every payment
// here carries the reference the tutor can quote to their own bank, which is
// the difference between being told they were paid and being able to check.
//
// The connect prompt is at the top only while it is unanswered. A tutor who
// has already connected does not need reminding on every visit.
// ============================================================

export function PayoutHistory({ tutorId }: { tutorId: string }) {
  const [busy, setBusy] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["connect-status", tutorId],
    queryFn: () => getConnectStatus(tutorId),
  });

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ["tutor-payouts", tutorId],
    queryFn: () => getTutorPayoutHistory(tutorId),
  });

  const { data: yearTotal } = useQuery({
    queryKey: ["payout-year-total", tutorId],
    queryFn: () => getPayoutYearTotal(tutorId),
  });

  async function connect() {
    setBusy(true);
    const { error } = await startConnectOnboarding();
    if (error) {
      toast.error(error);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b border-border/50 pb-3">
        <Banknote size={18} className="text-[#1099A1]" />
        <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Payments to you</h3>
        {yearTotal && yearTotal.count > 0 && (
          <span className="ml-auto text-[13px] text-muted-foreground">
            {money(yearTotal.totalCents)} paid in {new Date().getFullYear()}
          </span>
        )}
      </div>

      {status && !status.payoutsEnabled && (
        <div className="rounded-xl border border-[#CAA25F]/50 bg-[#CAA25F]/10 p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[#8a6a2a] dark:text-[#CAA25F]">
            <ShieldCheck size={16} />
            {status.accountId ? "Finish connecting your bank" : "Connect your bank"}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {status.accountId
              ? "You started this but have not finished. Payments cannot reach you until it is done."
              : "Stripe collects your bank details directly, so we never hold them. Until this is done you will have to be paid by hand."}
          </p>
          <button
            onClick={() => void connect()}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            {status.accountId ? "Carry on" : "Connect with Stripe"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-[#1099A1]" />
        </div>
      ) : payouts.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-muted-foreground">
          Nothing yet. Payments appear here as soon as one is made, with the reference you can
          check against your bank.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {payouts.map((p) => (
            <li
              key={p.id}
              className={cn("flex flex-wrap items-center gap-4 py-4", p.voidedAt && "opacity-55")}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-foreground">
                  {money(p.amountCents, p.currency)}
                  {p.voidedAt && (
                    <span className="ml-2 text-[12.5px] font-normal text-muted-foreground">
                      voided{p.voidReason ? `, ${p.voidReason}` : ""}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {methodLabel(p.method)}
                  {" - "}
                  {new Date(`${p.paidOn}T00:00:00`).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {p.description && ` - ${p.description}`}
                </p>
              </div>

              {/* The whole point: something the tutor can look up themselves. */}
              <div className="shrink-0 text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Reference
                </p>
                <p className="font-mono text-[12.5px] text-foreground">{p.reference}</p>
              </div>

              {p.receiptUrl && (
                <a
                  href={p.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-[12.5px] font-medium text-[#1099A1] hover:underline"
                >
                  Receipt
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
