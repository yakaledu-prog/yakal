import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ExternalLink, FileText, Loader2, MoreVertical, Plus, Search, Trash2, UserPen } from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem, Essay, EssayStatus } from "@/services/collegeService";
import { fileIdFromUrl } from "@/services/driveService";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { ApplicationLogo, CollegeLogo } from "./CollegeLogo";
import { ReviewStamp } from "./ReviewStamp";
import { College, loadCatalog } from "@/services/collegeCatalogService";
import { CURRENT_CYCLE, getUniversalPrompts } from "@/services/collegeCycleService";
import { AddEssayModal, NewEssay } from "./AddEssayModal";
import { EssayPromptPicker, type PromptSelection } from "./EssayPromptPicker";




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

/**
 * The other axis from the rail: how far along an essay is, not who it is for.
 *
 * Three, not five. Not started and Drafting are the same answer to the only
 * question this filter exists to settle, which is whose turn it is: both of
 * them are the student's. Splitting them made a five-item list where four of
 * the items were rarely what anybody wanted.
 *
 * Each one wears the colour its cards wear, so the filter and the list agree
 * without a legend.
 */
type StateFilter = "all" | "mine" | "in_review" | "done";

const STATE_FILTERS: { value: StateFilter; label: string; tone: string }[] = [
  { value: "all", label: "All", tone: "border-border/60 text-muted-foreground" },
  { value: "mine", label: "With me", tone: "border-border/60 text-foreground" },
  { value: "in_review", label: "Under review", tone: "border-secondary/50 text-secondary" },
  { value: "done", label: "Finished", tone: "border-primary/40 text-primary" },
];

const MATCHES_STATE: Record<StateFilter, (e: Essay) => boolean> = {
  all: () => true,
  mine: (e) => e.status === "todo" || e.status === "drafting",
  in_review: (e) => e.status === "in_review",
  done: (e) => e.status === "done",
};

