import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { money } from "@/services/billingService";
import { previewRefund, refundInvoice, type AdminInvoice } from "@/services/adminService";

// ============================================================
// Giving money back, as a decision rather than a rule.
//
// The cancellation policy has its own path. This is goodwill, a complaint, or a
// correction, and the one thing it must say before anybody presses anything is
// what it costs.
//
// A refund is cheap while the money is still in the platform balance and
// expensive once it has been paid out to a tutor or counsellor for work they
// actually did: refunding the family does not take that back, and clawing it
// out of somebody's bank is not something any button here can do. Which of the
// two this is depends only on when it happens, and nothing else on the screen
// would say so.
// ============================================================

export function RefundDialog({
  invoice,
  onClose,
}: {
  invoice: AdminInvoice;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: preview, isFetching } = useQuery({
    queryKey: ["refund-preview", invoice.id],
    queryFn: () => previewRefund(invoice.id),
  });

  async function confirm() {
    setBusy(true);
    const res = await refundInvoice(invoice.id, { note: note.trim() || undefined });
    setBusy(false);

    if (res.error) return toast.error(res.error);

    // Named rather than buried. The platform has just absorbed this, and the
    // person who decided is the one who should hear it.
    if ((res.earningsAlreadyPaid ?? 0) > 0) {
      toast.warning(
        `Refunded. ${res.earningsAlreadyPaid} payment(s) had already gone out and cannot be recovered.`
      );
    } else {
      toast.success(`Refunded ${money(res.amountCents ?? 0)}.`);
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-invoices"] }),
      qc.invalidateQueries({ queryKey: ["admin-payouts"] }),
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] }),
    ]);
    onClose();
  }

  const costly = (preview?.alreadyPaidOutCents ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium text-foreground">Refund this payment</h2>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {invoice.description} - {invoice.parent_name}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {isFetching && !preview ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Working out what this costs...
            </p>
          ) : preview?.error ? (
            <p className="text-[13px] text-secondary">{preview.error}</p>
          ) : (
            <>
              <dl className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[13px] text-muted-foreground">Back to the parent</dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-foreground">
                    {money(preview?.amountCents ?? 0)}
                  </dd>
                </div>
                {(preview?.refundedSoFar ?? 0) > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[13px] text-muted-foreground">Already refunded</dt>
                    <dd className="text-[15px] tabular-nums text-muted-foreground">
                      {money(preview!.refundedSoFar)}
                    </dd>
                  </div>
                )}
                {costly && (
                  <div className="flex items-center justify-between gap-4 border-t border-border pt-2">
                    <dt className="text-[13px] text-[#8a6a2a] dark:text-secondary">
                      Yakal absorbs
                    </dt>
                    <dd className="text-[15px] font-semibold tabular-nums text-[#8a6a2a] dark:text-secondary">
                      {money(preview!.alreadyPaidOutCents)}
                    </dd>
                  </div>
                )}
              </dl>

              <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                {costly
                  ? `${preview!.alreadyPaidOutCount} payment${preview!.alreadyPaidOutCount === 1 ? " has" : "s have"} already gone out for work that was delivered. Refunding the parent does not bring that back, and it cannot be recovered from here.`
                  : "Nothing has been paid out against this yet, so anything still owed on it is cancelled with the refund and this costs Yakal nothing beyond the processing fee."}
              </p>

              <label className="mt-4 block text-[12.5px] font-medium text-foreground">
                Why, for the record
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Kept with the refund"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary"
                />
              </label>

              <div className="mt-5 flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={busy}
                  className="h-10 flex-1 border-border text-[14px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  Back
                </Button>
                <Button
                  onClick={() => void confirm()}
                  disabled={busy || isFetching}
                  className="h-10 flex-1 bg-primary text-[14px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {busy ? "Refunding..." : `Refund ${money(preview?.amountCents ?? 0)}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
