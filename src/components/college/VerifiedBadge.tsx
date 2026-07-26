import { BadgeCheck, CircleDashed, Landmark } from "lucide-react";
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
  | "verified";

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
