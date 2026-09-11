import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ArrowUpDown,
  Check,
  ExternalLink,
  MoreVertical,
  UserRound,
  Loader2,
  RotateCcw,
  Search,
  Undo2,
} from "lucide-react";

import { Dropdown } from "@/components/ui/Dropdown";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { getCounselorStudents } from "@/services/counselorService";
import { College, loadCatalog } from "@/services/collegeCatalogService";
import { AvatarStack } from "@/components/college/AvatarStack";
import {
  getReviewQueue,
  reviewEssay,
  type ReviewAction,
  type ReviewQueueItem,
} from "@/services/essayReviewService";
import {
  getAdmissionsPlans,
  quotaLabel,
  quotaSpent,
  type AdmissionsPlan,
} from "@/services/admissionsService";

// ============================================================
// Everything waiting on a counselor, across every student.
//
// The essay itself lives in Google Docs and is read and commented on there, so
// this is deliberately not an editor. It is a queue and two verbs: send it back
// or call it finished. Opening the document is the third thing, and it is the
// one that leads.
//
// Each row shows how many rounds that student's tier includes and how many
// have gone. It never stops anyone: a family at 6 of 6 is a conversation
// between people, not a disabled button, and a limit that blocks turns the
// counter into something worth gaming.
// ============================================================

/**
 * Whose turn it is, in the counsellor's words rather than the student's.
 *
 * Each wears the colour its rows wear, the same gold and teal the student side
 * uses, so the filter and the list agree without a legend. Waiting on me leads
 * because it is the only one that is a job.
 */
const FILTERS = [
  { id: "all", label: "All", tone: "border-border/60 text-muted-foreground" },
  { id: "waiting", label: "Waiting on me", tone: "border-secondary/50 text-secondary" },
  { id: "drafting", label: "With the student", tone: "border-border/60 text-foreground" },
  { id: "done", label: "Finished", tone: "border-primary/40 text-primary" },
] as const;

/**
 * One student in the rail, or the row that means all of them.
 *
 * The count on the right is how many are waiting on the counsellor, not how
 * many exist: a caseload row that says 9 when none of them need anything is a
 * number nobody can act on. The total is only shown when nothing is waiting.
 */
function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-3 px-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </p>
  );
}

function RailItem({
  label,
  avatarUrl,
  count,
  waiting = 0,
  active,
  onClick,
}: {
  label: string;
  avatarUrl?: string | null;
  count: number;
  waiting?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
      )}
    >
      {avatarUrl !== undefined && (
        <img
          src={avatarUrl || dicebearUrl(label)}
          alt=""
          className="h-6 w-6 shrink-0 rounded-full object-cover"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{label}</span>
      <span
        className={cn(
          "shrink-0 text-[11px] tabular-nums",
          waiting > 0 ? "font-medium text-secondary" : "text-muted-foreground"
        )}
      >
        {waiting > 0 ? waiting : count || ""}
      </span>
    </button>
  );
}

/** How a counsellor reads a queue that mixes every student together. */
type SortKey = "deadline" | "student" | "updated" | "college";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "deadline", label: "Deadline" },
  { value: "student", label: "Student" },
  { value: "updated", label: "Recently updated" },
  { value: "college", label: "College" },
];

type FilterId = (typeof FILTERS)[number]["id"];

const MATCHES: Record<FilterId, (e: ReviewQueueItem) => boolean> = {
  waiting: (e) => e.status === "in_review",
  drafting: (e) => e.status === "drafting" || e.status === "todo",
  done: (e) => e.status === "done",
  all: () => true,
};

