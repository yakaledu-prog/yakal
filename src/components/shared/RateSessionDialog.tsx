import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock, MessageSquare, Star, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { dicebearUrl } from "@/utils/avatar";
import { getMyRating, rateSession } from "@/services/sessions";

// ============================================================
// What the student thought.
//
// Asked once, at the end of the session, because that is when there is
// something to say. It is skippable: a rating nobody wanted to give is worse
// than no rating, and it would be the tutor who paid for it.
//
// The same dialog is reachable later from a past session that was never rated,
// so skipping is not the same as losing the chance. Which is exactly why it
// names the session: somebody rating a lesson three days afterwards, from a
// list of six, needs to know which one they are being asked about.
//
// The note is optional and stays optional. A number tells a tutor that
// something went wrong but never what, and the sentence that explains it is
// worth more than the score - but only when it is offered freely.
// ============================================================

export function RateSessionDialog({
  sessionId,
  tutorId,
  tutorName,
  tutorAvatarUrl,
  subject,
  startsAt,
  durationMinutes = 60,
  onClose,
}: {
  sessionId: string;
  tutorId: string;
  tutorName: string;
  tutorAvatarUrl?: string | null;
  /** What the lesson was about, e.g. "Chemistry". */
  subject?: string | null;
  /** When it ran, so the right session is being rated. */
  startsAt?: Date | null;
  durationMinutes?: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Coming back to a session already rated should show that rating, not an
  // empty row of stars implying it was never given.
  useEffect(() => {
    void getMyRating(sessionId).then((existing) => {
      if (!existing) return;
      setStars(existing.stars);
      setComment(existing.comment);
    });
  }, [sessionId]);

  const submit = async () => {
    if (stars === 0) return;
    setSaving(true);
    const result = await rateSession(sessionId, tutorId, stars, comment);
    setSaving(false);

    if (!result.success) {
      toast.error(result.error ?? "Could not save that rating.");
      return;
    }

    toast.success("Thanks, that helps.");
    void queryClient.invalidateQueries({ queryKey: ["session-extras"] });
    onClose();
  };

  const shown = hovered || stars;

  const endsAt = startsAt
    ? new Date(startsAt.getTime() + durationMinutes * 60_000)
    : null;
  const clock = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-popover shadow-xl">
        <div className="flex items-start justify-between p-6 pb-4">
          <h3 className="text-[22px] font-bold text-foreground">How was the session?</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Which lesson this is about. Asked days later from a list of six,
            the tutor's name alone does not narrow it down. */}
        <div className="flex items-center gap-4 border-b border-border px-6 pb-5">
          <img
            src={tutorAvatarUrl || dicebearUrl(tutorName)}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold text-foreground">{tutorName}</p>
            {subject && <p className="truncate text-[14px] text-[#1099A1]">{subject}</p>}
            {startsAt && endsAt && (
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {startsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} />
                  {clock(startsAt)} - {clock(endsAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="mb-4 text-center text-[15px] font-semibold text-foreground">
            Rate your experience
          </p>

          <div
            className="flex items-center justify-center gap-2"
            onMouseLeave={() => setHovered(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onMouseEnter={() => setHovered(n)}
                onClick={() => setStars(n)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={44}
                  strokeWidth={1.5}
                  className={
                    n <= shown
                      ? "fill-[#CAA25F] text-[#CAA25F]"
                      : "fill-transparent text-[#CAA25F]"
                  }
                />
              </button>
            ))}
          </div>

          {/* The prompt goes once a rating is picked: it has been answered. */}
          <p className="mt-3 text-center text-[13px] text-muted-foreground">
            {stars === 0 ? "Tap to rate your experience" : RATING_WORD[stars]}
          </p>

          <div className="relative mt-5">
            <MessageSquare
              size={16}
              className="pointer-events-none absolute left-3.5 top-3.5 text-muted-foreground"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Share a quick note about the session (optional)"
              className="w-full resize-none rounded-xl border border-border bg-transparent py-3 pl-10 pr-3.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[#1099A1]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border p-5">
          <button
            type="button"
            onClick={onClose}
            className="px-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Not now
          </button>
          <Button
            disabled={stars === 0 || saving}
            onClick={submit}
            className="h-11 px-8 font-semibold"
          >
            {saving ? "Saving..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Said back, so a tap registers as a judgement rather than a click. */
const RATING_WORD: Record<number, string> = {
  1: "Poor",
  2: "Not great",
  3: "Okay",
  4: "Good",
  5: "Excellent",
};
