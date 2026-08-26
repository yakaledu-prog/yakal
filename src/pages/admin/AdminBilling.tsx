import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getAllInvoices, getInvoiceDetail } from "@/services/adminService";
import {
  FORM_1099_THRESHOLD_CENTS,
  getOwedEarnings,
  getTaxYearPayees,
  getTaxYears,
  settleEarnings,
  type OwedRow,
} from "@/services/payoutService";
import { RecordPayoutModal } from "@/components/admin/RecordPayoutModal";
import { RefundDialog } from "@/components/admin/RefundDialog";
import { money } from "@/services/billingService";
import { Loader2, CheckCircle2, Clock, Check, ChevronRight, FileText, Search } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { SortHeader, sortRows, type Sort } from "@/components/ui/SortHeader";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";

type TabId = "owed" | "invoices" | "tax";
type InvoiceCol = "description" | "kind" | "status" | "amount";

/** What a family would call it, rather than the column value. */
const KIND_LABELS: Record<string, string> = {
  tutoring: "Tutoring",
  admissions: "Counselling",
};

const TABS: { id: TabId; label: string }[] = [
  { id: "owed", label: "Owed" },
  { id: "invoices", label: "Invoices" },
  { id: "tax", label: "Tax forms" },
];

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
  const [tab, setTab] = useState<TabId>("owed");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort<InvoiceCol>>({ col: "description", dir: "asc" });
  const [kind, setKind] = useState("all");
  const [payState, setPayState] = useState("all");

  // The two filters compose in the order they are read: what it was for, then
  // where the money got to.
  const shownInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched = invoices.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (payState !== "all" && i.status !== payState) return false;
      if (!needle) return true;
      return (
        (i.description ?? "").toLowerCase().includes(needle) ||
        (i.parent_name ?? "").toLowerCase().includes(needle)
      );
    });

    // Status sorts by how settled the money is rather than alphabetically, so
    // one click brings everything still owed to the top.
    const rank: Record<string, number> = { open: 0, failed: 1, paid: 2, void: 3 };
    return sortRows(matched, sort, (i) => {
      switch (sort.col) {
        case "kind": return i.kind ?? "";
        case "status": return rank[i.status] ?? 9;
        case "amount": return i.amount_cents;
        default: return (i.description ?? "").toLowerCase();
      }
    });
  }, [invoices, kind, payState, search, sort]);

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
          hideStatsOnMobile
          tabs={TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px border-b-2 px-4 py-3 text-[14px] font-medium transition-colors",
                tab === t.id
                  ? "border-white font-semibold text-white"
                  : "border-transparent text-white/70 hover:border-white/40 hover:text-white"
              )}
            >
              {t.label}
              {t.id === "owed" && payouts.length > 0 && (
                <span className="ml-2 text-[12px] tabular-nums text-white/60">{payouts.length}</span>
              )}
            </button>
          ))}
        />

        <div className="p-6 md:p-10">
          {/* Tutor payouts */}
          <div className={cn(tab !== "owed" && "hidden")}>
            {payouts.length === 0 ? (
              <p className="text-[14px] text-muted-foreground py-4">Nothing owed. Everybody is settled.</p>
            ) : (
              <div className="divide-y divide-border border-b border-border">
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
          <div className={cn(tab !== "invoices" && "hidden")}>
            {/* Search first and wide, filters after, matching the tutor's
                earnings page so the two read as the same kind of table. */}
            <div className="mb-6 flex flex-wrap items-center gap-6">
              <div className="flex min-w-[220px] flex-1 items-center gap-2 border-b border-border px-1 py-2 focus-within:border-primary">
                <Search size={16} className="shrink-0 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by what was bought, or the family"
                  className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Dropdown value={kind} onChange={setKind} options={KINDS} className="w-[190px]" />
              <Dropdown value={payState} onChange={setPayState} options={PAY_STATES} className="w-[170px]" />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
            ) : shownInvoices.length === 0 ? (
              <p className="text-center py-16 text-[14px] text-muted-foreground">
                {invoices.length === 0 ? "No invoices yet." : "Nothing matches those filters."}
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="w-8 pb-2" />
                    <SortHeader label="What was bought" col="description" sort={sort} onSort={setSort} className="pr-4" />
                    <SortHeader label="Service" col="kind" sort={sort} onSort={setSort} className="pr-4" />
                    <SortHeader label="Status" col="status" sort={sort} onSort={setSort} align="right" className="pr-6" />
                    <SortHeader label="Amount" col="amount" sort={sort} onSort={setSort} align="right" className="pr-6" />
                    <th className="w-20 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {shownInvoices.map((inv) => {
                    const paid = inv.status === "paid";
                    const open = openInvoice === inv.id;
                    return (
                      <Fragment key={inv.id}>
                        <tr className="border-b border-border">
                          {/* Opening a row is how you find out whether the
                              lessons it bought actually happened, which the row
                              itself cannot say without becoming three lines. */}
                          <td className="py-4 align-middle">
                            <button
                              type="button"
                              onClick={() => setOpenInvoice(open ? null : inv.id)}
                              aria-label={open ? "Hide detail" : "Show detail"}
                              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <ChevronRight size={16} className={cn("transition-transform", open && "rotate-90")} />
                            </button>
                          </td>
                          <td className="py-4 pr-4 align-middle">
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:flex",
                                  paid
                                    ? "bg-tertiary/20 text-[#7d8f69]"
                                    : "bg-secondary/20 text-[#8a6a2a] dark:text-secondary"
                                )}
                              >
                                {paid ? <CheckCircle2 size={17} /> : <Clock size={15} />}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[14px] font-semibold text-[#111] dark:text-white">
                                  {inv.description}
                                </p>
                                <p className="truncate text-[12px] text-muted-foreground">
                                  {inv.parent_name} -{" "}
                                  {paid ? `paid ${fmtDate(inv.paid_at)}` : `created ${fmtDate(inv.created_at)}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          {/* Its own column now. Tutoring and counselling are
                              different businesses, and reading which one a row
                              belongs to should not mean parsing a subtitle. */}
                          <td className="py-4 pr-4 align-middle text-[13px] text-muted-foreground">
                            {KIND_LABELS[inv.kind] ?? inv.kind}
                          </td>
                          <td
                            className={cn(
                              "py-4 pr-6 text-right align-middle text-[12.5px] font-medium capitalize",
                              paid ? "text-primary" : "text-[#8a6a2a] dark:text-secondary"
                            )}
                          >
                            {inv.status}
                          </td>
                          <td className="py-4 pr-6 text-right align-middle text-[14px] font-semibold tabular-nums text-[#111] dark:text-white">
                            {money(inv.amount_cents, inv.currency)}
                          </td>
                          {/* Only a payment that was actually taken can be
                              given back. The dialog says what it costs first. */}
                          <td className="py-4 text-right align-middle">
                            {paid && (
                              <button
                                type="button"
                                onClick={() => setRefunding(inv)}
                                className="text-[12.5px] font-medium text-primary transition-colors hover:underline"
                              >
                                Refund
                              </button>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <InvoiceLines invoiceId={inv.id} currency={inv.currency} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className={cn(tab !== "tax" && "hidden")}>
            <TaxYear />
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


/**
 * Who needs a 1099, and what Stripe's draft form will get wrong.
 *
 * Yakal is the filer. Stripe issues a 1099-K only when the connected account
 * pays the processing fees, and ours are configured so the platform pays them,
 * so a 1099-NEC for everybody over the threshold is ours to send.
 *
 * The second number is the one worth having. Stripe builds its draft from what
 * moved through Stripe, and somebody paid by ACH or cheque because they never
 * finished onboarding is invisible to it. Stripe's dashboard takes an edited
 * total for exactly that case; this says which people need editing and by how
 * much, so nobody has to reconcile two systems by hand in January.
 */
function TaxYear() {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: years = [] } = useQuery({ queryKey: ["tax-years"], queryFn: getTaxYears });
  const { data: payees = [], isLoading } = useQuery({
    queryKey: ["tax-year-payees", year],
    queryFn: () => getTaxYearPayees(year),
  });

  const filing = payees.filter((p) => p.needsForm);
  const needsCorrection = filing.filter((p) => p.outsideStripeCents > 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border/50 pb-3">
        <FileText size={18} className="text-primary" />
        <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Tax forms</h3>
        <Dropdown
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={years.map((y) => ({ value: String(y), label: String(y) }))}
          className="ml-auto w-[120px]"
        />
      </div>

      <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
        Yakal files these, not Stripe. Anybody paid {money(FORM_1099_THRESHOLD_CENTS)} or more in{" "}
        {year} needs a 1099-NEC.{" "}
        {needsCorrection.length > 0 ? (
          <>
            <span className="font-semibold text-[#8a6a2a] dark:text-secondary">
              {needsCorrection.length} of them {needsCorrection.length === 1 ? "was" : "were"} paid
              partly outside Stripe
            </span>
            , so Stripe's draft form understates them. Correct the total in Stripe to the figure
            here before filing.
          </>
        ) : (
          "Stripe's own records cover everybody here, so its draft forms need no correction."
        )}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : payees.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-muted-foreground">
          Nobody has been paid in {year} yet.
        </p>
      ) : (
        <div className="divide-y divide-border border-t border-border">
          {payees.map((p) => (
            <div key={p.payeeId} className="flex items-center gap-4 p-4">
              <img
                src={dicebearUrl(p.name)}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[#111] dark:text-white">
                  {p.name}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">
                  {p.email ?? "no email on file"} - {p.paymentCount}{" "}
                  {p.paymentCount === 1 ? "payment" : "payments"}
                </p>
              </div>

              {/* What Stripe cannot see. Blank when there is nothing to correct,
                  so the column only speaks when it has something to say. */}
              <span className="w-40 shrink-0 text-right text-[12.5px] tabular-nums text-[#8a6a2a] dark:text-secondary">
                {p.outsideStripeCents > 0
                  ? `${money(p.outsideStripeCents)} outside Stripe`
                  : ""}
              </span>

              <span className="w-24 shrink-0 text-right text-[14px] font-semibold tabular-nums text-[#111] dark:text-white">
                {money(p.totalCents)}
              </span>

              <span
                className={cn(
                  "w-28 shrink-0 text-right text-[12.5px]",
                  p.needsForm ? "text-primary" : "text-muted-foreground"
                )}
              >
                {p.needsForm ? "1099 needed" : "under threshold"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