export type { NewEssay };
export type { PromptSelection };

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
  role = "student",
  onAdd,
  onAddFromPrompts,
  onEnsureSchool,
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
  /** Which dashboard this is inside, so an essay opens on the right route. */
  role?: "student" | "counselor";
  onAdd: (e: NewEssay) => void;
  /** Several essays at once, each from a curated prompt. Given, adding starts
   *  at the college rather than at a blank form. */
  onAddFromPrompts?: (selection: PromptSelection) => void;
  /**
   * A college whose questions we do not hold, for the blank form to be scoped
   * to. Returns the college list row's id, creating it if the student has not
   * added that college yet: without this the blank form opens with a college
   * dropdown that does not contain the college they just picked.
   */
  onEnsureSchool?: (
    preset: { unitid: number | null; schoolName: string | null; collegeListItemId: string | null }
  ) => Promise<string | null>;
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
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState(false);
  /** A college carried over from the picker's "write it myself", so the blank
   *  form does not ask again for the school just chosen. */
  const [ownFor, setOwnFor] = useState<string | null>(null);

  // Crests, and which shared application a personal statement belongs to. Both
  // are cached queries shared with the picker, so opening this costs nothing
  // extra once either has been opened.
  const { data: catalog = [] } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const { data: universal = [] } = useQuery({
    queryKey: ["essay-prompts-universal", CURRENT_CYCLE],
    queryFn: () => getUniversalPrompts(),
  });

  const appOf = (essay: Essay) =>
    universal.find((p) => p.id === essay.essay_prompt_id)?.app_key ?? null;

  const collegeOf = (essay: Essay): College | null => {
    const unitid = schools.find((s) => s.id === essay.college_list_item_id)?.unitid;
    return unitid ? catalog.find((c) => c.unitid === unitid) ?? null : null;
  };

  /** Where an essay opens. The route differs per role but the page does not. */
  const openEssay = (essay: Essay) =>
    navigate(`/${role === "counselor" ? "counselor" : "student"}/essay/${essay.id}`);

  /** "" is the Common App bucket, otherwise a college id. */
  const [selected, setSelected] = useState<string>("all");
  const [state, setState] = useState<StateFilter>("all");
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
  const matching = q
    ? inScope.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.prompt ?? "").toLowerCase().includes(q)
      )
    : inScope;
  const visible = matching.filter(MATCHES_STATE[state]);
  const filtered = !!q || state !== "all" || selected !== "all";

  return (
    <div className="space-y-4">
      <AddEssayModal
        open={adding}
        onClose={() => {
          setAdding(false);
          setOwnFor(null);
        }}
        onSubmit={(e) => {
          onAdd(e);
          setAdding(false);
          setOwnFor(null);
        }}
        schools={schools}
        presetSchoolId={
          ownFor ?? (selected !== "all" && selected !== "common" ? selected : null)
        }
        saving={saving}
      />

      {onAddFromPrompts && (
        <EssayPromptPicker
          open={picking}
          onClose={() => setPicking(false)}
          onSubmit={(selection) => {
            onAddFromPrompts(selection);
            setPicking(false);
          }}
          onWriteYourOwn={(preset) => {
            setPicking(false);
            if (!preset.unitid || preset.collegeListItemId || !onEnsureSchool) {
              setOwnFor(preset.collegeListItemId);
              setAdding(true);
              return;
            }
            void onEnsureSchool(preset).then((id) => {
              setOwnFor(id);
              setAdding(true);
            });
          }}
          schools={schools}
          saving={saving}
        />
      )}

      <div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a title or a prompt"
              className="h-9 w-full rounded-md border border-border/60 bg-card pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          {/* Starting from the college's actual question rather than a blank
              title field. The old form asked for a title, a college and the
              prompt pasted in from another tab, and the paste is the part that
              went wrong. Where no prompt picker is wired in, this falls back to
              that form, which is what the preview page uses. */}
          <button
            type="button"
            onClick={() => (onAddFromPrompts ? setPicking(true) : setAdding(true))}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <Plus size={15} />
            Add essay
          </button>
        </div>

        {/* Where a college is chosen from the rail, these are the other axis:
            whose turn it is. The two compose, so "Pomona" plus "Under review"
            is a question a student actually has. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {STATE_FILTERS.map((f) => {
            const n = matching.filter(MATCHES_STATE[f.value]).length;
            const on = state === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setState(f.value)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  f.tone,
                  on ? "bg-current/10 font-medium" : "bg-transparent hover:bg-muted/60"
                )}
              >
                {f.label}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}

          {/* Pushed to the far end of the filter row. It is a fact about the
              list rather than a control, so it sits with them without being
              one of them, and it describes the list actually on screen: a
              tally that ignored the filters was answering a question nobody
              had asked. */}
          <p className="ml-auto shrink-0 text-xs text-muted-foreground">
            {essays.length === 0
              ? totalOwed > 0
                ? `${totalOwed} to add`
                : "Start with your personal statement"
              : filtered
                ? `${visible.length} of ${essays.length}`
                : `${done} of ${essays.length} finished`}
          </p>
        </div>
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
                  college={collegeOf(e)}
                  appKey={appOf(e)}
                  words={counts?.get(fileIdFromUrl(e.drive_url) ?? "")}
                  onOpen={() => openEssay(e)}
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
          ? "bg-primary/10 text-[#0d757b] dark:text-[#5fc9cf]"
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
            ? "text-secondary"
            : owed > 0
              ? "text-secondary"
              : complete
                ? "text-primary"
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
 * One essay, as a way in rather than a thing to operate.
 *
 * This used to expand, and carry a status dropdown beside a Create doc button.
 * The dropdown was the problem: it offered four states at all times, so a
 * student could mark an essay finished before a document existed and the
 * progress bar had to be taught to disbelieve it. What is left is what this
 * essay can actually do next, and everything else, the prompt, the draft, the
 * counselor's comments, now lives on the essay's own page.
 *
 * The icon is the college's crest. A status glyph told you something the row
 * already says in words; a crest tells you at a glance which of eleven
 * supplements you are looking at.
 */
