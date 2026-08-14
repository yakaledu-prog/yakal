import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";

import { AvailabilityPicker, type PickedSlot } from "@/components/shared/AvailabilityPicker";
import { Button } from "@/components/ui/Button";
import { rescheduleSession } from "@/services/sessions";

// ============================================================
// Moving one session.
//
// Every role that can see a session can ask to move it, so this is shared
// rather than reimplemented per page. It draws the tutor's real hours through
// AvailabilityPicker and writes through reschedule_session, which refuses
// anything the picker should not have offered.
// ============================================================

export interface ReschedulableSession {
  id: string;
  title: string;
  date: string;
  startTime: string;
  tutorId: string | null;
  studentId?: string | null;
}

function readableDate(date: string, startTime: string) {
  const [h, m] = startTime.split(":").map(Number);
  const at = new Date(`${date}T00:00:00`);
  at.setHours(h, m ?? 0, 0, 0);
  return at.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RescheduleDialog({
  session,
  onClose,
  /**
   * Set when the tutor is the one moving it. They may move a session at any
   * time, including inside the 24 hours a client cannot, and in exchange they
   * say why: the student arranged a day around this, and no reason given is
   * what makes the change feel arbitrary rather than unavoidable.
   */
  askReason = false,
}: {
  session: ReschedulableSession;
  onClose: () => void;
  askReason?: boolean;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<PickedSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  const confirm = async () => {
    if (!picked) return;
    if (askReason && !reason.trim()) return toast.error("Give the student a reason for the change.");
    setSaving(true);

    const result = await rescheduleSession(session.id, picked.date, picked.startTime, reason.trim());
    setSaving(false);

    if (!result.success) {
      // The server's refusals are written to be read, so they are shown as
      // they are rather than flattened into "something went wrong".
      toast.error(result.error ?? "Could not move that session.");
      return;
    }

    toast.success(`Moved to ${readableDate(picked.date, picked.startTime)}.`);
    // Everything that counts sessions is now out of date, and the lists are
    // keyed per role, so the prefix is what gets invalidated.
    void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("session") });
    void queryClient.invalidateQueries({ queryKey: ["slot-conflicts"] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-popover shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-5 py-3">
          <h3 className="text-[18px] font-medium text-foreground">Reschedule</h3>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <AvailabilityPicker
            tutorId={session.tutorId}
            studentId={session.studentId}
            selected={picked ? [picked] : []}
            // One slot, so a second pick replaces the first rather than adding
            // to it. Tapping the chosen hour again clears it.
            onToggle={(slot) => setPicked((p) => (p?.key === slot.key ? null : slot))}
            currentSlot={{ date: session.date, startTime: session.startTime }}
          />

        </div>

        {/* After a slot is picked, not before. Asking why you are moving a
            session while nothing has been chosen is a question about a change
            that does not exist yet.

            In the footer rather than the scrolling body: below the picker it
            sat under the fold, so the confirm button looked broken, disabled
            with the field explaining why nowhere on screen. */}
        {askReason && picked && (
          <div className="border-t border-border px-5 pt-4">
            <label className="mb-1.5 block text-[13px] text-muted-foreground">
              Why are you moving it? The student sees this.
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Clashing appointment, sorry"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none transition-colors focus:border-primary"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 p-5">
          <p className="truncate text-[13px] text-muted-foreground flex-grow">
            {session.title}, currently {readableDate(session.date, session.startTime)}
          </p>
          <Button variant="outline" onClick={onClose} className="h-11 px-5 border border-muted">
            Cancel
          </Button>
          <Button disabled={!picked || saving || (askReason && !reason.trim())} onClick={confirm} className="h-11 px-6 font-semibold">
            {saving
              ? "Moving..."
              : !picked
                ? "Pick a new time"
                : askReason && !reason.trim()
                  ? "Add a reason"
                  : `Move to ${readableDate(picked.date, picked.startTime)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
