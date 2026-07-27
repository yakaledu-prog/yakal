import { BadgeAlert, BadgeCheck, BadgeHelp, CircleDashed, Landmark } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Where a piece of data came from, and therefore how much it can be trusted.
 *
 * This is not decoration. The product promise is that nobody misses a deadline,
 * so a date a student typed must never look like a date a counselor checked.
 * If those two states are visually identical, a student's typo becomes Yakal's
 * failure.
 */
export type Provenance =
  /** Federal College Scorecard or IPEDS. Machine-loaded, not typed by anyone. */
  | "catalog"
  /** A student or parent entered it. Nobody has checked it. */
  | "unverified"
  /** A counselor confirmed it against the school's own page. */
  | "verified"
  /** Uploaded and queued for review. Nobody has looked at it yet. */
  | "pending"
  /** A counselor looked and found a problem. The reason travels with it. */
  | "needs_attention";

const CONFIG: Record<
  Provenance,
  { icon: typeof BadgeCheck; label: string; className: string; title: string }
> = {
  verified: {
    icon: BadgeCheck,
    label: "Verified",
    className: "text-[#1099A1]",
    title: "Checked by your counselor against the school's own page",
  },
  catalog: {
    icon: Landmark,
    label: "Federal data",
    className: "text-[#717182]",
    title: "From the US Department of Education College Scorecard",
  },
  unverified: {
    icon: CircleDashed,
    label: "Not verified",
    className: "text-[#CAA25F]",
    title: "Entered by you. Your counselor has not checked it yet.",
  },
  // Pending and needs_attention deliberately share BadgeCheck's shape. Three
  // states of one thing should look like a family, not three unrelated glyphs,
  // so the only thing that changes between them is what sits inside the badge.
  pending: {
    // BadgeHelp is lucide's question-mark badge; later releases renamed it
    // BadgeQuestionMark. Same glyph, and this version only has the old name.
    icon: BadgeHelp,
    label: "Pending review",
    // Brand gold, the same weight as any other "needs a human" state. Grey
    // read as disabled, which is the opposite of something awaiting action.
    className: "text-[#CAA25F]",
    title: "Uploaded. Your counselor has not reviewed it yet.",
  },
  needs_attention: {
    icon: BadgeAlert,
    label: "Needs attention",
    className: "text-[#d4183d]",
    title: "Your counselor found a problem with this file.",
  },
};

/**
 * Bare glyph, no pill and no tinted circle, so it reads as a property of the
 * value it sits beside rather than as its own UI element.
 */
export function VerifiedBadge({
  provenance,
  showLabel = false,
  size = 14,
  className,
}: {
  provenance: Provenance;
  showLabel?: boolean;
  size?: number;
  className?: string;
}) {
  const { icon: Icon, label, className: tone, title } = CONFIG[provenance];

  return (
    <span
      title={title}
      aria-label={title}
      className={cn("inline-flex items-center gap-1 align-middle", tone, className)}
    >
      <Icon size={size} strokeWidth={2} className="shrink-0" />
      {showLabel && (
        <span className="text-[11px] font-semibold leading-none">{label}</span>
      )}
    </span>
  );
}

/** Longer form for a detail row, where the "who and when" matters. */
export function ProvenanceNote({
  provenance,
  verifiedBy,
  verifiedAt,
  className,
}: {
  provenance: Provenance;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  className?: string;
}) {
  const when = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const text =
    provenance === "verified"
      ? `Verified by ${verifiedBy || "your counselor"}${when ? ` on ${when}` : ""}`
      : provenance === "catalog"
        ? "From the federal College Scorecard"
        : "You entered this. Your counselor has not checked it yet.";

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px]", className)}>
      <VerifiedBadge provenance={provenance} size={12} />
      <span className="text-muted-foreground">{text}</span>
    </span>
  );
}
