import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { getMyRating, rateSession } from "@/services/sessions";

// ============================================================
// What the student thought.
//
// Asked once, at the end of the session, because that is when there is
// something to say. It is skippable: a rating nobody wanted to give is worse
// than no rating, and it would be the tutor who paid for it.
//
// The same dialog is reachable later from a past session that was never rated,
// so skipping is not the same as losing the chance.
// ============================================================

export function RateSessionDialog({
  sessionId,
  tutorId,
  tutorName,
  onClose,
}: {
  sessionId: string;
  tutorId: string;
  tutorName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [saving, setSaving] = useState(false);

  // Coming back to a session already rated should show that rating, not an
  // empty row of stars implying it was never given.
  useEffect(() => {
    void getMyRating(sessionId).then((existing) => {
      if (existing) setStars(existing);
    });
  }, [sessionId]);

  const submit = async () => {
    if (stars === 0) return;
    setSaving(true);
    const result = await rateSession(sessionId, tutorId, stars);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-popover shadow-xl">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h3 className="text-[18px] font-bold text-foreground">How was the session?</h3>
            <p className="text-[13px] text-muted-foreground">{tutorName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div
          className="flex items-center justify-center gap-2 py-10"
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
                size={34}
                className={
                  n <= shown ? "fill-[#CAA25F] text-[#CAA25F]" : "text-muted-foreground/40"
                }
              />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border p-5">
          <Button variant="outline" onClick={onClose} className="h-11 px-5">
            Not now
          </Button>
          <Button disabled={stars === 0 || saving} onClick={submit} className="h-11 px-6 font-semibold">
            {saving ? "Saving..." : "Submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
