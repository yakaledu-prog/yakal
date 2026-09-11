import { cn } from "@/utils/cn";

/**
 * "Under review", as a stamp rather than a sentence.
 *
 * The house rule is plain coloured text for status, not tinted capsules, and
 * this is the one state that earns an exception. Every other status on an
 * essay is something the student is doing; this one is the moment the draft
 * has left their hands and is sitting on somebody's desk. A rubber stamp is
 * the thing that says that, and it says it without a sentence, which matters
 * because the label appears on a row that is already carrying a title, a
 * college, a word count and a deadline.
 *
 * Drawn as ink rather than as a badge: two rules, letterspaced small caps, a
 * few degrees off square, and slightly faded, because a stamp is pressed by
 * hand and never lands straight. The tilt is removed for anyone who has asked
 * for less motion, since a permanently rotated element is the static version
 * of the same complaint.
 *
 * One ink, and one moment. Gold, for a draft sitting on somebody else's desk.
 * Finished briefly had a stamp of its own and it was too much: the card is
 * already teal-edged and teal-tinted with a teal title, and a page where
 * everything is stamped has stamped nothing. A state that is simply the
 * student's turn needs no announcing at all.
 */
export function ReviewStamp({
  label = "Under review",
  className,
}: {
  label?: string;
  className?: string;
}) {

  return (
    <span
      className={cn(
        "relative inline-flex select-none items-center rounded-[3px] border-2 px-2 py-[3px]",
        "text-[10px] font-medium uppercase tracking-[0.16em]",
        "border-secondary/55 text-secondary",
        "-rotate-3 motion-reduce:rotate-0",
        className
      )}
      // The rotation is decoration; the words are the whole message.
      title={label}
    >
      {/* The second rule. A single border is a badge, two is a stamp. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[2px] rounded-[1px] border border-secondary/30"
      />
      {label}
    </span>
  );
}
