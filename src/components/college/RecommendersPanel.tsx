import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Mail,
  MoreVertical,
  Plus,
  Search,
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
  ferpaReleasedOn = null,
  onAdd,
  onStatusChange,
  onRemove,
  onFerpaChange,
  saving,
  staff = false,
}: {
  recommendations: Recommendation[];
  /** Used to work out whether an outstanding letter is now urgent. */
  earliestDeadline: string | null;
  /** Null until the student says they have done it. */
  ferpaReleasedOn?: string | null;
  onAdd: (r: NewRecommender) => void;
  onStatusChange: (id: string, status: RecStatus) => void;
  onRemove: (r: Recommendation) => void;
  onFerpaChange?: (released: boolean) => void;
  saving: boolean;
  /**
   * A counselor is looking at somebody else's page.
   *
   * Every sentence here is written to the applicant, and the buttons are the
   * applicant's: ask a teacher, add one, remove one. A counselor reading this
   * was being addressed as the student and offered their moves, which is the
   * same thing the essay and document panels each did before.
   *
   * They keep the status control. Chasing a letter is the job, and they often
   * learn it landed before the student updates it.
   */
  staff?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const released = Boolean(ferpaReleasedOn);

  const q = search.trim().toLowerCase();
  const visible = q
    ? recommendations.filter((r) =>
      [r.recommender_name, r.relationship, r.recommender_email]
        .some((v) => (v ?? "").toLowerCase().includes(q))
    )
    : [...recommendations];

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
        {/* Only the empty state says anything here. A running count of letters
            submitted duplicated the three step dots on every card, which show
            the same thing per recommender and show which one is behind. */}
        {recommendations.length === 0 && (
          <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
            {staff
              ? "Most colleges want two teacher letters plus one from the school counselor."
              : "Most colleges want two teacher letters plus one from your school counselor."}
          </p>
        )}

        {missing > 0 && recommendations.length > 0 && (
          <span className="text-[13px] text-secondary">
            {missing} more teacher{missing === 1 ? "" : "s"} typically expected
          </span>
        )}

        <div className="flex-1" />

        <div className="relative min-w-0 flex-1 md:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a8adb8]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recommenders"
            className="h-9 w-full rounded-xl border border-[#e9edef] bg-white pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-primary dark:border-[#2a3942] dark:bg-[#182229]"
          />
        </div>

        {!staff && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <Plus size={15} />
            Add recommender
          </button>
        )}
      </div>

      {/* The release is one decision in Common App that applies to every college
          and every recommender, and until it is done the student cannot invite
          anybody at all. A page that lets them add three teachers and then sit
          waiting is hiding the reason nothing is moving, so it sits above the
          list rather than in the footnote it used to live in. */}
      <div
        className={cn(
          "flex items-start gap-2.5 rounded-xl border p-3",
          released
            ? "border-[#e9edef] dark:border-[#2a3942]"
            : "border-secondary/40 bg-secondary/10"
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={released}
          disabled={staff || saving}
          onClick={() => onFerpaChange?.(!released)}
          aria-label="FERPA release completed in Common App"
          className={cn(
            "mt-px grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
            released
              ? "border-primary bg-primary text-white"
              : "border-[#a8adb8] hover:border-primary",
            staff && "cursor-default opacity-70"
          )}
        >
          {released && <Check size={11} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[13px]",
              released
                ? "text-[#54656f] dark:text-[#aebac1]"
                : "font-medium text-[#8a6a2f] dark:text-[#e0c48a]"
            )}
          >
            FERPA release completed in Common App
            <InfoHint
              text={
                staff
                  ? "Waiving means the student agrees not to read the letters. Admissions officers trust waived letters more, because the writer could be candid. Almost every applicant waives."
                  : "Waiving means you agree not to read the letters. Admissions officers trust waived letters more, because the writer could be candid. Almost every applicant waives."
              }
              size={13}
              className="ml-1 align-middle"
            />
            {released && ferpaReleasedOn && (
              <span className="font-normal text-[#717182]">
                {" \u00b7 "}
                {new Date(ferpaReleasedOn).toLocaleDateString()}
              </span>
            )}
          </p>
          {!released && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#8a6a2f] dark:text-[#e0c48a]">
              {staff
                ? "Until this is done no recommender can be invited, whoever has agreed to write."
                : "Do this first, under Recommenders and FERPA in Common App. Until it is done you cannot invite anyone, however many teachers have said yes."}
            </p>
          )}
        </div>
      </div>

      {chase && (
        <div className="flex items-start gap-2 rounded-xl border border-secondary/40 bg-secondary/10 p-3">
          <AlertTriangle
            size={15}
            className="mt-0.5 shrink-0 text-[#8a6a2f] dark:text-[#e0c48a]"
          />
          <p className="text-[13px] leading-relaxed text-[#8a6a2f] dark:text-[#e0c48a]">
            {outstanding} letter{outstanding === 1 ? " is" : "s are"} still
            outstanding and {staff ? "the" : "your"} first deadline is in{" "}
            {daysToDeadline} days.{" "}
            {staff
              ? "Worth a nudge now rather than in the final week."
              : "Send a polite reminder now rather than in the final week."}
          </p>
        </div>
      )}

      {recommendations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e9edef] py-12 text-center dark:border-[#2a3942]">
          <p className="text-[14px] text-[#111] dark:text-white">No recommenders yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#717182]">
            {staff
              ? "Nobody has been asked yet. The good teacher slots go early in junior year."
              : "Ask in person before the end of junior year. Teachers write dozens of these and the good slots go early."}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[#717182]">
          Nobody matches "{search.trim()}".
        </p>
      ) : (
        <div className="space-y-2">
          {visible
            .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
            .map((r) => (
              <RecommenderCard
                key={r.id}
                rec={r}
                staff={staff}
                onStatusChange={onStatusChange}
                onRemove={onRemove}
              />
            ))}
        </div>
      )}

    </div>
  );
}