function EssayRow({
  essay,
  schools,
  college,
  appKey,
  words,
  onOpen,
  onCreateDoc,
  onAskReview,
  onDelete,
  creating,
}: {
  essay: Essay;
  schools: CollegeListItem[];
  /** The catalog row for this essay's college, when it has one. */
  college: College | null;
  /** Which shared application a personal statement belongs to. */
  appKey: string | null;
  words?: number;
  onOpen: () => void;
  onCreateDoc: (e: Essay) => void;
  onAskReview: (e: Essay) => void;
  onDelete: (e: Essay) => void;
  creating: boolean;
}) {
  const school = schools.find((s) => s.id === essay.college_list_item_id);
  const limit = essay.word_limit ?? null;
  const over = limit !== null && words !== undefined && words > limit;
  const done = essay.status === "done";
  const underReview = !!essay.drive_url && essay.status === "in_review";

  // Progress has to agree with reality. No doc means no progress, whatever the
  // status says.
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
    <div
      className={cn(
        // No overflow-hidden here. It was clipping the row menu, which opens
        // below the card; the progress bar clips itself instead.
        "group relative rounded-md bg-card transition-colors",
        // The edge is what you read first down a column of ten essays, so it
        // carries the state: teal for finished, gold for waiting on somebody
        // else, and nothing at all for the ones still in the student's hands.
        done
          ? "border border-primary/40 bg-primary/5 hover:border-primary/60"
          : underReview
            ? "border border-secondary/50 bg-secondary/5 hover:border-secondary/70"
            : "border border-border/60 hover:border-primary/40"
      )}
    >
      <div className="flex items-center gap-3 p-3 pr-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {school?.unitid || college ? (
            <CollegeLogo
              name={collegeLabel}
              logo={college?.logo ?? null}
              website={college?.website ?? null}
              size={38}
            />
          ) : (
            <ApplicationLogo
              appKey={appKey ?? "common_app"}
              name={collegeLabel}
              size={38}
            />
          )}

          <span className="min-w-0 flex-1">
            {/* Finished is colour, not a rule through the words. A title with
                a line through it reads as cancelled, which is the opposite of
                what finishing an essay means. */}
            <span
              className={cn(
                "block truncate text-sm font-medium",
                done ? "text-primary" : "text-foreground"
              )}
            >
              {essay.title}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              <span className="truncate">{collegeLabel}</span>

              {words !== undefined && (
                <span className={cn("tabular-nums", over && "font-medium text-secondary")}>
                  {limit === null ? `${words} words` : `${words}/${limit} words`}
                </span>
              )}

              {due && (
                <span
                  className={cn(
                    "tabular-nums",
                    done
                      ? ""
                      : due.tone === "late"
                        ? "font-medium text-secondary"
                        : due.tone === "soon"
                          ? "font-medium text-secondary"
                          : ""
                  )}
                >
                  {done ? "submitted" : due.label}
                </span>
              )}

              {(essay.rounds_used ?? 0) > 0 && <span>round {essay.rounds_used}</span>}
            </span>
          </span>
        </button>

        {/* Only what this essay can do next. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Not once it is finished. An essay marked done with no document
              behind it is odd data, and offering to start writing it under a
              Finished stamp is odder still. */}
          {!essay.drive_url && !done && (
            <button
              type="button"
              onClick={() => onCreateDoc(essay)}
              disabled={creating}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {creating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FileText size={13} />
              )}
              Create doc
            </button>
          )}

          {essay.drive_url && essay.status !== "in_review" && !done && (
            <button
              type="button"
              onClick={() => onAskReview(essay)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <UserPen size={13} />
              Ask for review
            </button>
          )}

          {/* Only once there is something to review. A draft can be marked
              in_review with no document behind it, and saying both "Create doc"
              and this on one row is a contradiction the student has to
              resolve. */}
          {underReview && <ReviewStamp className="mr-1" />}

          {/* One menu rather than a row of icons. A column of ten essays
              should not be a column of ten delete buttons, and the chevron
              that used to sit here only repeated what the whole card does. */}
          <RowMenu essay={essay} onDelete={onDelete} />
        </div>
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-b-[5px] bg-muted"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            over && !done ? "bg-secondary" : done ? "bg-primary" : "bg-primary/60"
          )}
          style={{ width: `${Math.round((over ? 1 : progress) * 100)}%` }}
        />
      </div>
    </div>
  );
}


/**
 * The per-essay actions that are not what this essay does next.
 *
 * Opening the Doc and deleting the essay are always available and almost never
 * what you came to the row for, so they sit behind a menu while the one action
 * that matters now keeps its place on the row.
 */
function RowMenu({
  essay,
  onDelete,
}: {
  essay: Essay;
  onDelete: (e: Essay) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const item =
    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] transition-colors hover:bg-muted/70";

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`More for ${essay.title}`}
        aria-expanded={open}
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-md border border-border/60 bg-card p-1 shadow-lg">
          {essay.drive_url && (
            <a
              href={essay.drive_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className={cn(item, "text-foreground")}
            >
              <ExternalLink size={14} />
              Open in Google Docs
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete(essay);
            }}
            className={cn(item, "text-destructive")}
          >
            <Trash2 size={14} />
            Delete essay
          </button>
        </div>
      )}
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
            className="h-11 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover"
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
          className="mt-2 text-[12px] font-medium text-primary hover:underline"
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
