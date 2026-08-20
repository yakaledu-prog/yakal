import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { money } from "@/services/billingService";
import { cancelSession, previewCancellation } from "@/services/sessions";
import type { SessionListItem } from "@/components/shared/SessionList";

// ============================================================
// Calling off a lesson.
//
// The figure comes first. The published policy keeps half of a lesson
// cancelled inside 24 hours, and somebody about to lose money to a rule should
// read the rule and the amount before they act, not afterwards on a statement.
//
// The deadline is a date, never a countdown. A clock ticking down reads as a
// nudge to cancel, and it produces an argument about whose clock was right
// every time somebody misses it by a minute.
// ============================================================

function whenText(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CancelSessionDialog({
  session,
  onClose,
}: {
  session: SessionListItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: preview, isFetching } = useQuery({
    queryKey: ["cancel-preview", session.id],
    queryFn: () => previewCancellation(session.id),
  });

  async function confirm() {
    setBusy(true);
    const res = await cancelSession(session.id, reason.trim() || undefined);
    setBusy(false);

    if (res.error) return toast.error(res.error);

    // A cancellation that went through with a refund that did not is exactly
    // the state somebody has to be told about rather than left to notice.
    if (res.refundError) {
      toast.error(
        `The lesson is cancelled, but the refund did not go through: ${res.refundError}. Yakal has been told.`
      );
    } else if ((res.refundedCents ?? 0) > 0) {
      toast.success(
        `Cancelled. ${money(res.refundedCents!)} is on its way back to your card.`
      );
    } else {
      toast.success("Cancelled.");
    }

    await Promise.all([
      qc.invalidateQueries({ queryKey: ["sessions"] }),
      qc.invalidateQueries({ queryKey: ["tutor-sessions"] }),
      qc.invalidateQueries({ queryKey: ["student-sessions"] }),
      qc.invalidateQueries({ queryKey: ["parent-invoices"] }),
    ]);
    onClose();
  }

  const late = preview?.reason === "late";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-foreground">Cancel this lesson</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
              {session.title}
              {preview ? ` - ${whenText(preview.startsAt)}` : ""}
            </p>
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
          {isFetching && !preview ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              Checking what this means...
            </p>
          ) : preview?.error ? (
            <p className="text-[13px] text-secondary">{preview.error}</p>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed text-foreground">{preview?.explanation}</p>

              {(preview?.slotPriceCents ?? 0) > 0 && (
                <dl className="mt-3 space-y-2 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[13px] text-muted-foreground">Refunded to your card</dt>
                    <dd className="text-[15px] font-semibold tabular-nums text-foreground">
                      {money(preview!.refundCents)}
                    </dd>
                  </div>
                  {late && (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-[13px] text-muted-foreground">Kept, per the policy</dt>
                      <dd className="text-[15px] tabular-nums text-muted-foreground">
                        {money(preview!.slotPriceCents - preview!.refundCents)}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {/* The deadline, as a date. Only worth saying while it is still
                  ahead: after it, the amounts above have already said it. */}
              {preview && !late && preview.by === "family" && (
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  Free to cancel until {whenText(preview.freeUntil)}.
                </p>
              )}

              <label className="mt-4 block text-[12.5px] font-medium text-foreground">
                Why, if you would like to say. Optional.
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Your tutor will see this"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-primary"
                />
              </label>

              <div className="mt-5 flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={busy}
                  className="h-10 flex-1 border-border text-[14px] font-medium text-foreground transition-colors hover:bg-muted/50"
                >
                  Keep the lesson
                </Button>
                <Button
                  onClick={() => void confirm()}
                  disabled={busy || isFetching}
                  className="h-10 flex-1 bg-primary text-[14px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {busy ? "Cancelling..." : "Cancel lesson"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
