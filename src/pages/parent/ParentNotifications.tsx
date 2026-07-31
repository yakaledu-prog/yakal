import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Check, Clock, Inbox, Loader2, Mail, Trash2, X } from "lucide-react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotifications,
  markNotificationRead,
  setNotificationArchived,
  sendNotification,
  type AppNotification,
} from "@/services/notificationService";
import { setChildService, type ServiceName } from "@/services/parentService";
import { cn } from "@/utils/cn";

// ============================================================
// The parent's inbox.
//
// Reads real notifications. It used to render a single hardcoded row, so a
// genuine request from a child was written to the database and then never
// shown to anybody, and approving it only raised a toast.
//
// An unlock request is granted from here directly: the parent is already
// looking at the ask, so sending them elsewhere to find a toggle is a step for
// no reason.
// ============================================================

const SERVICE_LABEL: Record<string, string> = {
  admissions: "College admissions",
  tutoring: "Tutoring",
};

function MinimalStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
    </div>
  );
}

/** Pulls the student and service out of an unlock request's link. */
function parseRequest(n: AppNotification): { studentId: string; service: ServiceName } | null {
  if (n.type !== "unlock_request" || !n.link) return null;
  const query = n.link.split("?")[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const studentId = params.get("student");
  const service = params.get("service") as ServiceName | null;
  if (!studentId || !service) return null;
  return { studentId, service };
}

function whenLabel(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function ParentNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"inbox" | "unread" | "archived">("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user?.id,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });

  const visible = useMemo(
    () =>
      notifications.filter((n) =>
        activeTab === "inbox" ? !n.archived : activeTab === "unread" ? !n.isRead && !n.archived : n.archived
      ),
    [notifications, activeTab]
  );

  const active = notifications.find((n) => n.id === selectedId) ?? null;
  const request = active ? parseRequest(active) : null;
  const unreadCount = notifications.filter((n) => !n.isRead && !n.archived).length;

  async function open(n: AppNotification) {
    setSelectedId(n.id);
    if (n.isRead) return;
    try {
      await markNotificationRead(n.id);
      await refresh();
    } catch {
      // A failed read receipt is not worth interrupting anyone for.
    }
  }

  async function toggleArchive(n: AppNotification) {
    try {
      await setNotificationArchived(n.id, !n.archived);
      setSelectedId(null);
      await refresh();
      toast.success(n.archived ? "Moved back to the inbox" : "Archived");
    } catch (err: any) {
      toast.error(err.message ?? "Could not archive that");
    }
  }

  /** Grants or refuses the request, and tells the child either way. */
  async function decide(approve: boolean) {
    if (!active || !request) return;
    setBusy(true);
    try {
      if (approve) {
        const result = await setChildService(request.studentId, request.service, true);
        if (!result.success) throw new Error(result.error);
      }
      await sendNotification({
        userId: request.studentId,
        title: approve ? "Access granted" : "Request not approved",
        message: approve
          ? `${SERVICE_LABEL[request.service] ?? request.service} is now available on your account.`
          : `Your request for ${SERVICE_LABEL[request.service] ?? request.service} was not approved.`,
        link: approve ? "/student/explore" : null,
      });
      await setNotificationArchived(active.id, true);
      setSelectedId(null);
      await refresh();
      toast.success(approve ? "Unlocked for your child" : "Request declined");
    } catch (err: any) {
      toast.error(err.message ?? "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageWrapper className="!p-0 h-full overflow-hidden">
      <div className="flex flex-col h-full min-h-0 bg-background">
        <div className="bg-[#1099A1] text-white pt-6 px-6 pb-6 md:pt-8 md:px-8 relative overflow-hidden shrink-0">
          <svg
            className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none"
            viewBox="0 0 400 200" preserveAspectRatio="none" fill="none" aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          </svg>
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Notifications</h1>
              <p className="text-white/80 text-[13px] mt-1">
                Alerts and requests from your children.
              </p>
            </div>
            <div className="flex items-center gap-8">
              <MinimalStat label="Unread" value={unreadCount} />
              <MinimalStat label="Total" value={notifications.filter((n) => !n.archived).length} />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <div className="w-full md:w-[380px] md:shrink-0 border-r border-border flex flex-col min-h-0">
            <div className="flex items-center border-b border-border shrink-0">
              {(["inbox", "unread", "archived"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={cn(
                    "flex-1 py-3 text-[13px] font-medium capitalize border-b-2 transition-colors",
                    activeTab === t
                      ? "border-[#1099A1] text-[#1099A1]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {isLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="animate-spin text-[#1099A1]" size={22} />
                </div>
              ) : visible.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <Inbox size={32} className="mx-auto text-[#aebac1] mb-2" />
                  <p className="text-[14px] font-medium text-foreground">Nothing here</p>
                  <p className="text-[12.5px] text-muted-foreground mt-1">
                    {activeTab === "archived"
                      ? "Archived notifications appear here."
                      : "Requests from your children will show up here."}
                  </p>
                </div>
              ) : (
                visible.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => open(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-border/60 transition-colors",
                      selectedId === n.id ? "bg-muted/60" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-[14px] truncate",
                          n.isRead ? "text-foreground font-medium" : "text-foreground font-bold"
                        )}
                      >
                        {n.title}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground shrink-0">
                        {whenLabel(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-muted-foreground truncate mt-0.5">{n.message}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {!active ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <Mail size={36} className="text-[#aebac1] mb-3" />
                <p className="text-[15px] font-semibold text-foreground">No notification selected</p>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Pick one on the left to read it.
                </p>
              </div>
            ) : (
              <>
                {/* Subject sits on the action row rather than above it: the
                    toolbar was otherwise an unlabelled strip of icons. */}
                <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-border shrink-0">
                  <h2 className="flex-1 min-w-0 text-[15px] md:text-[16px] font-bold text-foreground truncate">
                    {active.title}
                  </h2>
                  <span className="hidden sm:flex items-center gap-1 text-[12px] text-muted-foreground shrink-0">
                    <Clock size={12} />
                    {whenLabel(active.createdAt)}
                  </span>
                  <button
                    onClick={() => toggleArchive(active)}
                    title={active.archived ? "Move back to inbox" : "Archive"}
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
                  >
                    {active.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  </button>
                  <button
                    onClick={() => toggleArchive(active)}
                    title="Dismiss"
                    className="p-2 rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                  <p className="text-[14.5px] text-foreground leading-relaxed">{active.message}</p>

                  {request && (
                    <div className="mt-5 border border-border rounded-2xl p-4 bg-muted/30 max-w-lg">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            Service
                          </p>
                          <p className="text-[14px] font-semibold text-foreground mt-0.5">
                            {SERVICE_LABEL[request.service] ?? request.service}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decide(false)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium border border-border hover:bg-muted/60 disabled:opacity-50 transition-colors"
                          >
                            <X size={14} /> Decline
                          </button>
                          <button
                            onClick={() => decide(true)}
                            disabled={busy}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#1099A1] text-white hover:bg-[#0d7f86] disabled:opacity-50 transition-colors"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Unlock
                          </button>
                        </div>
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-3">
                        Unlocking turns this on for your child straight away, and they are told.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
