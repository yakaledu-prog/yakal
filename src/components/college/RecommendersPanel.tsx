import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Mail,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Recommendation, RecStatus } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { AddRecommenderModal, NewRecommender } from "./AddRecommenderModal";
import { InfoHint } from "@/components/ui/InfoHint";

/**
 * Recommendation letters.
 *
 * Tracks people and progress, not files. For US colleges the letter goes
 * straight from the recommender to Common App: the student never holds it, and
 * normally waives the right to read it, because a non-waived letter carries
 * less weight with admissions officers. A UI that invites a student to upload
 * "the signed letter" is modelling the wrong workflow and nudging them toward a
 * real mistake.
 */

const STATUS: { value: RecStatus; label: string }[] = [
  { value: "requested", label: "Asked" },
  { value: "received", label: "Invited on Common App" },
  { value: "submitted", label: "Letter submitted" },
];

/** The journey a letter makes, which is what the row is really tracking. */
const STEPS: { key: RecStatus; label: string }[] = [
  { key: "requested", label: "Asked" },
  { key: "received", label: "Invited" },
  { key: "submitted", label: "Submitted" },
];

const STATUS_RANK: Record<RecStatus, number> = {
  requested: 0,
  received: 1,
  submitted: 2,
};

/** What most colleges expect, and what the coverage line measures against. */
const TYPICAL_TEACHERS = 2;


export type { NewRecommender };

