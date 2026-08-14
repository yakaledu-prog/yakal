import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, RotateCcw, Undo2 } from "lucide-react";

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
    const rows = essays.filter(MATCHES[filter]);
    // Soonest deadline first within the queue, because that is the order the
    // work actually has to happen in. Undated essays go last.
    return rows.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.studentName.localeCompare(b.studentName);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [essays, filter]);

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

          <div className="relative z-10">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Essays</h1>
            <p className="mt-1 text-[14px] text-white/80">
              {counts.waiting === 0
                ? "Nothing is waiting on you."
                : `${counts.waiting} waiting on you across ${students.length} ${students.length === 1 ? "student" : "students"}.`}
            </p>

            <nav className="mt-6 flex gap-1 overflow-x-auto">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "whitespace-nowrap border-b-[3px] px-4 py-3 text-[14px] transition-colors",
                    filter === f.id
                      ? "border-white font-semibold text-white"
                      : "border-transparent text-white/60 hover:text-white"
                  )}
                >
                  {f.label}
                  <span className="ml-1.5 text-white/60">{counts[f.id]}</span>
                </button>
              ))}
            </nav>
          </div>
        </header>

        <div className="p-6 md:p-10">
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
            <div className="mx-auto max-w-4xl divide-y divide-border">
              {visible.map((e) => (
                <EssayRow
                  key={e.id}
                  essay={e}
                  plan={plans?.get(e.studentId) ?? null}
                  busy={busyId === e.id}
                  onAct={act}
                />
              ))}
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
