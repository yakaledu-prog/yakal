import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, ExternalLink, Loader2, ShieldCheck } from "lucide-react";

import { money } from "@/services/billingService";
import {
  getConnectStatus,
  getEarningsYearTotal,
  getSettledPayouts,
  methodLabel,
  type EarningRow,
  refreshConnectStatus,
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
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const { data: status } = useQuery({
    queryKey: ["connect-status", tutorId],
    queryFn: () => getConnectStatus(tutorId),
  });

  // Coming back from Stripe's onboarding. The account.updated webhook says the
  // same thing, but it needs the Stripe CLI forwarding locally and can be
  // delayed or missed in production, and somebody who has just finished will
  // not sit on a page that still tells them to connect a bank.
  useEffect(() => {
    if (params.get("connect") !== "done") return;
    (async () => {
      const res = await refreshConnectStatus();
      await qc.invalidateQueries({ queryKey: ["connect-status", tutorId] });
      if (res.payoutsEnabled) {
        toast.success("Your bank is connected. Payments will come here from now on.");
      } else if (res.needs?.length) {
        toast("Stripe still needs a few details before payments can reach you.");
      }
      params.delete("connect");
      setParams(params, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ["tutor-payouts", tutorId],
    queryFn: () => getSettledPayouts(tutorId),
  });

  const { data: yearTotal } = useQuery({
    queryKey: ["payout-year-total", tutorId],
    queryFn: () => getEarningsYearTotal(tutorId),
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
        <Banknote size={18} className="text-primary" />
        <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Payments to you</h3>
        {yearTotal && yearTotal.count > 0 && (
          <span className="ml-auto text-[13px] text-muted-foreground">
            {money(yearTotal.totalCents)} paid in {new Date().getFullYear()}
          </span>
        )}
      </div>

      {status && !status.payoutsEnabled && (
        <div className="rounded-xl border border-secondary/50 bg-secondary/10 p-4">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[#8a6a2a] dark:text-secondary">
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
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            {status.accountId ? "Carry on" : "Connect with Stripe"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : payouts.length === 0 ? (
        <p className="py-10 text-center text-[13.5px] text-muted-foreground">
          Nothing yet. Payments appear here as soon as one is made, with the reference you can
          check against your bank.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {payouts.map((p: EarningRow) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-foreground">
                  {money(p.amountCents, p.currency)}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {methodLabel(p.method ?? "")}
                  {p.settledAt &&
                    ` - ${new Date(p.settledAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`}
                  {p.subject && ` - ${p.subject}`}
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
                  className="shrink-0 text-[12.5px] font-medium text-primary hover:underline"
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
