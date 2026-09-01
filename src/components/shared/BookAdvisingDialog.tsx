import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { AvailabilityPicker, type PickedSlot } from "@/components/shared/AvailabilityPicker";
import {
  bookAdvisingSlots,
  cancelAdvisingSession,
  getAdvisingSessions,
  getPlanPeople,
} from "@/services/admissionsService";

/**
 * Picking advising hours from the counsellor's calendar.
 *
 * Shared by the parent billing page and the student advising page: the family
 * database function book_advising_session lets either the student or an
 * actively linked parent book, so the same dialog serves both. It takes the
 * student it is booking for rather than a whole plan object, so a student can
 * open it for themselves without one.
 *
 * The cap below is a courtesy, not the rule. book_advising_session enforces the
 * allowance, the counsellor's other bookings and who may book for whom, and it
 * is the only thing that can: neither a parent nor a student has a direct
 * insert on sessions.
 */
export function BookAdvisingDialog({
  studentId,
  studentName,
  remaining,
  onClose,
}: {
  studentId: string;
  studentName: string | null;
  remaining: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<PickedSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  const { data: people, isLoading } = useQuery({
    queryKey: ["plan-people", studentId],
    queryFn: () => getPlanPeople(studentId),
  });
  const counselorId = people?.counselor?.id ?? null;

  const { data: booked = [] } = useQuery({
    queryKey: ["advising-sessions", studentId],
    queryFn: () => getAdvisingSessions(studentId),
  });

  async function release(sessionId: string) {
    setReleasing(sessionId);
    const { error } = await cancelAdvisingSession(sessionId);
    setReleasing(null);
    if (error) return toast.error(error);
    toast.success("That hour is free again.");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["advising-sessions", studentId] }),
      qc.invalidateQueries({ queryKey: ["admissions-usage", studentId] }),
      qc.invalidateQueries({ queryKey: ["slot-conflicts"] }),
    ]);
  }

  function toggle(slot: PickedSlot) {
    setPicked((prev) => {
      const on = prev.some((s) => s.key === slot.key);
      if (on) return prev.filter((s) => s.key !== slot.key);
      if (prev.length >= remaining) {
        toast.error(
          remaining === 1
            ? "One hour left this month."
            : `Only ${remaining} hours left this month.`
        );
        return prev;
      }
      return [...prev, slot];
    });
  }

  async function confirm() {
    if (picked.length === 0) return;
    setSaving(true);
    const { booked: madeCount, errors } = await bookAdvisingSlots(
      studentId,
      picked.map((s) => ({ date: s.date, startTime: s.startTime, durationMinutes: 60 }))
    );
    setSaving(false);

    if (madeCount > 0) {
      toast.success(`${madeCount} ${madeCount === 1 ? "session" : "sessions"} booked.`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admissions-usage", studentId] }),
        qc.invalidateQueries({ queryKey: ["advising-sessions", studentId] }),
        qc.invalidateQueries({ queryKey: ["student-sessions", studentId] }),
        qc.invalidateQueries({ queryKey: ["slot-conflicts"] }),
      ]);
    }
    // Reported rather than swallowed: an hour taken while this was open is the
    // one thing a family needs to hear about, and the rest still landed.
    for (const message of errors) toast.error(message);
    if (errors.length === 0) onClose();
    else setPicked([]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-foreground">Choose advising slots</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              For {studentName ?? "you"}. {remaining} {remaining === 1 ? "hour" : "hours"} left
              this month.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* What is already booked, and the way to give one back. Without
              this the dialog can only ever add, so a family whose allowance is
              spent has no way to move an hour. */}
          {booked.length > 0 && (
            <div className="mb-5 rounded-xl border border-border bg-muted/30 p-4">
              <p className="mb-2 text-[13px] font-medium text-foreground">Booked this month</p>
              <ul className="space-y-1.5">
                {booked.map((session) => (
                  <li key={session.id} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-muted-foreground">
                      {new Date(`${session.date}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {" at "}
                      {session.startTime}
                    </span>
                    {session.status === "upcoming" ? (
                      <button
                        type="button"
                        onClick={() => void release(session.id)}
                        disabled={releasing === session.id}
                        className="text-[12.5px] font-medium text-primary transition-opacity hover:underline disabled:opacity-50"
                      >
                        {releasing === session.id ? "Releasing..." : "Release"}
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-muted-foreground">Done</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={22} />
            </div>
          ) : !counselorId ? (
            <p className="py-12 text-center text-[14px] text-muted-foreground">
              No counsellor has been assigned yet. This usually sorts itself out within a
              day; get in touch if it does not.
            </p>
          ) : (
            <AvailabilityPicker
              tutorId={counselorId}
              studentId={studentId}
              selected={picked}
              onToggle={toggle}
              multiple
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 p-5">
          <Button variant="outline" onClick={onClose} className="h-10 px-5">
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={picked.length === 0 || saving}
            className="h-10 bg-primary px-5 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving
              ? "Booking..."
              : picked.length === 0
                ? "Book"
                : `Book ${picked.length} ${picked.length === 1 ? "session" : "sessions"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