export function RecommendersPanel({
  recommendations,
  earliestDeadline,
  onAdd,
  onStatusChange,
  onRemove,
  saving,
}: {
  recommendations: Recommendation[];
  /** Used to work out whether an outstanding letter is now urgent. */
  earliestDeadline: string | null;
  onAdd: (r: NewRecommender) => void;
  onStatusChange: (id: string, status: RecStatus) => void;
  onRemove: (r: Recommendation) => void;
  saving: boolean;
}) {
  const [adding, setAdding] = useState(false);

  const submitted = recommendations.filter((r) => r.status === "submitted").length;
  const outstanding = recommendations.length - submitted;
  const missing = Math.max(0, TYPICAL_TEACHERS - recommendations.length);

  // Only a deadline still ahead can be chased toward. A closed one is history,
  // and "in -207 days" is what happens when that is not checked.
  const daysToDeadline = earliestDeadline
    ? Math.ceil((new Date(earliestDeadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const chase =
    outstanding > 0 && daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= 21;

  return (
    <div className="space-y-4">
      <AddRecommenderModal
        open={adding}
        onClose={() => setAdding(false)}
        onSubmit={(r) => {
          onAdd(r);
          setAdding(false);
        }}
        saving={saving}
      />

      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
          {recommendations.length === 0
            ? "Most colleges want two teacher letters plus one from your school counselor."
            : `${submitted} of ${recommendations.length} letters submitted`}
        </p>

        {missing > 0 && recommendations.length > 0 && (
          <span className="text-[13px] text-[#CAA25F]">
            {missing} more teacher{missing === 1 ? "" : "s"} typically expected
          </span>
        )}

        <div className="flex-1" />

        {(
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1099A1] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d848b]"
          >
            <Plus size={15} />
            Add recommender
          </button>
        )}
      </div>

      {chase && (
        <div className="flex items-start gap-2 rounded-xl border border-[#CAA25F]/40 bg-[#CAA25F]/10 p-3">
          <AlertTriangle
            size={15}
            className="mt-0.5 shrink-0 text-[#8a6a2f] dark:text-[#e0c48a]"
          />
          <p className="text-[13px] leading-relaxed text-[#8a6a2f] dark:text-[#e0c48a]">
            {outstanding} letter{outstanding === 1 ? " is" : "s are"} still
            outstanding and your first deadline is in {daysToDeadline} days. Send
            a polite reminder now rather than in the final week.
          </p>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e9edef] py-12 text-center dark:border-[#2a3942]">
          <p className="text-[14px] text-[#111] dark:text-white">No recommenders yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#717182]">
            Ask in person before the end of junior year. Teachers write dozens of
            these and the good slots go early.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...recommendations]
            .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
            .map((r) => (
              <RecommenderCard
                key={r.id}
                rec={r}
                onStatusChange={onStatusChange}
                onRemove={onRemove}
              />
            ))}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-[#717182]">
        <InfoHint
          text="Waiving means you agree not to read the letter. Admissions officers trust waived letters more, because the writer could be candid. Almost every applicant waives."
          size={13}
          className="mt-0.5"
        />
        Letters go straight from your recommender to Common App, so you never
        handle the file yourself. Remember to waive your right to view them.
      </p>
    </div>
  );
}

function RecommenderCard({
  rec,
  onStatusChange,
  onRemove,
}: {
  rec: Recommendation;
  onStatusChange: (id: string, status: RecStatus) => void;
  onRemove: (r: Recommendation) => void;
}) {
  const [open, setOpen] = useState(false);
  const rank = STATUS_RANK[rec.status];
  const submitted = rec.status === "submitted";

  const initials = rec.recommender_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const askedDays = rec.asked_on
    ? Math.floor((Date.now() - new Date(rec.asked_on).getTime()) / 86_400_000)
    : null;

  return (
    <div className="overflow-hidden rounded-xl border border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#182229]">
      <div className="flex items-center gap-3 p-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-medium",
            submitted
              ? "bg-[#1099A1]/12 text-[#0d757b] dark:text-[#5fc9cf]"
              : "bg-[#f3f3f5] text-[#717182] dark:bg-[#1c2a32]"
          )}
        >
          {initials}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] text-[#111] dark:text-white">
              {rec.recommender_name}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 text-[#a8adb8] transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
          <div className="truncate text-[12px] text-[#717182]">
            {rec.relationship || "Recommender"}
            {/* Three weeks is the courtesy window teachers expect, so how long
                ago you asked is the fact that decides whether to nudge. */}
            {askedDays !== null && !submitted && (
              <span className={cn(askedDays >= 21 && "text-[#CAA25F]")}>
                {" · asked "}
                {askedDays === 0 ? "today" : `${askedDays} days ago`}
              </span>
            )}
          </div>
        </button>

        {/* The journey, not just where it ended up. */}
        <ol className="hidden shrink-0 items-center gap-1 sm:flex">
          {STEPS.map((step, i) => {
            const reached = rank >= i;
            return (
              <li key={step.key} className="flex items-center gap-1">
                <span
                  title={step.label}
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[10px] transition-colors",
                    reached
                      ? "bg-[#1099A1] text-white"
                      : "bg-[#f3f3f5] text-[#a8adb8] dark:bg-[#1c2a32]"
                  )}
                >
                  {reached ? <Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "h-px w-4",
                      rank > i ? "bg-[#1099A1]" : "bg-[#e9edef] dark:bg-[#2a3942]"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <Dropdown
          value={rec.status}
          onChange={(v) => onStatusChange(rec.id, v as RecStatus)}
          options={STATUS}
          size="sm"
          align="end"
          className="w-[190px] shrink-0"
          buttonClassName={cn(
            "font-normal",
            submitted && "border-[#1099A1]/40 font-medium text-[#1099A1]"
          )}
          ariaLabel={`Status for ${rec.recommender_name}`}
        />
      </div>

      {open && (
        <div className="space-y-3 border-t border-[#e9edef] px-3 py-3 dark:border-[#2a3942]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[#717182]">
            {rec.recommender_email ? (
              <a
                href={`mailto:${rec.recommender_email}`}
                className="inline-flex items-center gap-1 hover:text-[#1099A1]"
              >
                <Mail size={12} />
                {rec.recommender_email}
              </a>
            ) : (
              <span className="text-[#a8adb8]">
                No email yet. Common App needs one to send the invitation.
              </span>
            )}
            {rec.asked_on && (
              <span>Asked {new Date(rec.asked_on).toLocaleDateString()}</span>
            )}
            {rec.submitted_on && (
              <span>Submitted {new Date(rec.submitted_on).toLocaleDateString()}</span>
            )}
          </div>

          {!submitted && (
            <p className="text-[12px] leading-relaxed text-[#717182]">
              {rank === 0
                ? "Once they agree, add them as a recommender in Common App. It emails them the invitation and the link they submit through."
                : "Invited. Common App shows you when the letter lands, and nothing arrives in Yakal because the letter never passes through you."}
            </p>
          )}

          <div className="flex items-center gap-1 border-t border-[#e9edef] pt-3 dark:border-[#2a3942]">
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onRemove(rec)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[#d4183d] transition-colors hover:bg-[#d4183d]/10"
            >
              <Trash2 size={13} />
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
