import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, X, CreditCard } from "lucide-react";
import { NotificationsScreen } from "@/components/shared/NotificationsScreen";
import {
  sendNotification,
  setNotificationArchived,
  type AppNotification,
} from "@/services/notificationService";
import type { ServiceName } from "@/services/parentService";

// ============================================================
// The parent's inbox.
//
// The screen itself is shared with every other role. What is specific here is
// that a parent can act on a child's request for a service.
//
// Access follows payment, so answering a request is not a toggle: the parent is
// sent to buy the service for that child. There is no "grant" that hands out
// something nobody paid for. Declining just tells the child.
// ============================================================

const SERVICE_LABEL: Record<string, string> = {
  admissions: "College admissions",
  tutoring: "Tutoring",
};

// Where each service is purchased for a specific child.
const BUY_HREF: Record<ServiceName, (childId: string) => string> = {
  admissions: (id) => `/parent/admissions?student=${id}`,
  tutoring: (id) => `/parent/courses?student=${id}`,
};

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

function UnlockRequest({
  notification,
  request,
  done,
}: {
  notification: AppNotification;
  request: { studentId: string; service: ServiceName };
  done: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const label = SERVICE_LABEL[request.service] ?? request.service;

  // Sending them to buy it for this child. The request stays until the purchase
  // creates the entitlement, which is what actually opens access.
  function setUp() {
    navigate(BUY_HREF[request.service](request.studentId));
  }

  async function decline() {
    setBusy(true);
    try {
      await sendNotification({
        userId: request.studentId,
        title: "Request not approved",
        message: `Your request for ${label} was not approved.`,
        link: null,
      });
      // Archiving it keeps a decided request out of the inbox.
      await setNotificationArchived(notification.id, true);
      await done();
      toast.success("Request declined");
    } catch (err: any) {
      toast.error(err.message ?? "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border border-border rounded-2xl p-4 bg-muted/30 max-w-lg">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Service</p>
          <p className="text-[14px] font-semibold text-foreground mt-0.5">{label}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={decline}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium border border-border hover:bg-muted/60 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Decline
          </button>
          <button
            onClick={setUp}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold bg-[#1099A1] text-white hover:bg-[#0d7f86] disabled:opacity-50 transition-colors"
          >
            <CreditCard size={14} /> Set up {label}
          </button>
        </div>
      </div>
      <p className="text-[12px] text-muted-foreground mt-3">
        Setting up takes you to buy this for your child. Access turns on once the payment goes
        through.
      </p>
    </div>
  );
}

export function ParentNotifications() {
  return (
    <NotificationsScreen
      subtitle="Alerts and requests from your children."
      emptyHint="Requests from your children will show up here."
      renderAction={(notification, done) => {
        const request = parseRequest(notification);
        if (!request) return null;
        return <UnlockRequest notification={notification} request={request} done={done} />;
      }}
    />
  );
}
