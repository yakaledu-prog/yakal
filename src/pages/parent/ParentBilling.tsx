import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { CreditCard, ExternalLink, Clock, CheckCircle2, Loader2, BarChart2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import {
  getInvoices, summarize, startCheckout, confirmCheckout, getCustomerPortalUrl,
  getPaymentMethods, money, type Invoice, type SavedCard,
} from "@/services/billingService";
import {
  getLinkedChildren, getChildServices, setChildService, type ChildService, type ServiceName,
} from "@/services/parentService";

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const SERVICE_LABEL: Record<string, string> = {
  tutoring: "Tutoring",
  admissions: "College Admissions",
  registration: "Registration",
  other: "Other",
};
const CATEGORY_COLORS: Record<string, string> = {
  Tutoring: "#1099A1",
  "College Admissions": "#CAA25F",
  Registration: "#97CE9D",
  Other: "#8696a0",
};
const serviceLabel = (kind: string) => SERVICE_LABEL[kind] || "Other";

export function ParentBilling() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: () => getInvoices(user!.id),
    enabled: !!user?.id,
  });
  const { data: cards = [] } = useQuery({
    queryKey: ["payment-methods", user?.id],
    queryFn: () => getPaymentMethods(),
    enabled: !!user?.id,
  });
  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });
  const childIds = children.map((c) => c.id);
  const { data: services = [] } = useQuery({
    queryKey: ["child-services", childIds.join(",")],
    queryFn: () => getChildServices(childIds),
    enabled: childIds.length > 0,
  });

  const open = invoices.filter((i) => i.status === "open");
  const paid = invoices.filter((i) => i.status === "paid");
  const summary = summarize(invoices);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((i) => map.set(serviceLabel(i.kind), (map.get(serviceLabel(i.kind)) || 0) + i.amount_cents));
    return Array.from(map, ([kind, cents]) => ({ kind, amount: cents / 100 }));
  }, [invoices]);

  // Handle the return from Stripe Checkout (confirm-on-return; webhook is the backstop).
  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      const sessionId = searchParams.get("session_id");
      (async () => {
        if (sessionId) await confirmCheckout(sessionId);
        toast.success("Payment received - thank you!");
        qc.invalidateQueries({ queryKey: ["invoices", user?.id] });
        qc.invalidateQueries({ queryKey: ["payment-methods", user?.id] });
      })();
      searchParams.delete("paid");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("canceled") === "1") {
      toast("Checkout canceled - no charge was made.");
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
  }

  // Open the portal in a NEW TAB. Open the tab synchronously to dodge popup blockers.
  async function portal() {
    const w = window.open("", "_blank");
    setBusy("portal");
    const { url, error } = await getCustomerPortalUrl();
    setBusy(null);
    if (error || !url) {
      w?.close();
      toast.error(error || "Could not open the billing portal.");
      return;
    }
    if (w) w.location.href = url;
    else window.open(url, "_blank");
  }

  async function toggleService(studentId: string, service: ServiceName, next: boolean) {
    // optimistic
    qc.setQueryData<ChildService[]>(["child-services", childIds.join(",")], (prev = []) => {
      const found = prev.find((s) => s.student_id === studentId && s.service === service);
      if (found) return prev.map((s) => (s === found ? { ...s, is_active: next } : s));
      return [...prev, { id: `tmp-${Date.now()}`, student_id: studentId, service, is_active: next }];
    });
    const { error } = await setChildService(studentId, service, next);
    if (error) toast.error(error);
    qc.invalidateQueries({ queryKey: ["child-services", childIds.join(",")] });
  }

  const serviceState = (studentId: string, service: ServiceName) =>
    services.find((s) => s.student_id === studentId && s.service === service)?.is_active ?? false;

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
                className="h-11 px-6 font-bold !bg-white !text-[#1099A1] hover:!bg-white/90 rounded-full text-[14px] self-start md:self-auto shadow-sm"
              >
                {busy === "all" ? <Loader2 size={16} className="animate-spin" /> : `Pay all - ${money(summary.balanceDueCents)}`}
              </Button>
            )}
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-6 md:p-10 flex flex-col lg:flex-row gap-10 lg:gap-16">
          {/* Left */}
          <div className="flex-1 min-w-0 space-y-12">
            {/* Manage Services */}
            {children.length > 0 && (
              <div className="space-y-5">
                <div className="border-b border-border/50 pb-3">
                  <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Services</h3>
                  {/* <p className="text-[13px] text-muted-foreground mt-0.5">Choose which services each child is enrolled in</p> */}
                </div>
                <div className="grid md:grid-cols-1 gap-6">
                  {children.map((c) => (
                    <div key={c.id} className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5">
                      <div className="flex items-center gap-3 mb-5">
                        <img src={c.avatar_url || dicebearUrl(c.full_name)} alt="" className="w-10 h-10 rounded-full bg-muted" />
                        <div>
                          <h4 className="font-bold text-[15px]">{c.full_name}</h4>
                          <p className="text-xs text-muted-foreground">{c.grade_level || "Student"}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <ServiceRow label="Tutoring" active={serviceState(c.id, "tutoring")} onToggle={(v) => toggleService(c.id, "tutoring", v)} />
                        <ServiceRow label="Admissions" active={serviceState(c.id, "admissions")} onToggle={(v) => toggleService(c.id, "admissions", v)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions */}
            <div>
              <div className="border-b border-border/50 pb-3 mb-2">
                <h3 className="text-[18px] font-bold text-[#111] dark:text-white">Transactions</h3>
                {/* <p className="text-[13px] text-muted-foreground mt-0.5">Invoices and payment history</p> */}
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
                      <Button size="sm" onClick={() => pay([inv.id], inv.id)} disabled={busy !== null}
                        className="h-8 px-4 text-[12px] bg-[#1099A1] hover:bg-[#0d848b] text-white">
                        {busy === inv.id ? <Loader2 size={14} className="animate-spin" /> : "Pay"}
                      </Button>
                    </InvoiceRow>
                  ))}
                  {paid.map((inv) => <InvoiceRow key={inv.id} inv={inv} paid />)}
                </div>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="w-full lg:w-[360px] shrink-0 space-y-5">
            <h3 className="text-[14px] font-semibold text-muted-foreground uppercase tracking-wide">Payment method</h3>

            {/* Connected cards */}
            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5 space-y-4">
              {cards.length === 0 ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground"><CreditCard size={18} /></div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white">No card on file</p>
                    <p className="text-[12px] text-muted-foreground">Pay an invoice to add your first card.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {cards.map((card) => <CardRow key={card.id} card={card} />)}
                </div>
              )}

              <Button onClick={portal} disabled={busy !== null} variant="outline"
                className="w-full border border-primary text-primary flex items-center justify-center gap-2 text-[14px] font-semibold">
                {busy === "portal" ? <Loader2 size={16} className="animate-spin" /> : (
                  <>{cards.length ? "Manage payment methods" : "Add payment method"} <ExternalLink size={14} /></>
                )}
              </Button>
              {/* <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Lock size={12} /> Secured by Stripe - opens in a new tab.
              </p> */}
            </div>

            {/* Spending by category */}
            {byCategory.length > 0 && (
              <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-semibold text-[#111] dark:text-white">Spending by service</h3>
                  <BarChart2 size={16} className="text-muted-foreground" />
                </div>
                <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byCategory} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                      <XAxis dataKey="kind" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#8696a0" }} dy={4} />
                      <Tooltip
                        cursor={{ fill: "rgba(16,153,161,0.08)" }}
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="bg-white dark:bg-[#202c33] border border-border shadow-sm px-3 py-2 rounded text-[12px]">
                              <span className="font-semibold text-[#111] dark:text-white">{money((payload[0].value as number) * 100)}</span>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {byCategory.map((d) => <Cell key={d.kind} fill={CATEGORY_COLORS[d.kind] || CATEGORY_COLORS.Other} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function ServiceRow({ label, active, onToggle }: { label: string; active: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
      <div className="flex flex-col">
        <span className="font-semibold text-[13px]">{label}</span>
        <span className={cn("text-[11px] font-medium", active ? "text-emerald-600" : "text-muted-foreground")}>
          {active ? "Active" : "Inactive"}
        </span>
      </div>
      <button
        onClick={() => onToggle(!active)}
        className={cn("w-9 h-5 rounded-full relative transition-colors", active ? "bg-[#1099A1]" : "bg-muted-foreground/30 hover:bg-muted-foreground/40")}
        aria-label={`Toggle ${label}`}
      >
        <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all", active ? "right-0.5" : "left-0.5")} />
      </button>
    </div>
  );
}

function CardRow({ card }: { card: SavedCard }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-8 rounded-md border border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#0b141a] flex items-center justify-center">
        <span className="text-[10px] font-bold uppercase text-[#1434CB] dark:text-[#7aa2ff]">{card.brand}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#111] dark:text-white flex items-center gap-2">
          <span className="capitalize">{card.brand}</span> •••• {card.last4}
          {card.isDefault && <span className="text-[10px] font-semibold text-[#1099A1] bg-[#1099A1]/10 px-1.5 py-0.5 rounded">Default</span>}
        </p>
        {card.exp_month && card.exp_year && (
          <p className="text-[12px] text-muted-foreground">Expires {String(card.exp_month).padStart(2, "0")}/{card.exp_year}</p>
        )}
      </div>
    </div>
  );
}

function InvoiceRow({ inv, paid, children }: { inv: Invoice; paid: boolean; children?: React.ReactNode }) {
  return (
    <div className="group flex items-center justify-between py-4 border-b border-border/40 last:border-0 px-2 -mx-2 hover:bg-muted/10 transition-colors">
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn("hidden sm:flex shrink-0 w-10 h-10 rounded-full items-center justify-center",
          paid ? "bg-[#97CE9D]/20 text-[#7d8f69]" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400")}>
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
        <span className={cn("text-[14px] md:text-[15px] font-semibold", paid ? "text-muted-foreground" : "text-foreground")}>
          {money(inv.amount_cents, inv.currency)}
        </span>
        {children}
      </div>
    </div>
  );
}
