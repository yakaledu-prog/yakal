import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getContactMessages, markContactHandled, type ContactMessage } from "@/services/adminService";
import { Loader2, Mail, Phone, Check, Inbox } from "lucide-react";
import { cn } from "@/utils/cn";

function fmtDate(d: string) {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const isNew = (m: ContactMessage) => m.status === "new" || !m.status;

type Tab = "inbox" | "new" | "handled";

export function AdminContact() {
  const qc = useQueryClient();
  const { data: messages = [], isLoading } = useQuery({ queryKey: ["admin-contact"], queryFn: getContactMessages });
  const [tab, setTab] = useState<Tab>("inbox");
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = messages.filter((m) => (tab === "new" ? isNew(m) : tab === "handled" ? !isNew(m) : true));
  const active = messages.find((m) => m.id === activeId) || null;
  const newCount = messages.filter(isNew).length;

  useEffect(() => {
    if (!activeId && filtered.length > 0) setActiveId(filtered[0].id);
  }, [filtered, activeId]);

  async function handle(id: string) {
    const res = await markContactHandled(id);
    if (!res.success) return toast.error(res.error || "Could not update.");
    qc.invalidateQueries({ queryKey: ["admin-contact"] });
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] flex flex-col">
        {/* Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>
          <div className="relative z-10 max-w-[1440px] mx-auto flex items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Contact messages</h1>
              <p className="text-white/80 text-[15px] mt-1">Enquiries submitted through your website</p>
            </div>
            <div className="flex items-center gap-10">
              <Stat label="New" value={newCount} />
              <Stat label="Total" value={messages.length} />
            </div>
          </div>
        </div>

        {/* Two-pane inbox */}
        <div className="flex-1 max-w-[1440px] mx-auto w-full flex flex-col md:flex-row min-h-0">
          {/* List */}
          <div className="w-full md:w-[380px] shrink-0 flex flex-col border-r border-[#e9edef] dark:border-[#2a3942]">
            <div className="flex border-b border-[#e9edef] dark:border-[#2a3942]">
              {(["inbox", "new", "handled"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("flex-1 py-3 text-[13px] font-semibold capitalize border-b-2 transition-colors",
                    tab === t ? "border-[#1099A1] text-[#1099A1]" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#1099A1]" /></div>
              ) : filtered.length === 0 ? (
                <p className="p-8 text-center text-[13px] text-muted-foreground">Nothing here.</p>
              ) : (
                filtered.map((m) => (
                  <button key={m.id} onClick={() => setActiveId(m.id)}
                    className={cn("w-full text-left px-4 py-3.5 border-b border-[#e9edef] dark:border-[#2a3942] transition-colors",
                      m.id === activeId ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("text-[14px] truncate", isNew(m) ? "font-bold text-[#111] dark:text-white" : "font-medium text-[#54656f] dark:text-[#aebac1]")}>
                        {m.first_name} {m.last_name}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(m.created_at)}</span>
                    </div>
                    <p className={cn("text-[13px] truncate mt-0.5", isNew(m) ? "text-[#111] dark:text-[#e9edef]" : "text-muted-foreground")}>
                      {m.subject || m.message}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Reading pane */}
          <div className="flex-1 min-w-0 hidden md:flex flex-col bg-[#f8f9fa] dark:bg-[#0b141a]">
            {active ? (
              <div className="p-8 max-w-2xl mx-auto w-full">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-[20px] font-bold text-[#111] dark:text-white">{active.subject || "No subject"}</h2>
                    <p className="text-[14px] text-muted-foreground mt-0.5">{active.first_name} {active.last_name}</p>
                  </div>
                  {isNew(active) && (
                    <button onClick={() => handle(active.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1099A1] text-white text-[13px] font-semibold hover:bg-[#0d848b] shrink-0">
                      <Check size={15} /> Mark handled
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground border-y border-[#e9edef] dark:border-[#2a3942] py-3 mb-5">
                  <a href={`mailto:${active.email}`} className="flex items-center gap-1.5 hover:text-[#1099A1]"><Mail size={14} /> {active.email}</a>
                  {active.phone && <span className="flex items-center gap-1.5"><Phone size={14} /> {active.phone}</span>}
                  <span>{new Date(active.created_at).toLocaleString()}</span>
                </div>
                <p className="text-[15px] text-[#111] dark:text-[#e9edef] leading-relaxed whitespace-pre-wrap">{active.message}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Inbox size={44} className="mb-3 opacity-50" />
                <p className="text-[15px] font-semibold text-[#111] dark:text-white">Select a message to read</p>
                <p className="text-[13px]">Choose an enquiry from the list to view its contents.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl font-bold leading-none">{value}</span>
      <span className="text-[11px] uppercase tracking-wider text-white/70 font-medium mt-1.5">{label}</span>
    </div>
  );
}
