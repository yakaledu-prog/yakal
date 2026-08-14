import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { NotificationsScreen } from "@/components/shared/NotificationsScreen";
import { useAuth } from "@/contexts/AuthContext";
import {
  setNotificationArchived,
  sendNotification,
  type AppNotification,
} from "@/services/notificationService";
import { getIncomingLinkRequests, respondToChildLink } from "@/services/parentService";

// ============================================================
// The student's inbox.
//
// The screen is shared with every role. What is specific here is that only the
// student can accept a parent link: row level security lets the parent create
// the request and only the student change its status, so the decision has to be
// offered on this side.
// ============================================================

function ParentLinkRequest({
  notification,
  done,
}: {
  notification: AppNotification;
  done: () => Promise<void>;
}) {
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["incoming-link-requests", user?.id],
    queryFn: () => getIncomingLinkRequests(user!.id),
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="mt-5 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Checking the request...
      </div>
    );
  }

  // If it has already been answered there is nothing left to decide, so say so
  // rather than showing buttons that would fail.
  const request = requests[0];
  if (!request) {
    return (
      <p className="mt-5 text-[13px] text-muted-foreground">
        This request has already been answered.
      </p>
    );
  }

  async function decide(accept: boolean) {
    setBusy(true);
    try {
      const result = await respondToChildLink(request.id, accept);
      if (!result.success) throw new Error(result.error);

      await sendNotification({
        userId: request.parentId,
        title: accept ? "Link accepted" : "Link declined",
        message: accept
          ? `${profile?.full_name ?? "Your child"} accepted your request. You can now follow their progress.`
          : `${profile?.full_name ?? "Your child"} declined your request.`,
        link: accept ? "/parent/children" : null,
      });

      await setNotificationArchived(notification.id, true);
      await done();
      toast.success(accept ? "Linked to your parent" : "Request declined");
    } catch (err: any) {
      toast.error(err.message ?? "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border border-border rounded-2xl p-4 bg-muted/30 max-w-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Request from</p>
          <p className="text-[14px] font-semibold text-foreground mt-0.5 truncate">
            {request.parentName}
          </p>
          {request.parentEmail && (
            <p className="text-[12.5px] text-muted-foreground truncate">{request.parentEmail}</p>
          )}
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
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Accept
          </button>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground mt-3">
        Accepting lets them follow your progress and choose which services you can use.
      </p>
    </div>
  );
}

export function StudentNotifications() {
  return (
    <NotificationsScreen
      subtitle="Updates from your tutors, counselor and the Yakal team."
      emptyHint="Session reminders, assignment updates and replies will show up here."
      renderAction={(notification, done) =>
        notification.type === "parent_link" ? (
          <ParentLinkRequest notification={notification} done={done} />
        ) : null
      }
    />
  );
}
