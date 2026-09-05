import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  ExternalLink,
  LayoutGrid,
  List,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";

import { Dropdown } from "@/components/ui/Dropdown";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { getCounselorStudents } from "@/services/counselorService";
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

const FILTERS = [
  { id: "waiting", label: "Waiting on me" },
  { id: "drafting", label: "With the student" },
  { id: "done", label: "Finished" },
  { id: "all", label: "Everything" },
] as const;

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterId>("waiting");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");

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

  const { data: plans } = useQuery({
    queryKey: ["admissions-plans", studentIds.join(",")],
    queryFn: () => getAdmissionsPlans(studentIds),
    enabled: studentIds.length > 0,
  });

  const counts = useMemo(() => {
    const out = {} as Record<FilterId, number>;
    for (const f of FILTERS) out[f.id] = essays.filter(MATCHES[f.id]).length;
    return out;
  }, [essays]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = essays.filter(MATCHES[filter]).filter((e) =>
      !needle
        ? true
        : e.title.toLowerCase().includes(needle) ||
          e.studentName.toLowerCase().includes(needle) ||
          (e.collegeName ?? "").toLowerCase().includes(needle)
    );
    // Soonest deadline first within the queue, because that is the order the
    // work actually has to happen in. Undated essays go last.
    return rows.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.studentName.localeCompare(b.studentName);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [essays, filter, query]);

  async function act(essay: ReviewQueueItem, action: ReviewAction) {
    if (!user) return;
    setBusyId(essay.id);
    const res = await reviewEssay({
      essayId: essay.id,
      counselorId: user.id,
      action,
      studentId: essay.studentId,
      essayTitle: essay.title,
    });
    setBusyId(null);

    if (!res.success) return toast.error(res.error ?? "Could not record that.");
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
        <header className="relative overflow-hidden bg-primary px-6 pt-6 text-white md:px-10 md:pt-8">
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
          <div className="mx-auto mb-6 flex max-w-4xl items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search essays"
                className="h-11 w-full rounded-xl border border-border bg-transparent pl-9 pr-11 text-[14px] text-foreground outline-none transition-colors focus:border-primary placeholder:text-muted-foreground"
              />
              {/* Inside the field, at the end of it. Narrowing by status and
                  narrowing by word are the same action to somebody hunting for
                  one essay, so they share a control. */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <Dropdown
                  value={filter}
                  onChange={(v) => setFilter(v as FilterId)}
                  options={FILTERS.map((f) => ({
                    value: f.id,
                    label: `${f.label} (${counts[f.id]})`,
                  }))}
                  align="end"
                  icon={<SlidersHorizontal size={15} />}
                  buttonClassName={cn(
                    "h-8 w-8 justify-center gap-0 rounded-lg border-0 bg-transparent px-0 [&>span]:hidden [&>svg:last-child]:hidden",
                    filter === "waiting"
                      ? "text-muted-foreground hover:text-foreground"
                      : "bg-primary/10 text-primary"
                  )}
                  ariaLabel="Filter essays by status"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center rounded-xl border border-border p-0.5">
              {([
                ["list", List, "List"],
                ["grid", LayoutGrid, "Grid"],
              ] as const).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  title={label}
                  aria-label={label}
                  aria-pressed={view === id}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg transition-colors",
                    view === id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

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
            <div
              className={cn(
                "mx-auto max-w-4xl",
                view === "list"
                  ? "divide-y divide-border"
                  : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              )}
            >
              {visible.map((e) =>
                view === "grid" ? (
                  <EssayCard
                    key={e.id}
                    essay={e}
                    busy={busyId === e.id}
                    onAct={act}
                  />
                ) : (
                <EssayRow
                  key={e.id}
                  essay={e}
                  plan={plans?.get(e.studentId) ?? null}
                  busy={busyId === e.id}
                  onAct={act}
                />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

function EssayRow({
  essay,
  plan,
  busy,
  onAct,
}: {
  essay: ReviewQueueItem;
  plan: AdmissionsPlan | null;
  busy: boolean;
  onAct: (essay: ReviewQueueItem, action: ReviewAction) => void;
}) {
  const due = dueLabel(essay.dueDate);
  const waiting = essay.status === "in_review";
  const finished = essay.status === "done";

  // What this student's tier includes for this kind of essay. Shown, never
  // enforced.
  const limit =
    essay.kind === "personal_statement" ? plan?.tier.psRoundsLimit : plan?.tier.suppEssaysLimit;
  const quota = { label: "", used: essay.roundsUsed, limit: limit ?? null };

  return (
    <article className="flex flex-wrap items-start gap-4 py-5">
      <img
        src={essay.studentAvatarUrl || dicebearUrl(essay.studentName)}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-foreground">{essay.title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {essay.studentName}
          {essay.collegeName && ` - ${essay.collegeName}`}
          {essay.kind === "personal_statement" && " - Personal statement"}
          {essay.wordLimit != null && ` - ${essay.wordLimit} words`}
        </p>

        {essay.prompt && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {essay.prompt}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
          {due && (
            <span className={due.urgent ? "font-medium text-[#8a6a2a] dark:text-secondary" : "text-muted-foreground"}>
              {due.text}
            </span>
          )}
          <span
            className={cn(
              "text-muted-foreground",
              quotaSpent(quota) && "font-medium text-[#8a6a2a] dark:text-secondary"
            )}
            title={
              plan
                ? `${plan.tier.name} includes ${quota.limit == null ? "unlimited" : quota.limit} ${essay.kind === "personal_statement" ? "personal statement rounds" : "supplemental essays"}`
                : "This student is not on an admissions plan"
            }
          >
            {quotaLabel(quota)} {quota.used === 1 ? "round" : "rounds"}
            {quotaSpent(quota) && ", tier used up"}
          </span>
          {!plan && <span className="text-muted-foreground">No plan</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {essay.driveUrl ? (
          <a
            href={essay.driveUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-primary px-3.5 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Open <ExternalLink size={14} />
          </a>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">No document yet</span>
        )}

        {finished ? (
          <button
            onClick={() => onAct(essay, "reopened")}
            disabled={busy}
            title="Undo the approval. This does not cost the family a round."
            className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
            Reopen
          </button>
        ) : (
          <>
            <button
              onClick={() => onAct(essay, "returned")}
              disabled={busy || !waiting}
              title={waiting ? "Back to the student with your comments" : "Already with the student"}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Send back
            </button>
            <button
              onClick={() => onAct(essay, "approved")}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              <Check size={14} /> Finished
            </button>
          </>
        )}
      </div>
    </article>
  );
}

/**
 * One essay as a card, for the grid.
 *
 * The same three facts as a row, stacked instead of strung out: whose it is,
 * what it is for, and how far along. The verbs stay, because a queue you can
 * only read is a list of things to open somewhere else.
 *
 * Deliberately no preview of the writing. The essay lives in a Google Doc and
 * the point of opening it is to read it there with comments; a thumbnail of
 * text nobody can read is decoration that costs a request.
 */
function EssayCard({
  essay,
  busy,
  onAct,
}: {
  essay: ReviewQueueItem;
  busy: boolean;
  onAct: (essay: ReviewQueueItem, action: "returned" | "approved" | "reopened") => void;
}) {
  const waiting = essay.status === "in_review";
  const done = essay.status === "done";

  return (
    <div className="flex flex-col rounded-xl border border-border p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <img
          src={essay.studentAvatarUrl || dicebearUrl(essay.studentName)}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-foreground">{essay.title}</p>
          <p className="truncate text-[12px] text-muted-foreground">{essay.studentName}</p>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.4em] text-[12.5px] leading-snug text-muted-foreground">
        {essay.collegeName ??
          (essay.kind === "personal_statement" ? "Personal statement" : "Supplemental essay")}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span
          className={cn(
            "text-[12px] font-medium",
            waiting ? "text-secondary" : done ? "text-primary" : "text-muted-foreground"
          )}
        >
          {waiting ? "Waiting on you" : done ? "Finished" : "With the student"}
          {essay.roundsUsed > 0 && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              round {essay.roundsUsed}
            </span>
          )}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          {essay.driveUrl && (
            <a
              href={essay.driveUrl}
              target="_blank"
              rel="noreferrer"
              title="Open the document"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <ExternalLink size={15} />
            </a>
          )}
          {waiting && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAct(essay, "returned")}
                title="Send it back"
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAct(essay, "approved")}
                title="Mark it finished"
                className="grid h-8 w-8 place-items-center rounded-lg text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                <Check size={15} />
              </button>
            </>
          )}
          {done && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAct(essay, "reopened")}
              title="Reopen it"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