/**
 * One recommender, whole.
 *
 * This used to be an accordion. Everything worth knowing about a letter fits
 * on one line - who, what they teach, how long ago they were asked, where it
 * has got to - and hiding the email and the dates behind a chevron meant the
 * one fact that decides whether to nudge was a click away on every row.
 */
function RecommenderCard({
  rec,
  staff,
  onStatusChange,
  onRemove,
}: {
  rec: Recommendation;
  staff: boolean;
  onStatusChange: (id: string, status: RecStatus) => void;
  onRemove: (r: Recommendation) => void;
}) {
  const rank = STATUS_RANK[rec.status];
  const submitted = rec.status === "submitted";

  const initials = rec.recommender_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  /**
   * How long they have been waiting, when that is a real number.
   *
   * A date in the future gave "asked -17 days ago", which is the same bug the
   * deadline chase guards against a few lines up. Nothing sensible to say
   * about an ask that has not happened yet, so it says nothing.
   */
  const askedDays = rec.asked_on
    ? Math.floor((Date.now() - new Date(rec.asked_on).getTime()) / 86_400_000)
    : null;
  const waited = askedDays !== null && askedDays >= 0 ? askedDays : null;

  // One short line, and only while it is still true. Three weeks is the
  // courtesy window teachers expect.
  const hint = submitted
    ? null
    : rank === 0
      ? staff
        ? "Waiting for the student to add them in Common App."
        : "Add them in Common App once they say yes."
      : staff
        ? "Waiting on the letter. This status is what the student told us."
        : "Common App will let you know when it arrives.";

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        // A finished letter is the fact about the row, so it reads from across
        // the page rather than from the dropdown at the end of it. Same
        // treatment a verified document gets.
        submitted
          ? "border-primary/40 bg-primary/[0.04]"
          : "border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#182229]"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-medium",
            submitted
              ? "bg-primary/12 text-[#0d757b] dark:text-[#5fc9cf]"
              : "bg-[#f3f3f5] text-[#717182] dark:bg-[#1c2a32]"
          )}
        >
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[14px]",
              submitted ? "font-medium text-primary" : "text-[#111] dark:text-white"
            )}
          >
            {rec.recommender_name}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] text-[#717182]">
            <span className="truncate">{rec.relationship || "Recommender"}</span>
            {rec.recommender_email ? (
              <a
                href={`mailto:${rec.recommender_email}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate hover:text-primary"
              >
                <Mail size={11} className="shrink-0" />
                <span className="truncate">{rec.recommender_email}</span>
              </a>
            ) : (
              <span className="text-secondary">No email yet</span>
            )}
            {waited !== null && !submitted && (
              <span className={cn(waited >= 21 && "text-secondary")}>
                {waited === 0 ? "asked today" : `asked ${waited} days ago`}
              </span>
            )}
            {rec.submitted_on && (
              <span>submitted {new Date(rec.submitted_on).toLocaleDateString()}</span>
            )}
          </span>
        </div>

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
                      ? "bg-primary text-white"
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
                      rank > i ? "bg-primary" : "bg-[#e9edef] dark:bg-[#2a3942]"
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
            submitted && "border-primary/40 font-medium text-primary"
          )}
          ariaLabel={`Status for ${rec.recommender_name}`}
        />

        <RecommenderMenu rec={rec} staff={staff} onRemove={onRemove} />
      </div>

      {hint && (
        <p className="mt-1.5 pl-12 text-[12px] leading-snug text-[#717182]">{hint}</p>
      )}
    </div>
  );
}

/**
 * Who writes for a student is the student's relationship, so a counselor
 * tracks it and does not end it. They keep the email, which is how a nudge
 * actually happens.
 */
function RecommenderMenu({
  rec,
  staff,
  onRemove,
}: {
  rec: Recommendation;
  staff: boolean;
  onRemove: (r: Recommendation) => void;
}) {
  const [open, setOpen] = useState(false);

  const item =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${rec.recommender_name}`}
        aria-expanded={open}
        className="grid h-7 w-7 place-items-center rounded-lg text-[#a8adb8] transition-colors hover:bg-[#f3f3f5] hover:text-[#54656f] dark:hover:bg-[#1c2a32]"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-[#e9edef] bg-white py-1 shadow-lg dark:border-[#2a3942] dark:bg-[#182229]">
            {rec.recommender_email && (
              <a
                href={`mailto:${rec.recommender_email}`}
                target="_blank"
                rel="noreferrer"
                // Closed on the next tick, not in this handler. Setting state
                // here unmounted the anchor during the same commit, so React
                // took it out of the document before the browser acted on the
                // href and the click did nothing at all.
                onClick={() => setTimeout(() => setOpen(false), 0)}
                className={cn(item, "text-[#111] dark:text-white")}
              >
                <Mail size={14} className="text-[#717182]" />
                Email them
              </a>
            )}
            {!staff && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRemove(rec);
                }}
                className={cn(item, "text-[#d4183d]")}
              >
                <Trash2 size={14} />
                Remove
              </button>
            )}
            {staff && !rec.recommender_email && (
              <p className="px-3 py-1.5 text-[12px] text-[#a8adb8]">
                Nothing to do here yet
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
