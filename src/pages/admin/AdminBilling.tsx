import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getAllInvoices } from "@/services/adminService";
import { money } from "@/services/billingService";
import { Loader2, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/utils/cn";

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminBilling() {
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ["admin-invoices"], queryFn: getAllInvoices });

  const stats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid");
    const open = invoices.filter((i) => i.status === "open");
    return {
      revenue: paid.reduce((s, i) => s + i.amount_cents, 0),
      outstanding: open.reduce((s, i) => s + i.amount_cents, 0),
      paidCount: paid.length,
      openCount: open.length,
    };
  }, [invoices]);

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <AdminHeader
          stats={[
            { label: "Revenue", value: money(stats.revenue) },
            { label: "Outstanding", value: money(stats.outstanding) },
            { label: "Paid", value: stats.paidCount },
            { label: "Open", value: stats.openCount },
          ]}
        />

        <div className="max-w-[1440px] mx-auto p-6 md:p-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : invoices.length === 0 ? (
            <p className="text-center py-16 text-[14px] text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {invoices.map((inv) => {
                const paid = inv.status === "paid";
                return (
                  <div key={inv.id} className="flex items-center gap-4 p-4">
                    <div className={cn("hidden sm:flex w-10 h-10 rounded-full items-center justify-center shrink-0",
                      paid ? "bg-[#97CE9D]/20 text-[#7d8f69]" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400")}>
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
    </PageWrapper>
  );
}
