import { useState } from "react";
import { ExternalLink, FileText, Loader2, MessageSquare, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem, Essay, EssayStatus } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { fileIdFromUrl } from "@/services/driveService";
import { FieldLabel } from "@/components/ui/InfoHint";
import { NumberStepper } from "@/components/ui/NumberStepper";

const STATUS: { value: EssayStatus; label: string }[] = [
  { value: "todo", label: "Not started" },
  { value: "drafting", label: "Drafting" },
  { value: "in_review", label: "With counselor" },
  { value: "done", label: "Done" },
];

const input =
  "h-11 w-full rounded-xl border border-[#e9edef] bg-white px-3 text-[14px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white";

/**
 * A bare date makes the reader do the arithmetic, and they will get it wrong
 * about a deadline, which is the one place it matters.
 */
function dueLabel(iso: string): string {
  const due = new Date(iso);
  due.setHours(23, 59, 59, 999);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  const on = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  if (days < 0) return `${on} · ${Math.abs(days)} days overdue`;
  if (days === 0) return `${on} · due today`;
  if (days === 1) return `${on} · due tomorrow`;
  return `${on} · ${days} days left`;
}

export interface NewEssay {
  title: string;
  kind: "personal_statement" | "supplement";
  college_list_item_id: string | null;
  prompt: string | null;
  word_limit: number | null;
}

/**
 * Essays, grouped by what they are for.
 *
 * The personal statement is written once and reused everywhere, so it is kept
 * apart from supplements, which are per college and die with that application.
 * Conflating them is why students lose track of how many they still owe.
 */
export function EssaysPanel({
  essays,
  schools,
  onAdd,
  onStatusChange,
  onCreateDoc,
  onAskReview,
  creatingDoc,
  saving,
  counts,
}: {
  essays: Essay[];
  schools: CollegeListItem[];
  onAdd: (e: NewEssay) => void;
  onStatusChange: (id: string, status: EssayStatus) => void;
  onCreateDoc: (essay: Essay) => void;
  onAskReview: (essay: Essay) => void;
  creatingDoc: string | null;
  saving: boolean;
  /** Live counts from Drive, keyed by file id. Absent while they load. */
  counts?: Map<string, number>;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [limit, setLimit] = useState<number | null>(null);

  const core = essays.filter((e) => e.kind === "personal_statement");
  const supplements = essays.filter((e) => e.kind === "supplement");
  const done = essays.filter((e) => e.status === "done").length;

  // How many supplements are still owed across the whole list, which is the
  // number that actually predicts how much work is left.
  const owed = schools.reduce((n, s) => n + (s.supp_essay_count ?? 0), 0);

  const reset = () => {
    setTitle("");
    setSchoolId("");
    setPrompt("");
    setLimit(null);
    setAdding(false);
  };

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      kind: schoolId ? "supplement" : "personal_statement",
      college_list_item_id: schoolId || null,
      prompt: prompt.trim() || null,
      // The Common App personal statement limit is fixed at 650, so it is
      // filled in rather than asked for.
      word_limit: limit ?? (schoolId ? null : 650),
    });
    reset();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
          {essays.length === 0
            ? owed > 0
              ? `Your list needs about ${owed} supplemental essays plus a personal statement.`
              : "Start with your Common App personal statement."
            : `${done} of ${essays.length} finished`}
        </p>
        <div className="flex-1" />
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1099A1] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d848b]"
          >
            <Plus size={15} />
            Add essay
          </button>
        )}
      </div>

      {adding && (
        <div className="space-y-4 rounded-xl border border-[#e9edef] p-4 dark:border-[#2a3942]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="essay-title">Title</FieldLabel>
              <input
                id="essay-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Why Hopkins? supplement'
                className={input}
              />
            </div>
            <div>
              <FieldLabel hint="Leave as Common App if this is your main personal statement, which every college sees.">
                For which college
              </FieldLabel>
              <Dropdown
                value={schoolId}
                onChange={setSchoolId}
                options={[
                  { value: "", label: "Common App (all colleges)" },
                  ...schools.map((s) => ({ value: s.id, label: s.school_name })),
                ]}
                buttonClassName="h-11 rounded-xl text-[14px] font-normal"
                ariaLabel="College this essay is for"
              />
            </div>
          </div>
          <div>
            <FieldLabel
              htmlFor="essay-prompt"
              hint="Paste the college's exact question. Keeping it beside the draft means you never have to go looking for what you were asked."
            >
              Prompt
            </FieldLabel>
            <textarea
              id="essay-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste the question from the college's application"
              className={cn(input, "h-auto resize-none py-2.5 leading-relaxed")}
            />
          </div>

          <div>
            <FieldLabel hint="Colleges enforce these. Leave blank if the prompt does not state one.">
              Word limit
            </FieldLabel>
            <NumberStepper
              value={limit}
              onChange={setLimit}
              max={2000}
              placeholder={schoolId ? "-" : "650"}
              ariaLabel="Word limit"
            />
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
              disabled={!title.trim() || saving}
              className="h-10 rounded-xl bg-[#1099A1] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {essays.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-[#e9edef] py-12 text-center dark:border-[#2a3942]">
          <p className="text-[14px] text-[#111] dark:text-white">No essays yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#717182]">
            Add one and Yakal creates a Google Doc your counselor can comment on.
          </p>
        </div>
      ) : (
        <>
          <Group
            title="Personal statement"
            essays={core}
            schools={schools}
            onStatusChange={onStatusChange}
            onCreateDoc={onCreateDoc}
            onAskReview={onAskReview}
            creatingDoc={creatingDoc}
            counts={counts}
          />
          <Group
            title="Supplements"
            essays={supplements}
            schools={schools}
            onStatusChange={onStatusChange}
            onCreateDoc={onCreateDoc}
            onAskReview={onAskReview}
            creatingDoc={creatingDoc}
            counts={counts}
          />
        </>
      )}
    </div>
  );
}

