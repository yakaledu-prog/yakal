import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getContactMessages, markContactHandled } from "@/services/adminService";
import { Loader2, Mail, Check, Phone } from "lucide-react";
import { cn } from "@/utils/cn";

function fmtDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminContact() {
  const qc = useQueryClient();
  const { data: messages = [], isLoading } = useQuery({ queryKey: ["admin-contact"], queryFn: getContactMessages });

  const newCount = messages.filter((m) => m.status === "new" || !m.status).length;

  async function handle(id: string) {
    const res = await markContactHandled(id);
    if (!res.success) return toast.error(res.error || "Could not update.");
    qc.invalidateQueries({ queryKey: ["admin-contact"] });
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <AdminHeader
          stats={[
            { label: "Messages", value: messages.length },
            { label: "New", value: newCount },
          ]}
        />

        <div className="max-w-[1100px] mx-auto p-6 md:p-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : messages.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Mail size={40} className="mx-auto mb-3 opacity-50" />
              <p className="text-[14px]">No contact messages.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m) => {
                const isNew = m.status === "new" || !m.status;
                return (
                  <div key={m.id} className={cn("p-5 rounded-xl border bg-white dark:bg-[#111b21] border-[#e9edef] dark:border-[#2a3942]", isNew && "border-l-4 border-l-[#1099A1]")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[#111] dark:text-white">
                          {m.first_name} {m.last_name}
                          {m.subject && <span className="text-muted-foreground font-normal"> - {m.subject}</span>}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Mail size={12} /> {m.email}</span>
                          {m.phone && <span className="flex items-center gap-1"><Phone size={12} /> {m.phone}</span>}
                          <span>{fmtDate(m.created_at)}</span>
                        </div>
                      </div>
                      {isNew && (
                        <button onClick={() => handle(m.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[12px] font-semibold hover:bg-muted/40 shrink-0">
                          <Check size={13} /> Mark handled
                        </button>
                      )}
                    </div>
                    <p className="text-[14px] text-[#111] dark:text-[#e9edef] mt-3 leading-relaxed whitespace-pre-wrap">{m.message}</p>
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
