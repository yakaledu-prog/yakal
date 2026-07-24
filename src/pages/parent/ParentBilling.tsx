import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { CreditCard, ExternalLink, Clock, CheckCircle2, Loader2, ShieldCheck, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getInvoices, summarize, startCheckout, confirmCheckout, openCustomerPortal, money, type Invoice } from "@/services/billingService";

function fmtDate(d?: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ParentBilling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null); // invoice id or "all" or "portal"

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: () => getInvoices(user!.id),
    enabled: !!user?.id,
  });

  const open = invoices.filter((i) => i.status === "open");
  const paid = invoices.filter((i) => i.status === "paid");
  const summary = summarize(invoices);

  // Handle the return from Stripe Checkout. We confirm the session directly
  // (works without the webhook); the webhook remains the production backstop.
  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      const sessionId = searchParams.get("session_id");
      (async () => {
        if (sessionId) await confirmCheckout(sessionId);
        toast.success("Payment received — thank you!");
        qc.invalidateQueries({ queryKey: ["invoices", user?.id] });
      })();
      searchParams.delete("paid");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("canceled") === "1") {
      toast("Checkout canceled — no charge was made.");
      searchParams.delete("canceled");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function pay(ids: string[], key: string) {
    if (ids.length === 0) return;
    setBusy(key);
    const { error } = await startCheckout(ids);
    if (error) {
      toast.error(error);
      setBusy(null);
    }
    // On success the browser is already redirecting to Stripe.
  }

  async function portal() {
    setBusy("portal");
    const { error } = await openCustomerPortal();
    if (error) {
      toast.error(error);
      setBusy(null);
    }
  }

  return (
    <PageWrapper>
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Header */}
        <div className="bg-[#1099A1] text-white pt-6 md:pt-10 px-6 md:px-10 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>
          <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/20 pb-8">
            <div className="space-y-1">
              <h1 className="text-white/80 text-[14px] font-medium uppercase tracking-wider mb-2">Total Balance Due</h1>
              <span className="text-4xl md:text-5xl font-bold tracking-tight">{money(summary.balanceDueCents)}</span>
              {summary.nextDueDate ? (
                <p className="text-white/70 text-[14px] pt-1">
                  Next payment due on <span className="font-bold text-white">{fmtDate(summary.nextDueDate)}</span>
                </p>
              ) : (
                <p className="text-white/70 text-[14px] pt-1">You're all paid up.</p>
              )}
            </div>
            {summary.balanceDueCents > 0 && (
              <Button
                onClick={() => pay(open.map((i) => i.id), "all")}
                disabled={busy !== null}
                className="h-11 px-6 font-bold bg-white text-[#1099A1] hover:bg-white/90 rounded-full text-[14px] self-start md:self-auto"
              >
                {busy === "all" ? <Loader2 size={16} className="animate-spin" /> : `Pay all — ${money(summary.balanceDueCents)}`}
              </Button>
            )}
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-6 md:p-10 flex flex-col lg:flex-row gap-10 lg:gap-16">
          {/* Transactions */}
          <div className="flex-1 min-w-0">
            <div className="border-b border-border/50 pb-3 mb-2">
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Transactions</h3>
              <p className="text-[13px] text-muted-foreground mt-0.5">Invoices and payment history</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <CreditCard size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-[14px]">No invoices yet.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {open.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} paid={false}>
                    <Button
                      size="sm"
                      onClick={() => pay([inv.id], inv.id)}
                      disabled={busy !== null}
                      className="h-8 px-4 text-[12px] bg-[#1099A1] hover:bg-[#0d848b] text-white"
                    >
                      {busy === inv.id ? <Loader2 size={14} className="animate-spin" /> : "Pay"}
                    </Button>
                  </InvoiceRow>
                ))}
                {paid.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} paid />
                ))}
              </div>
            )}
          </div>

          {/* Payment methods / Stripe */}
          <div className="w-full lg:w-[360px] shrink-0 space-y-5">
            <h3 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide">Payment</h3>

            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1099A1]/10 flex items-center justify-center text-[#1099A1]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[#111] dark:text-white">Secure checkout by Stripe</p>
                  <p className="text-[12px] text-muted-foreground">Cards are handled by Stripe — never stored on Yakal.</p>
                </div>
              </div>

              <Button
                onClick={portal}
                disabled={busy !== null}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 h-11 text-[14px] font-semibold"
              >
                {busy === "portal" ? <Loader2 size={16} className="animate-spin" /> : <>Manage payment methods <ExternalLink size={14} /></>}
              </Button>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock size={12} /> Opens your secure Stripe billing portal.
              </p>
            </div>

            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5">
              <p className="text-[13px] font-semibold text-[#111] dark:text-white mb-1.5">How billing works</p>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Your team issues an invoice for each package or service. Pay any invoice with a card via Stripe — you're
                only charged for what you approve. Receipts live in your Stripe billing portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function InvoiceRow({ inv, paid, children }: { inv: Invoice; paid: boolean; children?: React.ReactNode }) {
  return (
    <div className="group flex items-center justify-between py-4 border-b border-border/40 last:border-0 px-2 -mx-2 hover:bg-muted/10 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`hidden sm:flex shrink-0 w-10 h-10 rounded-full items-center justify-center ${paid ? "bg-[#97CE9D]/20 text-[#7d8f69]" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"}`}>
          {paid ? <CheckCircle2 size={18} /> : <Clock size={16} />}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-[14px] md:text-[15px] text-foreground truncate">{inv.description}</p>
          <p className="text-[12px] md:text-[13px] text-muted-foreground mt-0.5">
            {paid ? `Paid ${fmtDate(inv.paid_at)}` : inv.due_date ? `Due ${fmtDate(inv.due_date)}` : "Due now"}
            {" · "}<span className="capitalize">{inv.kind}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 pl-2">
        <span className={`text-[14px] md:text-[15px] font-semibold ${paid ? "text-muted-foreground" : "text-foreground"}`}>
          {money(inv.amount_cents, inv.currency)}
        </span>
        {children}
      </div>
    </div>
  );
}
