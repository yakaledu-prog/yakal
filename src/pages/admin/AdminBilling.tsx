import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getAllInvoices, getInvoiceDetail } from "@/services/adminService";
import { getOwedEarnings, settleEarnings, type OwedRow } from "@/services/payoutService";
import { RecordPayoutModal } from "@/components/admin/RecordPayoutModal";
import { RefundDialog } from "@/components/admin/RefundDialog";
import { money } from "@/services/billingService";
import { Loader2, CheckCircle2, Clock, Wallet, Check, ChevronRight, ScrollTextIcon } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";

const KINDS = [
  { value: "all", label: "All services" },
  { value: "tutoring", label: "Tutoring" },
  { value: "admissions", label: "Counselling" },
];

const PAY_STATES = [
  { value: "all", label: "Any state" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Payment failed" },
  { value: "open", label: "Not finished" },
];

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
  const [refunding, setRefunding] = useState<(typeof invoices)[number] | null>(null);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [kind, setKind] = useState("all");
  const [payState, setPayState] = useState("all");

  // The two filters compose in the order they are read: what it was for, then
  // where the money got to.
  const shownInvoices = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (kind === "all" || i.kind === kind) && (payState === "all" || i.status === payState)
      ),
    [invoices, kind, payState]
  );

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
            <div className="border-b border-border/50 pb-3 mb-4 flex flex-wrap items-center gap-3">
              <ScrollTextIcon size={18} className="text-primary" />
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Invoices</h3>
              {/* Tutoring and counselling are different businesses with
                  different questions. Looking at one at a time is most of what
                  this page is used for. */}
              <Dropdown
                value={kind}
                onChange={setKind}
                options={KINDS}
                className="ml-auto w-[190px]"
              />
              <Dropdown
                value={payState}
                onChange={setPayState}
                options={PAY_STATES}
                className="w-[170px]"
              />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
            ) : shownInvoices.length === 0 ? (
              <p className="text-center py-16 text-[14px] text-muted-foreground">
                {invoices.length === 0 ? "No invoices yet." : "Nothing matches those filters."}
              </p>
            ) : (
              <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
                {shownInvoices.map((inv) => {
                  const paid = inv.status === "paid";
                  const open = openInvoice === inv.id;
                  return (
                    <div key={inv.id}>
                    <div className="flex items-center gap-4 p-4">
                      {/* Opening a row is how you find out whether the lessons
                          it bought actually happened, which the row itself
                          cannot say without becoming three lines long. */}
                      <button
                        type="button"
                        onClick={() => setOpenInvoice(open ? null : inv.id)}
                        aria-label={open ? "Hide detail" : "Show detail"}
                        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ChevronRight size={16} className={cn("transition-transform", open && "rotate-90")} />
                      </button>
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
                      {/* Plain coloured text in a fixed column, so the status
                          and the amount sit at the same place on every row
                          rather than shifting with the width of the word. */}
                      <span className={cn("w-28 shrink-0 text-right text-[12.5px] font-medium capitalize",
                        paid ? "text-primary" : "text-[#8a6a2a] dark:text-secondary")}>
                        {inv.status}
                      </span>
                      <span className="w-24 shrink-0 text-right text-[14px] font-semibold tabular-nums text-[#111] dark:text-white">{money(inv.amount_cents, inv.currency)}</span>
                      {/* Only a payment that was actually taken can be given
                          back. The dialog says what it costs before it does. */}
                      <span className="flex w-20 shrink-0 justify-end">
                        {paid && (
                          <button
                            type="button"
                            onClick={() => setRefunding(inv)}
                            className="text-[12.5px] font-medium text-primary transition-colors hover:underline"
                          >
                            Refund
                          </button>
                        )}
                      </span>
                    </div>
                    {open && <InvoiceLines invoiceId={inv.id} currency={inv.currency} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {refunding && (
        <RefundDialog invoice={refunding} onClose={() => setRefunding(null)} />
      )}
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

/**
 * What one purchase bought, and where each part of it got to.
 *
 * The row above says a family paid. This says whether the lessons happened,
 * whether anybody has been paid for them, and whether any of it came back,
 * which is what somebody opens this page to find out and what no single line
 * could carry without becoming three.
 *
 * Fetched on expand rather than joined into the list: a page of forty invoices
 * would otherwise pull every session and every earning on the platform to draw
 * one screen.
 */
function InvoiceLines({ invoiceId, currency }: { invoiceId: string; currency: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["invoice-detail", invoiceId],
    queryFn: () => getInvoiceDetail(invoiceId),
  });

  const shell = "bg-[#f8f9fa] dark:bg-[#182329]";

  if (isLoading) {
    return (
      <div className={cn(shell, "flex justify-center py-4")}>
        <Loader2 size={16} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.lines.length === 0) {
    return (
      <p className={cn(shell, "px-6 py-3 pl-14 text-[13px] text-muted-foreground")}>
        Nothing has been booked against this yet.
      </p>
    );
  }

  return (
    <div className={shell}>
      {data.lines.map((l) => (
        <div key={l.id} className="flex items-center gap-4 px-6 py-2.5 pl-14">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-[#111] dark:text-white">{l.label}</p>
            <p className="text-[12px] text-muted-foreground">{l.when ? fmtDate(l.when) : ""}</p>
          </div>

          {/* Plain coloured text, in the same columns as the row above, so a
              purchase and its parts read as one table rather than two. */}
          <span
            className={cn(
              "w-28 shrink-0 text-right text-[12.5px] capitalize",
              l.status === "completed"
                ? "text-primary"
                : l.status === "cancelled" || l.status === "no-show"
                  ? "text-muted-foreground"
                  : "text-[#8a6a2a] dark:text-secondary"
            )}
          >
            {l.status}
          </span>

          {/* What the tutor or counsellor gets from this one, and whether it
              has moved. The distinction is the whole reason a refund is cheap
              or expensive. */}
          <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums text-muted-foreground">
            {l.earningCents == null ? "-" : money(l.earningCents, currency)}
          </span>
          <span className="w-20 shrink-0 text-right text-[12.5px] text-muted-foreground">
            {l.earningStatus ?? ""}
          </span>
        </div>
      ))}

      <div className="flex items-center gap-4 border-t border-border/50 px-6 py-2.5 pl-14 text-[12.5px]">
        <span className="flex-1 text-muted-foreground">
          {money(data.owedCents, currency)} owed, {money(data.paidOutCents, currency)} already paid out
          {data.refundedCents > 0 ? `, ${money(data.refundedCents, currency)} refunded` : ""}
        </span>
      </div>
    </div>
  );
}
