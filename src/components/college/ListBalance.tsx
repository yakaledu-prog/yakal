import { ExternalLink } from "lucide-react";
import { cn } from "@/utils/cn";
import { SchoolTier } from "@/services/collegeService";

export interface BalanceCounts {
  dream: number;
  target: number;
  safety: number;
}

const SEGMENTS: { key: SchoolTier; label: string; bar: string; dot: string }[] = [
  { key: "dream", label: "Reach", bar: "bg-secondary", dot: "bg-secondary" },
  { key: "target", label: "Target", bar: "bg-primary", dot: "bg-primary" },
  { key: "safety", label: "Safety", bar: "bg-[#8a97a0]", dot: "bg-[#8a97a0]" },
];

/**
 * Reads the shape of the list and says the one thing worth saying about it.
 *
 * Ordered by consequence, not by how easy each is to detect: a list with no
 * safety is the failure that ends an admissions cycle badly, so it outranks
 * everything else no matter what else is wrong.
 */
function advise(c: BalanceCounts, mismatches: number) {
  const total = c.dream + c.target + c.safety;
  if (total === 0) return null;

  if (c.safety === 0) {
    return {
      tone: "warn" as const,
      text: "No safety yet. Add at least one college you would be happy to attend and are confident about.",
      help: { label: "How to pick a real safety", url: "https://www.collegevine.com/faq/2851/what-is-a-safety-school" },
    };
  }
  if (total >= 5 && c.target === 0) {
    return {
      tone: "warn" as const,
      text: "No targets. Most admissions offers come from this middle band, so a list without it is fragile.",
      help: { label: "Reach, target and safety explained", url: "https://www.princetonreview.com/college-advice/safety-schools" },
    };
  }
  if (total >= 6 && c.dream / total > 0.5) {
    return {
      tone: "warn" as const,
      text: "This list is reach heavy. Balance it out before you start writing supplements.",
      help: { label: "Building a balanced list", url: "https://www.collegevine.com/faq/1417/how-many-colleges-should-i-apply-to" },
    };
  }
  if (mismatches > 0) {
    return {
      tone: "info" as const,
      text: `${mismatches} ${mismatches === 1 ? "college is" : "colleges are"} filed differently from what your scores suggest. Your counselor will review.`,
      help: null,
    };
  }
  if (total < 6) {
    return {
      tone: "info" as const,
      text: "Most students apply to between eight and twelve colleges.",
      help: null,
    };
  }
  return {
    tone: "ok" as const,
    text: "Your list is balanced across reach, target and safety.",
    help: null,
  };
}

export function ListBalance({
  counts,
  mismatches = 0,
  className,
}: {
  counts: BalanceCounts;
  /** Colleges whose declared tier disagrees with the computed fit. */
  mismatches?: number;
  className?: string;
}) {
  const total = counts.dream + counts.target + counts.safety;
  const advice = advise(counts, mismatches);

  return (
    <section
      className={cn(
        "rounded-xl border border-[#e9edef] bg-white p-4 dark:border-[#2a3942] dark:bg-[#182229]",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", s.dot)} />
            <span className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
              {s.label}
            </span>
            <span className="text-[13px] tabular-nums text-[#111] dark:text-white">
              {counts[s.key]}
            </span>
          </span>
        ))}
        <span className="ml-auto text-[13px] tabular-nums text-[#717182]">
          {total} total
        </span>
      </div>

      <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-[#f3f3f5] dark:bg-[#1c2a32]">
        {total === 0 ? (
          <span className="flex-1" />
        ) : (
          SEGMENTS.map((s) =>
            counts[s.key] > 0 ? (
              <span
                key={s.key}
                className={cn("h-full rounded-full transition-[width]", s.bar)}
                style={{ width: `${(counts[s.key] / total) * 100}%` }}
              />
            ) : null
          )
        )}
      </div>

      {advice && (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-[13px] leading-relaxed">
          <span
            className={cn(
              advice.tone === "warn"
                ? "text-[#8a6a2f] dark:text-[#e0c48a]"
                : "text-[#54656f] dark:text-[#aebac1]"
            )}
          >
            {advice.text}
          </span>
          {advice.help && (
            <a
              href={advice.help.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {advice.help.label}
              <ExternalLink size={11} />
            </a>
          )}
        </p>
      )}
    </section>
  );
}
