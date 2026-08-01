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
}: {
  session: ReschedulableSession;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<PickedSlot | null>(null);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    if (!picked) return;
    setSaving(true);

    const result = await rescheduleSession(session.id, picked.date, picked.startTime);
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
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#202c33]">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold text-foreground">Reschedule</h3>
            <p className="truncate text-[13px] text-muted-foreground">
              {session.title}, currently {readableDate(session.date, session.startTime)}
            </p>
          </div>
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

        <div className="flex items-center justify-end gap-3 border-t border-border p-5">
          <Button variant="outline" onClick={onClose} className="h-11 px-5">
            Cancel
          </Button>
          <Button disabled={!picked || saving} onClick={confirm} className="h-11 px-6 font-semibold">
            {saving
              ? "Moving..."
              : picked
                ? `Move to ${readableDate(picked.date, picked.startTime)}`
                : "Pick a new time"}
          </Button>
        </div>
      </div>
    </div>
  );
}