function dueLabel(iso: string | null): { text: string; urgent: boolean } | null {
  if (!iso) return null;
  const due = new Date(`${iso}T00:00:00`);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - midnight.getTime()) / 86_400_000);

  if (days < 0) return { text: "Overdue", urgent: true };
  if (days === 0) return { text: "Due today", urgent: true };
  if (days === 1) return { text: "Due tomorrow", urgent: true };
  if (days <= 14) return { text: `Due in ${days} days`, urgent: false };
  return {
    text: `Due ${due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
    urgent: false,
  };
}

export function CounselorEssays() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("waiting");
  const [busyId, setBusyId] = useState<string | null>(null);
  // What the counsellor is about to say, and about which essay. Sending an
  // essay back used to write no note at all: the column existed, reviewEssay
  // accepted one, and the queue never asked. The student got "your essay came
  // back" and nothing about why, which for a service sold on expert feedback is
  // the whole of the thing missing.
  const [reviewing, setReviewing] = useState<{ essay: ReviewQueueItem; action: ReviewAction } | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("deadline");
  /** "all", or one student's id. The counsellor's equivalent of the student's
   *  college rail: the first question about an essay here is whose it is. */
  const [who, setWho] = useState<string>("all");
  /** "all", "personal" for the essays that belong to no college, or a unitid.
   *  Composes with the student above, so "Amen" plus "MIT" is a question a
   *  counsellor sitting down with one student actually has. */
  const [where, setWhere] = useState<string>("all");

  const { data: students = [] } = useQuery({
    queryKey: ["counselor-students", user?.id],
    queryFn: () => getCounselorStudents(user!.id),
    enabled: !!user?.id,
  });

  const studentIds = students.map((s) => s.id);

  const { data: essays = [], isLoading } = useQuery({
    queryKey: ["review-queue", studentIds.join(",")],
    queryFn: () => getReviewQueue(studentIds),
    enabled: studentIds.length > 0,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const { data: plans } = useQuery({
    queryKey: ["admissions-plans", studentIds.join(",")],
    queryFn: () => getAdmissionsPlans(studentIds),
    enabled: studentIds.length > 0,
  });

  /**
   * The colleges this counsellor has essays for, most work first.
   *
   * Derived from the students in scope rather than from the catalog, so
   * choosing a student narrows the colleges to that student's rather than
   * leaving rows behind that would show nothing.
   */
  const colleges = useMemo(() => {
    const pool = essays.filter((e) => who === "all" || e.studentId === who);
    const by = new Map<string, { key: string; label: string; count: number }>();
    for (const e of pool) {
      const key = e.collegeUnitid ? String(e.collegeUnitid) : e.kind === "personal_statement" ? "personal" : "";
      if (!key) continue;
      const label = key === "personal" ? "Personal statement" : e.collegeName ?? "College";
      const row = by.get(key) ?? { key, label, count: 0 };
      row.count += 1;
      by.set(key, row);
    }
    return [...by.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    );
  }, [essays, who]);

  /** For the banner: the whole caseload, whatever is filtered on screen. */
  const counts = useMemo(() => {
    const out = {} as Record<FilterId, number>;
    for (const f of FILTERS) out[f.id] = essays.filter(MATCHES[f.id]).length;
    return out;
  }, [essays]);

  /** Everything this student filter and this search allow, before the status
   *  tags narrow it. The tag counts are taken from here so they say how many
   *  the tag would show, not how many exist somewhere else. */
  const inScope = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return essays
      .filter((e) => who === "all" || e.studentId === who)
      .filter((e) =>
        where === "all"
          ? true
          : where === "personal"
            ? !e.collegeUnitid && e.kind === "personal_statement"
            : String(e.collegeUnitid) === where
      )
      .filter((e) =>
        !needle
          ? true
          : e.title.toLowerCase().includes(needle) ||
            e.studentName.toLowerCase().includes(needle) ||
            (e.collegeName ?? "").toLowerCase().includes(needle) ||
            (e.prompt ?? "").toLowerCase().includes(needle)
      );
  }, [essays, who, where, query]);

  const visible = useMemo(() => {
    return [...inScope.filter(MATCHES[filter])].sort((a, b) => {
      switch (sort) {
        case "student":
          return (
            a.studentName.localeCompare(b.studentName) || a.title.localeCompare(b.title)
          );
        case "updated":
          return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
        case "college":
          return (
            (a.collegeName ?? "").localeCompare(b.collegeName ?? "") ||
            a.title.localeCompare(b.title)
          );
        default:
          // Soonest deadline first, because that is the order the work
          // actually has to happen in. Undated essays go last.
          if (!a.dueDate && !b.dueDate) return a.studentName.localeCompare(b.studentName);
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
      }
    });
  }, [inScope, filter, sort]);

  /**
   * Reopening is the counsellor tidying up after themselves and tells the
   * student nothing, so it needs no note and asks for none. The other two go
   * through the dialog.
   */
  function act(essay: ReviewQueueItem, action: ReviewAction) {
    if (action === "reopened") return void commit(essay, action, null);
    setReviewing({ essay, action });
  }

  async function commit(essay: ReviewQueueItem, action: ReviewAction, note: string | null) {
    if (!user) return;
    setBusyId(essay.id);
    const res = await reviewEssay({
      essayId: essay.id,
      counselorId: user.id,
      action,
      note: note ?? undefined,
      studentId: essay.studentId,
      essayTitle: essay.title,
      counselorName: profile?.full_name ?? undefined,
    });
    setBusyId(null);

    if (!res.success) return toast.error(res.error ?? "Could not record that.");
    setReviewing(null);
    toast.success(
      action === "approved"
        ? `${essay.title} is finished.`
        : action === "returned"
          ? `Sent back to ${essay.studentName.split(" ")[0]}.`
          : "Reopened."
    );
    await qc.invalidateQueries({ queryKey: ["review-queue"] });
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        <header className="relative overflow-hidden bg-primary px-6 py-7 text-white md:px-10 md:py-9">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Essays</h1>
              <p className="mt-1 text-[14px] text-white/80">
                {counts.waiting === 0
                  ? "Nothing is waiting on you."
                  : `${counts.waiting} waiting on you across ${students.length} ${students.length === 1 ? "student" : "students"}.`}
              </p>
            </div>

            {/* The same four numbers the tabs carried, read rather than
                clicked. A tab strip made you press one to find out how many
                were behind it; as figures they are all legible at once. */}
            <div className="flex flex-wrap items-end gap-8 pb-1">
              {FILTERS.filter((f) => f.id !== "all").map((f) => (
                <div key={f.id} className="text-left">
                  <p className="text-2xl font-bold leading-none tabular-nums">{counts[f.id]}</p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-wider text-white/70">
                    {f.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10">
          {/* Search, then the two controls that change what it shows. The
              filter lives at the end of the field rather than beside it,
              because narrowing by status and narrowing by word are the same
              action to somebody looking for one essay. */}
          <div className="mb-2 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a student, a title or a prompt"
                className="h-9 w-full rounded-md border border-border/60 bg-card pl-8 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
              />
            </div>

            <Dropdown<SortKey>
              value={sort}
              onChange={setSort}
              options={SORTS}
              size="sm"
              align="end"
              icon={<ArrowUpDown size={15} />}
              ariaLabel="Sort the queue"
              buttonClassName="h-9 rounded-md font-normal"
            />

          </div>

          {/* Whose turn it is. The same shapes and the same two colours the
              student's own page uses, so a counsellor and a student looking at
              the same essay see the same thing. */}
          <div className="mb-5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {FILTERS.map((f) => {
              const n = inScope.filter(MATCHES[f.id]).length;
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
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

            <p className="ml-auto shrink-0 text-xs text-muted-foreground">
              {visible.length} shown
            </p>
          </div>

          <div className="flex gap-5">
            {/* The rail is students here, not colleges. A counsellor's first
                question about an essay is whose it is; a student never has to
                ask. */}
            {(students.length > 1 || colleges.length > 1) && (
              <nav className="hidden w-[210px] shrink-0 flex-col gap-0.5 md:flex">
                <RailItem
                  label="All essays"
                  count={essays.length}
                  active={who === "all" && where === "all"}
                  onClick={() => {
                    setWho("all");
                    setWhere("all");
                  }}
                />

                {students.length > 1 && (
                  <>
                    <RailHeading>Students</RailHeading>
                    {students.map((st) => {
                      const mine = essays.filter((e) => e.studentId === st.id);
                      return (
                        <RailItem
                          key={st.id}
                          label={st.full_name ?? "Student"}
                          avatarUrl={st.avatar_url}
                          count={mine.length}
                          waiting={mine.filter(MATCHES.waiting).length}
                          active={who === st.id}
                          onClick={() => setWho(who === st.id ? "all" : st.id)}
                        />
                      );
                    })}
                  </>
                )}

                {colleges.length > 0 && (
                  <>
                    <RailHeading>Colleges</RailHeading>
                    {colleges.map((c) => (
                      <RailItem
                        key={c.key}
                        label={c.label}
                        count={c.count}
                        active={where === c.key}
                        onClick={() => setWhere(where === c.key ? "all" : c.key)}
                      />
                    ))}
                  </>
                )}
              </nav>
            )}

            <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-20 text-center text-[14px] text-muted-foreground">
              {filter === "waiting"
                ? "Nothing is waiting on you. The queue fills when a student asks for a review."
                : "Nothing here."}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((e) => (
                <EssayRow
                  key={e.id}
                  essay={e}
                  plan={plans?.get(e.studentId) ?? null}
                  college={
                    e.collegeUnitid
                      ? catalog.find((c) => c.unitid === e.collegeUnitid) ?? null
                      : null
                  }
                  busy={busyId === e.id}
                  onAct={act}
                />
              ))}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {reviewing && (
        <ReviewNoteDialog
          essay={reviewing.essay}
          action={reviewing.action}
          busy={busyId === reviewing.essay.id}
          onCancel={() => setReviewing(null)}
          onSubmit={(note) => void commit(reviewing.essay, reviewing.action, note)}
        />
      )}
    </PageWrapper>
  );
}

/**
 * What the counsellor wants to say, before it is said.
 *
 * Required on the way back and optional on the way out: an essay returned
 * without a reason is the complaint this whole screen exists to answer, while
 * an approval speaks for itself and a counsellor should not have to invent
 * something to close one.
 */
function ReviewNoteDialog({
  essay,
  action,
  busy,
  onCancel,
  onSubmit,
}: {
  essay: ReviewQueueItem;
  action: ReviewAction;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (note: string | null) => void;
}) {
  const [note, setNote] = useState("");
  const returning = action === "returned";
  const firstName = essay.studentName.split(" ")[0];
  const tooShort = returning && note.trim().length < 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-xl">
        <div className="border-b border-border p-5">
          <h2 className="text-[17px] font-semibold text-foreground">
            {returning ? `Send back to ${firstName}` : `Mark this finished`}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{essay.title}</p>
        </div>

        <div className="p-5">
          <label htmlFor="review-note" className="mb-2 block text-[13px] font-medium text-foreground">
            {returning ? "What should they change" : "Anything to add"}
            {!returning && <span className="ml-1 font-normal text-muted-foreground">optional</span>}
          </label>
          <textarea
            id="review-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            autoFocus
            placeholder={
              returning
                ? "The opening is doing too much. Start at the moment in paragraph three and cut the rest."
                : "Strong close. Worth reusing the third paragraph on the Stanford supplement."
            }
            className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[14px] text-foreground outline-none transition-colors focus:border-primary"
          />
          <p className="mt-2 text-[12px] text-muted-foreground">
            {firstName} sees this on the essay and in the email that goes out.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || tooShort}
            onClick={() => onSubmit(note.trim() || null)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {returning ? "Send back" : "Finished"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Everything that is not this essay's next decision.
 *
 * Send back and Finished stay on the row because they are the job and a review
 * queue that costs two clicks a decision is a queue nobody works through. The
 * rest lives here: the Doc, where the writing happens rather than the
 * reviewing; the student's own page, which is where you go when one essay
 * turns out to be a conversation about all of them; and undoing an approval,
 * which is tidying up after yourself.
 */
function QueueMenu({
  essay,
  waiting,
  finished,
  busy,
  onAct,
}: {
  essay: ReviewQueueItem;
  /** Waiting on the counsellor, which is the only state with a decision in it. */
  waiting: boolean;
  finished: boolean;
  busy: boolean;
  onAct: (e: ReviewQueueItem, a: ReviewAction) => void;
}) {
  const firstName = essay.studentName.split(" ")[0];
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
          {/* The decision first, in the colours it wears everywhere else. */}
          {waiting && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onAct(essay, "returned");
                }}
                title="Back to the student with your comments"
                className={cn(item, "font-medium text-secondary disabled:opacity-50")}
              >
                <RotateCcw size={14} />
                Send it back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  onAct(essay, "approved");
                }}
                className={cn(item, "font-medium text-primary disabled:opacity-50")}
              >
                <Check size={14} />
                Mark as done
              </button>
              <div aria-hidden className="my-1 border-t border-border/50" />
            </>
          )}

          {/* No "open the essay" here: the title is already that link, and a
              menu whose first item repeats the thing you just clicked past is
              a menu nobody reads the rest of. */}
          {essay.driveUrl && (
            <a
              href={essay.driveUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className={cn(item, "text-foreground")}
            >
              <ExternalLink size={14} />
              Open in Google Docs
            </a>
          )}

          <Link
            to={`/counselor/students/${essay.studentId}`}
            onClick={() => setOpen(false)}
            className={cn(item, "text-foreground")}
          >
            <UserRound size={14} />
            {firstName}'s page
          </Link>

          {finished && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onAct(essay, "reopened");
              }}
              title="Undo the approval. This does not cost the family a round."
              className={cn(item, "text-foreground disabled:opacity-50")}
            >
              <Undo2 size={14} />
              Reopen it
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EssayRow({
  essay,
  plan,
  college,
  busy,
  onAct,
}: {
  essay: ReviewQueueItem;
  plan: AdmissionsPlan | null;
  /** The catalog row for the college this essay is for, when it has one. */
  college: College | null;
  busy: boolean;
  onAct: (essay: ReviewQueueItem, action: ReviewAction) => void;
}) {
  const due = dueLabel(essay.dueDate);
  const waiting = essay.status === "in_review";
  const finished = essay.status === "done";

  // Rounds are capped on the personal statement and nowhere else. This used to
  // read suppEssaysLimit as the ceiling for a supplement, so a 200 word MIT
  // answer showed "0 of 5 rounds" when the 5 was the number of supplements the
  // whole plan covers and rounds on a supplement are not capped at all. A
  // counsellor reading it believed they owed five rounds on that one essay.
  // The bar the student sees on the same essay, in the same colours. No live
  // word count here: the queue reads from Postgres and a count is a full text
  // export per essay, which is a lot of Drive for a list of forty. The status
  // pipeline is what the student's card falls back to anyway when a word limit
  // is unknown.
  const progress = !essay.driveUrl
    ? 0
    : finished
      ? 1
      : waiting
        ? 0.7
        : 0.35;

  const barTone = finished
    ? "bg-primary"
    : waiting
      ? "bg-secondary"
      : "bg-primary/40";

  const isPersonalStatement = essay.kind === "personal_statement";
  const quota = {
    label: "",
    used: essay.roundsUsed,
    limit: (isPersonalStatement ? plan?.tier.psRoundsLimit : null) ?? null,
  };

  /**
   * How much room is left in what the family bought.
   *
   * Red at the ceiling and gold on the last one, because the counsellor is the
   * person who has to decide whether to keep going, and finding out afterwards
   * that a round was the last one is finding out too late. Unlimited tiers and
   * supplements, which are not capped at all, stay quiet.
   */
  const quotaTitle = !plan
    ? "This student is not on an admissions plan"
    : isPersonalStatement
      ? `${plan.tier.name} includes ${plan.tier.psRoundsLimit == null ? "unlimited" : plan.tier.psRoundsLimit} personal statement rounds`
      : `${plan.tier.name} covers ${plan.tier.suppEssaysLimit == null ? "unlimited" : plan.tier.suppEssaysLimit} supplemental essays. Rounds on a supplement are not capped.`;

  const left = quota.limit == null ? null : quota.limit - quota.used;
  const roundsTone =
    left == null
      ? "text-muted-foreground"
      : left <= 0
        ? "font-medium text-destructive"
        : left === 1
          ? "font-medium text-secondary"
          : "text-muted-foreground";

  return (
    // A card rather than a row in a ruled list, the same shape the student sees
    // on the same essay. No overflow-hidden: the menu opens below the card and
    // was being clipped by it, so the progress bar clips itself instead.
    <article
      className={cn(
        "group relative flex flex-wrap items-start gap-4 rounded border bg-card px-4 py-4 transition-colors",
        finished
          ? "border-primary/40 bg-primary/5 hover:border-primary/60"
          : waiting
            ? "border-secondary/50 bg-secondary/5 hover:border-secondary/70"
            : "border-border/60 hover:border-primary/40"
      )}
    >
      <AvatarStack
        name={essay.studentName}
        avatarUrl={essay.studentAvatarUrl}
        collegeName={essay.collegeName}
        collegeLogo={college?.logo ?? null}
        collegeWebsite={college?.website ?? null}
        size={40}
      />

      <div className="min-w-0 flex-1">
        <Link
          to={`/counselor/essay/${essay.id}`}
          className="text-[15px] font-medium text-foreground transition-colors hover:text-primary"
        >
          {essay.title}
        </Link>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {essay.studentName}
          {essay.collegeName && ` - ${essay.collegeName}`}
          {essay.kind === "personal_statement" && " - Personal statement"}
          {essay.wordLimit != null && ` - ${essay.wordLimit} words`}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
          {due && (
            <span className={due.urgent ? "font-medium text-[#8a6a2a] dark:text-secondary" : "text-muted-foreground"}>
              {due.text}
            </span>
          )}
          {isPersonalStatement && quotaSpent(quota) && (
            <span className="font-medium text-destructive">tier used up</span>
          )}
          {!essay.driveUrl && (
            <span className="text-muted-foreground">no document yet</span>
          )}
          {!plan && <span className="text-muted-foreground">No plan</span>}
        </div>
      </div>

      {/* Where the two verbs used to sit. A queue of forty rows carrying three
          buttons each is forty rows of chrome, and the number that says how
          much of the tier is left was buried in the small print underneath. */}
      <div className="flex shrink-0 items-center gap-3">
        <span className={cn("text-[12.5px]", roundsTone)} title={quotaTitle}>
          {isPersonalStatement
            ? `${quotaLabel(quota)} ${quota.used === 1 ? "round" : "rounds"}`
            : quota.used === 0
              ? "not reviewed yet"
              : `round ${quota.used}`}
        </span>

        <QueueMenu
          essay={essay}
          waiting={waiting}
          finished={finished}
          busy={busy}
          onAct={onAct}
        />
      </div>

      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden rounded-b bg-muted"
      >
        <div
          className={cn("h-full transition-[width] duration-300", barTone)}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </article>
  );
}

