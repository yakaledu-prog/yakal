import { useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem, Essay, EssayStatus } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { fileIdFromUrl } from "@/services/driveService";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { EssayStatusIcon } from "./EssayStatusIcon";
import { AddEssayModal, NewEssay } from "./AddEssayModal";

const STATUS: { value: EssayStatus; label: string }[] = [
  { value: "todo", label: "Not started" },
  { value: "drafting", label: "Drafting" },
  { value: "in_review", label: "With counselor" },
  { value: "done", label: "Done" },
];


/**
 * A bare date makes the reader do the arithmetic, and they will get it wrong
 * about a deadline, which is the one place it matters.
 */
function dueMeta(iso: string): { label: string; tone: "late" | "soon" | "calm" } {
  const due = new Date(iso);
  due.setHours(23, 59, 59, 999);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);

  if (days < 0) return { label: `${Math.abs(days)} days late`, tone: "late" };
  if (days === 0) return { label: "due today", tone: "late" };
  if (days === 1) return { label: "due tomorrow", tone: "soon" };
  if (days <= 7) return { label: `in ${days} days`, tone: "soon" };
  return { label: `in ${days} days`, tone: "calm" };
}

export type { NewEssay };

/**
 * Essays, grouped by what they are for.
 *
 * The personal statement is written once and reused everywhere, so it is kept
 * apart from supplements, which are per college and die with that application.
 * Conflating them is why students lose track of how many they still owe.
 */
/**
 * Essays, grouped by the college that asked for them.
 *
 * Supplements are per college by definition: a student with nine colleges owes
 * twenty-odd of them, and a flat list of twenty is unreadable. The rail turns
 * that into "MIT wants 3, you have 1", which is the question a student actually
 * has. The personal statement sits apart because it is written once and every
 * college sees it.
 */
