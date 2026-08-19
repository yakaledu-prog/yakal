import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getAllInvoices } from "@/services/adminService";
import { getOwedEarnings, settleEarnings, type OwedRow } from "@/services/payoutService";
import { RecordPayoutModal } from "@/components/admin/RecordPayoutModal";
import { money } from "@/services/billingService";
import { Loader2, CheckCircle2, Clock, Wallet, Check, ScrollTextIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminBilling() {
  const qc = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ["admin-invoices"], queryFn: getAllInvoices });
  const { data: payouts = [] } = useQuery({ queryKey: ["admin-payouts"], queryFn: getOwedEarnings });

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid");
    const open = invoices.filter((i) => i.status === "open");
    return {
      revenue: paid.reduce((s, i) => s + i.amount_cents, 0),
      outstanding: open.reduce((s, i) => s + i.amount_cents, 0),
      payoutsDue: payouts.reduce((s: number, p: OwedRow) => s + p.amountCents, 0),
    };
  }, [invoices, payouts]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [recording, setRecording] = useState<OwedRow | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin-payouts"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  }

  /**
   * Money out of the Stripe balance into the payee's connected account.
   *
   * The same thing the scheduled job does once the hold expires, done now. It
   * is an override, so the row says when it would have gone on its own.
   */
  async function payByTransfer(p: OwedRow) {
    setBusyId(p.id);
    const res = await settleEarnings([p.id]);
    setBusyId(null);
    if (res.error) return toast.error(res.error);
    toast.success(`Sent to ${p.payeeName ?? "them"}. Reference ${res.transferId}.`);
    refresh();
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <AdminHeader
          title="Billing"
          subtitle="Revenue, invoices, and tutor payouts"
          stats={[
            { label: "Revenue", value: money(stats.revenue) },
            { label: "Outstanding", value: money(stats.outstanding) },
            { label: "Payouts due", value: money(stats.payoutsDue) },
          ]}
        />

        <div className="p-6 md:p-10 space-y-12">
          {/* Tutor payouts */}
          <div>
            <div className="flex items-center gap-2 border-b border-border/50 pb-3 mb-4">
              <Wallet size={18} className="text-primary" />
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Owed</h3>
            </div>
            {payouts.length === 0 ? (
              <p className="text-[14px] text-muted-foreground py-4">Nothing owed. Everybody is settled.</p>
            ) : (
              <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
                {payouts.map((p: OwedRow) => {
                  const clearing = !!p.releasableAt && new Date(p.releasableAt) > new Date();
                  return (
                  <div key={p.id} className="flex items-center gap-4 p-4">
                    <img src={dicebearUrl(p.payeeName ?? "Yakal")} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">{p.payeeName ?? "Payee"}</p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {p.subject}
                        {p.studentName ? ` - ${p.studentName}` : ""}
                        {clearing && p.releasableAt ? ` - clears ${fmtDate(p.releasableAt)}` : " - due now"}
                      </p>
                    </div>
                    <span className="text-[15px] font-bold text-primary w-24 text-right">{money(p.amountCents, p.currency)}</span>
                    {/* Two ways to settle, and which one is offered is not a
                        choice: somebody Stripe has not cleared cannot receive a
                        transfer, so for them the only honest option is to pay
                        by hand and write down how. */}
                    {p.payoutsEnabled ? (
                      <button
                        onClick={() => void payByTransfer(p)}
                        disabled={busyId === p.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-[12px] font-semibold hover:bg-primary-hover shrink-0 disabled:opacity-50"
                      >
                        {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Pay via Stripe
                      </button>
                    ) : (
                      <button
                        onClick={() => setRecording(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary text-primary text-[12px] font-semibold hover:bg-primary/10 shrink-0"
                        title="This tutor has not connected a bank. Record how you paid them."
                      >
                        Record payment
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Invoices */}
          <div>
            <div className="border-b border-border/50 pb-3 mb-4 flex items-center gap-2">
              <ScrollTextIcon size={18} className="text-primary" /> <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Invoices</h3>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
            ) : invoices.length === 0 ? (
              <p className="text-center py-16 text-[14px] text-muted-foreground">No invoices yet.</p>
            ) : (
              <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
                {invoices.map((inv) => {
                  const paid = inv.status === "paid";
                  return (
                    <div key={inv.id} className="flex items-center gap-4 p-4">
                      <div className={cn("hidden sm:flex w-10 h-10 rounded-full items-center justify-center shrink-0",
                        paid ? "bg-tertiary/20 text-[#7d8f69]" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400")}>
                        {paid ? <CheckCircle2 size={18} /> : <Clock size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">{inv.description}</p>
                        <p className="text-[12px] text-muted-foreground truncate">
                          {inv.parent_name} - <span className="capitalize">{inv.kind}</span> - {paid ? `paid ${fmtDate(inv.paid_at)}` : `created ${fmtDate(inv.created_at)}`}
                        </p>
                      </div>
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize",
                        paid ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400")}>
                        {inv.status}
                      </span>
                      <span className="text-[14px] font-semibold text-[#111] dark:text-white w-24 text-right">{money(inv.amount_cents, inv.currency)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {recording && (
        <RecordPayoutModal
          payout={recording}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            refresh();
          }}
        />
      )}
    </PageWrapper>
  );
}
