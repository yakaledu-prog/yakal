import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getContactMessages, markContactHandled, type ContactMessage } from "@/services/adminService";
import { Loader2, Phone, Inbox, Clock, Archive, Trash2Icon } from "lucide-react";
import { cn } from "@/utils/cn";

function fmtDate(d: string) {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const isNew = (m: ContactMessage) => m.status === "new" || !m.status;

// Tabs state
type Tab = "inbox" | "unread" | "archived";

export function AdminContact() {
  const qc = useQueryClient();
  const { data: messages = [], isLoading } = useQuery({ queryKey: ["admin-contact"], queryFn: getContactMessages });
  const [tab, setTab] = useState<Tab>("inbox");
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = messages.filter((m) => (tab === "unread" ? isNew(m) : tab === "archived" ? !isNew(m) : true));
  const active = messages.find((m) => m.id === activeId) || null;
  const unreadCount = messages.filter(isNew).length;

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
        {/* Massive Integrated Header */}
        <div className="bg-primary text-white p-6 md:p-10 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="max-w-[1440px] mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Notifications</h1>
                <p className="text-white/80 text-[15px]">Enquiries submitted through your website</p>
              </div>
              <div className="flex items-center gap-8">
                <MinimalStat label="Unread" value={unreadCount} />
                <MinimalStat label="Total" value={messages.length} />
              </div>
            </div>
          </div>
        </div>

        {/* Two-pane inbox */}
        <div className="flex-1 max-w-[1440px] mx-auto w-full flex flex-col md:flex-row min-h-0">
          {/* List */}
          <div className="w-full md:w-[380px] shrink-0 flex flex-col border-r border-[#e9edef] dark:border-[#2a3942]">
            <div className="flex border-b border-[#e9edef] dark:border-[#2a3942]">
              {(["inbox", "unread", "archived"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn("flex-1 py-3 text-[13px] font-semibold capitalize border-b-2 transition-colors",
                    tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
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

          {/* Reading pane (Gmail-style) */}
          <div className="flex-1 min-w-0 hidden md:flex flex-col bg-white dark:bg-[#111b21]">
            {active ? (
              <>
                <div className="p-6 md:p-8 overflow-y-auto flex-grow">
                  <h2 className="text-[24px] font-bold text-[#111] dark:text-white mb-6">{active.subject || "No subject"}</h2>

                  {/* Sender row */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[15px] shrink-0">
                      {(active.first_name?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-[#111] dark:text-white leading-tight">{active.first_name} {active.last_name}</p>
                      <a href={`mailto:${active.email}`} className="text-[12px] text-muted-foreground hover:text-primary">{active.email}</a>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 justify-center">
                      {active.phone && (
                        <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                          <Phone size={13} /> {active.phone}
                        </p>
                      )}
                      <div className="text-[12px] text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <Clock size={13} /> {new Date(active.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#e9edef] dark:border-[#2a3942] my-6" />

                  <p className="text-[15px] text-[#111] dark:text-[#e9edef] leading-relaxed whitespace-pre-wrap">{active.message}</p>
                </div>

                {/* Action bar */}
                {(
                  <div className="flex items-center justify-end gap-1 px-6 py-2.5 border-t border-[#e9edef] dark:border-[#2a3942]">
                    {/* {isNew(active) && ( */}
                    <button onClick={() => handle(active.id)} title="Mark handled"
                      className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors">
                      <Archive size={18} />
                    </button>
                    <button onClick={() => handle(active.id)} title="Mark handled"
                      className="p-2 rounded-md text-muted-foreground hover:text-red-500/85 hover:bg-muted transition-colors">
                      <Trash2Icon size={18} />
                    </button>
                  </div>
                )}
              </>
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

function MinimalStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
    </div>
  );
}