export function EssaysPanel({
  essays,
  schools,
  onAdd,
  onStatusChange,
  onCreateDoc,
  onAskReview,
  onDelete,
  onSetSuppCount,
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
  onDelete: (essay: Essay) => void;
  /** Lets a student answer "how many does this college want" without leaving. */
  onSetSuppCount: (schoolId: string, count: number | null) => void;
  creatingDoc: string | null;
  saving: boolean;
  /** Live counts from Drive, keyed by file id. Absent while they load. */
  counts?: Map<string, number>;
}) {
  const [adding, setAdding] = useState(false);

  /** "" is the Common App bucket, otherwise a college id. */
  const [selected, setSelected] = useState<string>("all");
  const [query, setQuery] = useState("");

  const core = essays.filter((e) => e.kind === "personal_statement");
  const supplements = essays.filter((e) => e.kind === "supplement");
  const done = essays.filter((e) => e.status === "done").length;

  const forSchool = (id: string) => supplements.filter((e) => e.college_list_item_id === id);

  /** Supplements a college wants but that do not exist yet. */
  const owedBy = (s: CollegeListItem) =>
    Math.max(0, (s.supp_essay_count ?? 0) - forSchool(s.id).length);

  const totalOwed = schools.reduce((n, s) => n + owedBy(s), 0);

  const inScope =
    selected === "all"
      ? essays
      : selected === "common"
        ? core
        : forSchool(selected);

  // Prompt text is searched too: a student remembers "the one about community"
  // far more often than they remember what they titled it.
  const q = query.trim().toLowerCase();
  const visible = q
    ? inScope.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.prompt ?? "").toLowerCase().includes(q)
      )
    : inScope;

  return (
    <div className="space-y-4">
      <AddEssayModal
        open={adding}
        onClose={() => setAdding(false)}
        onSubmit={(e) => {
          onAdd(e);
          setAdding(false);
        }}
        schools={schools}
        presetSchoolId={
          selected !== "all" && selected !== "common" ? selected : null
        }
        saving={saving}
      />

      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-[280px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a8adb8]"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search essays"
            className="h-9 w-full rounded-lg border border-[#e9edef] bg-white pl-8 pr-3 text-[13px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white"
          />
        </div>

        <p className="hidden shrink-0 text-[13px] text-[#54656f] sm:block dark:text-[#aebac1]">
          {essays.length === 0
            ? totalOwed > 0
              ? `${totalOwed} supplements to add`
              : "Start with your personal statement"
            : `${done} of ${essays.length} finished${totalOwed > 0 ? `, ${totalOwed} to add` : ""}`}
        </p>

        <div className="flex-1" />

        {(
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

      {essays.length === 0 && schools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e9edef] py-12 text-center dark:border-[#2a3942]">
          <p className="text-[14px] text-[#111] dark:text-white">No essays yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#717182]">
            Add one and Yakal creates a Google Doc your counselor can comment on.
          </p>
        </div>
      ) : (
        <div className="flex gap-5">
          <nav className="hidden w-[210px] shrink-0 flex-col gap-0.5 md:flex">
            <RailItem
              label="All essays"
              count={essays.length}
              active={selected === "all"}
              onClick={() => setSelected("all")}
            />
            <RailItem
              label="Common App"
              hint="Every college"
              count={core.length}
              active={selected === "common"}
              onClick={() => setSelected("common")}
            />

            {schools.length > 0 && (
              <p className="mb-1 mt-3 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[#a8adb8]">
                Supplements
              </p>
            )}

            {schools.map((s) => {
              const mine = forSchool(s.id);
              return (
                <RailItem
                  key={s.id}
                  label={s.school_name}
                  // "1/3" is the whole point of the rail: how much is left for
                  // this college, not just how much exists.
                  count={mine.length}
                  total={s.supp_essay_count ?? null}
                  done={mine.filter((e) => e.status === "done").length}
                  active={selected === s.id}
                  isCollege
                  onClick={() => setSelected(s.id)}
                />
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 space-y-2">
            {visible.length === 0 ? (
              <EmptyScope
                query={q ? query.trim() : ""}
                school={
                  selected !== "all" && selected !== "common"
                    ? schools.find((x) => x.id === selected) ?? null
                    : null
                }
                onSetSuppCount={onSetSuppCount}
              />
            ) : (
              visible.map((e) => (
                <EssayRow
                  key={e.id}
                  essay={e}
                  schools={schools}
                  words={counts?.get(fileIdFromUrl(e.drive_url) ?? "")}
                  onStatusChange={onStatusChange}
                  onCreateDoc={onCreateDoc}
                  onAskReview={onAskReview}
                  onDelete={onDelete}
                  creating={creatingDoc === e.id}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RailItem({
  label,
  hint,
  count,
  total,
  done,
  active,
  isCollege = false,
  onClick,
}: {
  label: string;
  hint?: string;
  count: number;
  total?: number | null;
  done?: number;
  active: boolean;
  /** Only a college can owe supplements, so only a college can be unknown. */
  isCollege?: boolean;
  onClick: () => void;
}) {
  // Three states, and they must not collapse into each other. A college that
  // wants none is settled. One whose count we do not know is unfinished
  // business, not zero, and showing it blank hid that entirely.
  const unknown = isCollege && total == null;
  const none = total === 0;
  const owed = total != null ? Math.max(0, total - count) : 0;
  const complete = total != null && total > 0 && done === total;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors",
        active
          ? "bg-[#1099A1]/10 text-[#0d757b] dark:text-[#5fc9cf]"
          : "text-[#54656f] hover:bg-[#f3f3f5] dark:text-[#aebac1] dark:hover:bg-[#1c2a32]"
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{label}</span>
        {hint && <span className="block truncate text-[11px] text-[#a8adb8]">{hint}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 text-[11px] tabular-nums",
          unknown
            ? "text-[#CAA25F]"
            : owed > 0
              ? "text-[#CAA25F]"
              : complete
                ? "text-[#1099A1]"
                : "text-[#a8adb8]"
        )}
        title={
          unknown
            ? "We do not know how many supplements this college wants"
            : undefined
        }
      >
        {!isCollege
          ? count || ""
          : unknown
            ? "?"
            : none
              ? "none"
              : `${count}/${total}`}
      </span>
    </button>
  );
}

/** How far along the status pipeline an essay is, when there is no word count. */
const STATUS_PROGRESS: Record<EssayStatus, number> = {
  todo: 0,
  drafting: 0.35,
  in_review: 0.7,
  done: 1,
};

/**
 * One essay.
 *
 * Progress rides the bottom edge of the card rather than sitting inside it: it
 * is glanceable down a column of ten essays without competing with the title
 * for attention. It tracks words against the college's limit where both are
 * known, since that is the concrete thing, and falls back to the status
 * pipeline otherwise.
 */
function EssayRow({
  essay,
  schools,
  words,
  onStatusChange,
  onCreateDoc,
  onAskReview,
  onDelete,
  creating,
}: {
  essay: Essay;
  schools: CollegeListItem[];
  words?: number;
  onStatusChange: (id: string, s: EssayStatus) => void;
  onCreateDoc: (e: Essay) => void;
  onAskReview: (e: Essay) => void;
  onDelete: (e: Essay) => void;
  creating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const school = schools.find((s) => s.id === essay.college_list_item_id);
  const limit = essay.word_limit ?? null;
  const over = limit !== null && words !== undefined && words > limit;

  const done = essay.status === "done";

  // Progress has to agree with reality. A student can set the dropdown to
  // Drafting before a document exists, and a bar claiming a third done for a
  // file nobody has opened is simply wrong. No doc means no progress, whatever
  // the status says.
  const progress = !essay.drive_url
    ? 0
    : limit !== null && words !== undefined
      ? Math.min(1, words / limit)
      : STATUS_PROGRESS[essay.status];

  const collegeLabel = school
    ? school.school_name
    : essay.kind === "supplement"
      ? "College no longer on your list"
      : "Every college";

  const due = essay.due_date ? dueMeta(essay.due_date) : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#e9edef] bg-white pb-1 dark:border-[#2a3942] dark:bg-[#182229]">
      <div className="flex items-start gap-3 p-3">
        <EssayStatusIcon status={essay.status} className="mt-0.5" />

        {/* Only the title block toggles, so the status dropdown and the doc
            button do not have to fight the expand for the same click. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "truncate text-[14px]",
                done ? "text-[#a8adb8] line-through" : "text-[#111] dark:text-white"
              )}
            >
              {essay.title}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 text-[#a8adb8] transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
          <div className="truncate text-[12px] text-[#717182]">{collegeLabel}</div>

          {/* Words and deadline get their own row instead of a grey run-on
              line. Over the limit and past due are the two facts a student has
              to act on, and they only work if they are legible at a glance down
              a column of ten essays. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {words !== undefined && (
              <span
                className={cn(
                  "text-[12px] tabular-nums",
                  over ? "font-medium text-[#d4183d]" : "text-[#717182]"
                )}
              >
                {/* Only the Common App personal statement has a fixed limit,
                    650, so it is filled in. Supplement limits vary per prompt
                    and per college and are entered by hand, which is why an
                    unknown limit shows a plain count rather than a fraction. */}
                {limit === null ? `${words} words` : `${words}/${limit} words`}
              </span>
            )}

            {due && (
              <span
                className={cn(
                  "text-[12px] tabular-nums",
                  done
                    ? "text-[#a8adb8]"
                    : due.tone === "late"
                      ? "font-medium text-[#d4183d]"
                      : due.tone === "soon"
                        ? "font-medium text-[#CAA25F]"
                        : "text-[#717182]"
                )}
              >
                {/* Once it is finished the deadline is history, not a threat. */}
                {done ? "submitted" : due.label}
              </span>
            )}

            {(essay.rounds_used ?? 0) > 0 && (
              <span className="text-[12px] text-[#717182]">round {essay.rounds_used}</span>
            )}
          </div>
        </button>

        {/* Status first, then what you would do about it. */}
        <div className="flex w-[150px] shrink-0 flex-col gap-1.5">
          <Dropdown
            value={essay.status}
            onChange={(v) => onStatusChange(essay.id, v as EssayStatus)}
            options={STATUS}
            size="sm"
            align="end"
            buttonClassName={cn(
              "font-normal",
              // Finished should read as finished wherever it appears, not only
              // on the title.
              done && "border-[#1099A1]/40 font-medium text-[#1099A1]"
            )}
            ariaLabel={`Status for ${essay.title}`}
          />

          {essay.drive_url ? (
            <a
              href={essay.drive_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#e9edef] text-[12px] font-medium text-[#54656f] transition-colors hover:border-[#1099A1] hover:text-[#1099A1] dark:border-[#2a3942] dark:text-[#aebac1]"
            >
              Open doc
              <ExternalLink size={11} />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onCreateDoc(essay)}
              disabled={creating}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#e9edef] text-[12px] font-medium text-[#54656f] transition-colors hover:border-[#1099A1] hover:text-[#1099A1] disabled:opacity-50 dark:border-[#2a3942] dark:text-[#aebac1]"
            >
              {creating && <Loader2 size={11} className="animate-spin" />}
              Create doc
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[#e9edef] px-3 py-3 dark:border-[#2a3942]">
          {essay.prompt ? (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#a8adb8]">
                Prompt
              </p>
              <p className="text-[13px] leading-relaxed text-[#54656f] dark:text-[#aebac1]">
                {essay.prompt}
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-[#a8adb8]">
              No prompt saved. Paste the college's question so it sits beside the
              draft.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#717182]">
            {limit !== null && <span>Limit {limit} words</span>}
            {essay.last_feedback_at && (
              <span>
                Last feedback {new Date(essay.last_feedback_at).toLocaleDateString()}
              </span>
            )}
            {essay.updated_at && (
              <span>Updated {new Date(essay.updated_at).toLocaleDateString()}</span>
            )}
          </div>

          {/* The handoff the tiers are sold on. Pointless before a doc exists,
              redundant once it is already with the counselor. */}
          {essay.drive_url && essay.status !== "in_review" && (
            <button
              type="button"
              onClick={() => onAskReview(essay)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1099A1] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d848b]"
            >
              <MessageSquare size={13} />
              Ask for review
            </button>
          )}

          {essay.status === "in_review" && (
            <p className="text-[12px] text-[#CAA25F]">
              With your counselor. You will get a note when they have read it.
            </p>
          )}

          <div className="flex justify-end border-t border-[#e9edef] pt-3 dark:border-[#2a3942]">
            <button
              type="button"
              onClick={() => onDelete(essay)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[#d4183d] transition-colors hover:bg-[#d4183d]/10"
            >
              <Trash2 size={13} />
              Delete essay
            </button>
          </div>
        </div>
      )}

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px] bg-[#f3f3f5] dark:bg-[#1c2a32]"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            over && !done ? "bg-[#d4183d]" : done ? "bg-[#1099A1]" : "bg-[#1099A1]/60"
          )}
          style={{ width: `${Math.round((over ? 1 : progress) * 100)}%` }}
        />
      </div>
    </div>
  );
}


/**
 * What an empty panel should say depends on why it is empty, and the three
 * reasons need three different answers. "Nothing added here yet" was true in
 * all of them and useful in none.
 */
function EmptyScope({
  query,
  school,
  onSetSuppCount,
}: {
  query: string;
  school: CollegeListItem | null;
  onSetSuppCount: (schoolId: string, count: number | null) => void;
}) {
  const [count, setCount] = useState<number | null>(null);

  if (query) {
    return (
      <div className="rounded-xl border border-dashed border-[#e9edef] py-10 text-center dark:border-[#2a3942]">
        <p className="text-[13px] text-[#717182]">No essay matches "{query}".</p>
      </div>
    );
  }

  if (school && school.supp_essay_count == null) {
    return (
      <div className="rounded-xl border border-dashed border-[#e9edef] p-6 text-center dark:border-[#2a3942]">
        <p className="text-[14px] text-[#111] dark:text-white">
          How many supplements does {school.school_name} ask for?
        </p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#717182]">
          It is not in the federal data, so nobody knows until you check the
          college's application. Zero is a real answer, and plenty of colleges
          ask for none.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <NumberStepper
            value={count}
            onChange={setCount}
            max={20}
            ariaLabel={`Supplements required by ${school.school_name}`}
          />
          <button
            type="button"
            onClick={() => onSetSuppCount(school.id, count ?? 0)}
            className="h-11 rounded-xl bg-[#1099A1] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b]"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  if (school && school.supp_essay_count === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e9edef] py-10 text-center dark:border-[#2a3942]">
        <p className="text-[13px] text-[#717182]">
          {school.school_name} asks for no supplemental essays. Your personal
          statement is all it sees.
        </p>
        <button
          type="button"
          onClick={() => onSetSuppCount(school.id, null)}
          className="mt-2 text-[12px] font-medium text-[#1099A1] hover:underline"
        >
          That is not right
        </button>
      </div>
    );
  }

  if (school) {
    return (
      <div className="rounded-xl border border-dashed border-[#e9edef] py-10 text-center dark:border-[#2a3942]">
        <p className="text-[14px] text-[#111] dark:text-white">
          {school.school_name} asks for {school.supp_essay_count}{" "}
          {school.supp_essay_count === 1 ? "supplement" : "supplements"}.
        </p>
        <p className="mt-1 text-[13px] text-[#717182]">
          None added yet. Add one and Yakal creates a Doc your counselor can
          comment on.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-[#e9edef] py-10 text-center dark:border-[#2a3942]">
      <p className="text-[13px] text-[#717182]">Nothing added here yet.</p>
    </div>
  );
}
