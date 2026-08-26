import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  DISPUTE_REASONS,
  getAttendance,
  reportSession,
  type DisputeReason,
} from "@/services/sessions";
import type { SessionListItem } from "@/components/shared/SessionList";

// ============================================================
// Telling us a lesson did not happen as booked.
//
// The counterpart to the hold. Money for a finished lesson sits with Yakal for
// 72 hours so that a complaint can arrive while it is still ours to give back,
// and until now there was no way to make one.
//
// It shows what our meeting client saw before asking what happened, because a
// parent who was not in the room often does not know, and "your tutor was
// there for 52 minutes" answers the question without an argument.
// ============================================================

function minutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export function ReportSessionDialog({
  session,
  onClose,
}: {
  session: SessionListItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<DisputeReason>("no_show");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: attendance, isFetching } = useQuery({
    queryKey: ["attendance", session.id],
    queryFn: () => getAttendance(session.id),
  });

  async function submit() {
    if (!detail.trim()) {
      toast.error("Tell us what happened, so somebody can look into it.");
      return;
    }
    setBusy(true);
    const res = await reportSession({ sessionId: session.id, reason, detail: detail.trim() });
    setBusy(false);

    if (res.error) return toast.error(res.error);

    toast.success(
      res.paymentHeld
        ? "Reported. The payment is on hold while somebody looks at it."
        : "Reported. Somebody will look at it and be in touch."
    );

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["sessions"] }),
      qc.invalidateQueries({ queryKey: ["student-sessions"] }),
      qc.invalidateQueries({ queryKey: ["parent-invoices"] }),
    ]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-foreground">Report a problem</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{session.title}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {/* What we saw, before what they think. A parent who was not in the
              room usually cannot say, and this often answers it outright. */}
          {isFetching ? (
            <p className="text-[13px] text-muted-foreground">Checking who joined...</p>
          ) : attendance ? (
            <dl className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[13px] text-muted-foreground">Tutor joined</dt>
                <dd className="text-[13.5px] font-medium text-foreground">
                  {attendance.tutorPresent ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[13px] text-muted-foreground">Student joined</dt>
                <dd className="text-[13.5px] font-medium text-foreground">
                  {attendance.studentPresent ? "Yes" : "No"}
                </dd>
              </div>
              {attendance.overlapSeconds > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[13px] text-muted-foreground">Both present for</dt>
                  <dd className="text-[13.5px] tabular-nums text-foreground">
                    about {minutes(attendance.overlapSeconds)}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="rounded-xl border border-border p-4 text-[13px] leading-relaxed text-muted-foreground">
              We have no record of anybody joining through Yakal. For a lesson held
              in person or on another link, that is normal and does not mean it
              did not happen.
            </p>
          )}

          <label className="mt-4 block text-[12.5px] font-medium text-foreground">
            What went wrong?
          </label>
          <Dropdown
            value={reason}
            onChange={(v) => setReason(v as DisputeReason)}
            options={DISPUTE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
            className="mt-1.5 w-full"
          />

          <label
            htmlFor="report-detail"
            className="mt-4 block text-[12.5px] font-medium text-foreground"
          >
            Tell us what happened
          </label>
          <textarea
            id="report-detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            placeholder="A sentence or two is plenty."
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-transparent p-3 text-[14px] text-foreground outline-none transition-colors focus:border-primary"
          />

          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Nothing is decided automatically. Payment for this lesson stops while
            somebody at Yakal reads it, and we will come back to you either way.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Never mind
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !detail.trim()}>
            {busy ? "Sending..." : "Report it"}
          </Button>
        </div>
      </div>
    </div>
  );
}
