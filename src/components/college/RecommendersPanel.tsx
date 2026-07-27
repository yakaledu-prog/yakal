import { useState } from "react";
import { AlertTriangle, Mail, Plus, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Recommendation, RecStatus } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { FieldLabel, InfoHint } from "@/components/ui/InfoHint";
import { DateField } from "@/components/ui/DateField";

/**
 * Recommendation letters.
 *
 * Deliberately tracks people and status rather than files. For US colleges the
 * letter goes straight from the recommender to Common App: the student never
 * holds it, and normally waives the right to read it, because a non-waived
 * letter carries less weight with admissions officers. A UI that invites a
 * student to upload "the signed letter" is modelling the wrong workflow and
 * nudging them toward a real mistake.
 */

const STATUS: { value: RecStatus; label: string }[] = [
  { value: "requested", label: "Asked" },
  { value: "received", label: "Invited on Common App" },
  { value: "submitted", label: "Letter submitted" },
];

const STATUS_RANK: Record<RecStatus, number> = {
  requested: 0,
  received: 1,
  submitted: 2,
};

const input =
  "h-11 w-full rounded-xl border border-[#e9edef] bg-white px-3 text-[14px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white";

export interface NewRecommender {
  recommender_name: string;
  recommender_email: string | null;
  relationship: string | null;
  status: RecStatus;
  notes: string | null;
}

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [askedOn, setAskedOn] = useState<string | null>(null);

  const submitted = recommendations.filter((r) => r.status === "submitted").length;
  const outstanding = recommendations.length - submitted;

  // Three weeks is the courtesy window teachers expect, so anything still
  // outstanding inside it is worth chasing rather than waiting on.
  const daysToDeadline = earliestDeadline
    ? Math.ceil((new Date(earliestDeadline).getTime() - Date.now()) / 86_400_000)
    : null;
  const chase = outstanding > 0 && daysToDeadline !== null && daysToDeadline <= 21;

  const reset = () => {
    setName(""); setEmail(""); setRole(""); setAskedOn(null); setAdding(false);
  };

  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      recommender_name: name.trim(),
      recommender_email: email.trim() || null,
      relationship: role.trim() || null,
      status: "requested",
      notes: askedOn ? `Asked on ${askedOn}` : null,
    });
    reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
          {recommendations.length === 0
            ? "Most colleges ask for two teacher letters plus one from your school counselor."
            : `${submitted} of ${recommendations.length} letters submitted`}
        </p>
        <div className="flex-1" />
        {!adding && (
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
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#8a6a2f] dark:text-[#e0c48a]" />
          <p className="text-[13px] leading-relaxed text-[#8a6a2f] dark:text-[#e0c48a]">
            {outstanding} letter{outstanding === 1 ? " is" : "s are"} still
            outstanding and your first deadline is in {daysToDeadline} days. Send a
            polite reminder now rather than in the final week.
          </p>
        </div>
      )}

      {adding && (
        <div className="space-y-4 rounded-xl border border-[#e9edef] p-4 dark:border-[#2a3942]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="rec-name">Name</FieldLabel>
              <input
                id="rec-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mr Daniel Tesfaye"
                className={input}
              />
            </div>
            <div>
              <FieldLabel
                htmlFor="rec-role"
                hint="Colleges want to hear from teachers of core academic subjects you took recently, ideally in junior year."
              >
                Subject or role
              </FieldLabel>
              <input
                id="rec-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="AP Biology teacher"
                className={input}
              />
            </div>
            <div>
              <FieldLabel
                htmlFor="rec-email"
                hint="Common App emails the invitation here, so it must be the address they actually check. A school address is usually safest."
              >
                Email
              </FieldLabel>
              <input
                id="rec-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.edu"
                className={input}
              />
            </div>
            <div>
              <FieldLabel
                hint="Ask in person first, ideally late in junior year. Give recommenders three to four weeks."
              >
                Asked on
              </FieldLabel>
              <DateField value={askedOn} onChange={setAskedOn} ariaLabel="Date asked" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="h-10 rounded-xl px-3 text-[14px] font-medium text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim() || saving}
              className="h-10 rounded-xl bg-[#1099A1] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {recommendations.length === 0 && !adding ? (
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
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#182229]"
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-medium",
                    r.status === "submitted"
                      ? "bg-[#1099A1]/12 text-[#0d757b] dark:text-[#5fc9cf]"
                      : "bg-[#f3f3f5] text-[#717182] dark:bg-[#1c2a32]"
                  )}
                >
                  {r.recommender_name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-[#111] dark:text-white">
                    {r.recommender_name}
                  </div>
                  <div className="flex items-center gap-2 truncate text-[12px] text-[#717182]">
                    {r.relationship || "Recommender"}
                    {r.recommender_email && (
                      <a
                        href={`mailto:${r.recommender_email}`}
                        className="inline-flex items-center gap-1 hover:text-[#1099A1]"
                      >
                        <Mail size={11} />
                        {r.recommender_email}
                      </a>
                    )}
                  </div>
                </div>

                <Dropdown
                  value={r.status}
                  onChange={(v) => onStatusChange(r.id, v as RecStatus)}
                  options={STATUS}
                  size="sm"
                  align="end"
                  className="w-[190px] shrink-0"
                  buttonClassName="font-normal"
                  ariaLabel={`Status for ${r.recommender_name}`}
                />

                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  aria-label={`Remove ${r.recommender_name}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#a8adb8] transition-colors hover:bg-[#f3f3f5] hover:text-[#d4183d] dark:hover:bg-[#1c2a32]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
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