function Group({
  title,
  essays,
  schools,
  onStatusChange,
  onCreateDoc,
  onAskReview,
  creatingDoc,
  counts,
}: {
  title: string;
  essays: Essay[];
  schools: CollegeListItem[];
  onStatusChange: (id: string, s: EssayStatus) => void;
  onCreateDoc: (e: Essay) => void;
  onAskReview: (e: Essay) => void;
  creatingDoc: string | null;
  counts?: Map<string, number>;
}) {
  if (essays.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
        {title}
        <span className="tabular-nums text-[#a8adb8]">{essays.length}</span>
      </h3>
      <div className="space-y-2">
        {essays.map((e) => (
          <EssayRow
            key={e.id}
            essay={e}
            schools={schools}
            words={counts?.get(fileIdFromUrl(e.drive_url) ?? "")}
            onStatusChange={onStatusChange}
            onCreateDoc={onCreateDoc}
            onAskReview={onAskReview}
            creating={creatingDoc === e.id}
          />
        ))}
      </div>
    </section>
  );
}


/**
 * One essay.
 *
 * The word count is the point of this row. A college enforces its limit, so
 * "631 of 650" tells a student whether they are nearly done, and "102 over"
 * tells them they have cutting to do, which no status label ever conveys.
 */
function EssayRow({
  essay,
  schools,
  words,
  onStatusChange,
  onCreateDoc,
  onAskReview,
  creating,
}: {
  essay: Essay;
  schools: CollegeListItem[];
  words?: number;
  onStatusChange: (id: string, s: EssayStatus) => void;
  onCreateDoc: (e: Essay) => void;
  onAskReview: (e: Essay) => void;
  creating: boolean;
}) {
  const school = schools.find((s) => s.id === essay.college_list_item_id);
  const limit = essay.word_limit ?? null;
  const over = limit !== null && words !== undefined && words > limit;
  const pct = limit && words !== undefined ? Math.min(1, words / limit) : 0;

  return (
    <div className="rounded-xl border border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#182229]">
      <div className="flex items-center gap-3">
        <FileText size={17} className="shrink-0 text-[#717182]" />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] text-[#111] dark:text-white">
            {essay.title}
          </div>
          <div className="truncate text-[12px] text-[#717182]">
            {/* A supplement is college-specific by definition, so a failed
                lookup means its college left the list, not that it applies
                everywhere. Saying "every college" there is simply false. */}
            {school
              ? school.school_name
              : essay.kind === "supplement"
                ? "College no longer on your list"
                : "Every college"}
            {essay.due_date && ` \u00b7 ${dueLabel(essay.due_date)}`}
            {(essay.rounds_used ?? 0) > 0 &&
              ` \u00b7 round ${essay.rounds_used}`}
          </div>
        </div>

        {/* Only meaningful once a doc exists and a limit is known. */}
        {words !== undefined && (
          <div className="hidden w-[120px] shrink-0 sm:block">
            <div className="h-1 w-full overflow-hidden rounded-full bg-[#f3f3f5] dark:bg-[#1c2a32]">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  over ? "bg-[#d4183d]" : "bg-[#1099A1]"
                )}
                style={{ width: `${Math.round((over ? 1 : pct) * 100)}%` }}
              />
            </div>
            <div
              className={cn(
                "mt-0.5 text-[11px] tabular-nums",
                over ? "text-[#d4183d]" : "text-[#717182]"
              )}
            >
              {limit === null
                ? `${words} words`
                : over
                  ? `${words - limit} over`
                  : `${words}/${limit}`}
            </div>
          </div>
        )}

        {essay.drive_url ? (
          <a
            href={essay.drive_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#1099A1] hover:underline"
          >
            Open doc
            <ExternalLink size={12} />
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onCreateDoc(essay)}
            disabled={creating}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e9edef] px-2.5 py-1.5 text-[12px] font-medium text-[#54656f] transition-colors hover:border-[#1099A1] hover:text-[#1099A1] disabled:opacity-50 dark:border-[#2a3942] dark:text-[#aebac1]"
          >
            {creating && <Loader2 size={12} className="animate-spin" />}
            Create doc
          </button>
        )}

        {/* The handoff the tiers are actually sold on. Pointless before a doc
            exists, and redundant once it is already with the counselor. */}
        {essay.drive_url && essay.status !== "in_review" && (
          <button
            type="button"
            onClick={() => onAskReview(essay)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e9edef] px-2.5 py-1.5 text-[12px] font-medium text-[#54656f] transition-colors hover:border-[#1099A1] hover:text-[#1099A1] dark:border-[#2a3942] dark:text-[#aebac1]"
          >
            <MessageSquare size={12} />
            Ask for review
          </button>
        )}

        <Dropdown
          value={essay.status}
          onChange={(v) => onStatusChange(essay.id, v as EssayStatus)}
          options={STATUS}
          size="sm"
          align="end"
          className="w-[150px] shrink-0"
          buttonClassName="font-normal"
          ariaLabel={`Status for ${essay.title}`}
        />
      </div>

      {/* The college's actual question, kept with the essay so a student never
          has to go looking for what they were asked. */}
      {essay.prompt && (
        <p className="mt-2 border-l-2 border-[#e9edef] pl-2.5 text-[12px] leading-relaxed text-[#717182] dark:border-[#2a3942]">
          {essay.prompt}
        </p>
      )}
    </div>
  );
}
