import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ClipboardList, Edit2, Trash2, Loader2, X, Plus, Save, Check, AlertTriangle, GripVertical,
} from "lucide-react";
import {
  getDiagnostics, createDiagnostic, updateDiagnostic, deleteDiagnostic,
  parseQuestionsJson, QUESTION_TEMPLATE,
  type DiagnosticRow, type DiagnosticInput,
} from "@/services/diagnosticAdminService";
import type { DiagnosticQuestion } from "@/data/diagnostics";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/utils/cn";
import { AdminHeader } from "../AdminHeader";

const BLANK_QUESTION = (n: number): DiagnosticQuestion => ({
  id: `q${n}`,
  text: "",
  options: ["", ""],
  correctAnswer: 0,
});

type Draft = DiagnosticInput;

const EMPTY: Draft = {
  slug: "",
  title: "",
  description: "",
  categoryId: "",
  categoryName: "",
  timeLimitMinutes: null,
  questions: [BLANK_QUESTION(1)],
  courseId: null,
  published: false,
};

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none transition-colors focus:border-[#1099A1]";
const label = "mb-1.5 block text-[13px] text-muted-foreground";

/**
 * One question, edited in place.
 *
 * The correct answer is picked by clicking its option rather than typed as an
 * index. correctAnswer is stored zero-based, and asking somebody to count from
 * zero is how a test ends up marking the wrong answer right.
 */
function QuestionEditor({
  question, index, onChange, onRemove, canRemove,
}: {
  question: DiagnosticQuestion;
  index: number;
  onChange: (q: DiagnosticQuestion) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const set = <K extends keyof DiagnosticQuestion>(k: K, v: DiagnosticQuestion[K]) =>
    onChange({ ...question, [k]: v });

  function setOption(i: number, value: string) {
    const options = [...question.options];
    options[i] = value;
    onChange({ ...question, options });
  }

  function addOption() {
    onChange({ ...question, options: [...question.options, ""] });
  }

  function removeOption(i: number) {
    const options = question.options.filter((_, n) => n !== i);
    // The correct answer moves with the options, or deleting an early one
    // silently reassigns which answer is right.
    let correct = question.correctAnswer;
    if (i === correct) correct = 0;
    else if (i < correct) correct -= 1;
    onChange({ ...question, options, correctAnswer: correct });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-start gap-3">
        <GripVertical size={16} className="mt-2.5 shrink-0 text-muted-foreground/40" />
        <span className="mt-2.5 shrink-0 text-[13px] font-medium text-muted-foreground">{index + 1}.</span>
        <textarea
          value={question.text}
          onChange={(e) => set("text", e.target.value)}
          rows={2}
          placeholder="The question"
          className={cn(field, "flex-1 resize-y leading-relaxed")}
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove question ${index + 1}`}
          className="mt-1.5 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-red-600 disabled:opacity-30"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="space-y-2 pl-9">
        {question.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => set("correctAnswer", i)}
              aria-label={`Mark option ${i + 1} correct`}
              title="Mark correct"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                question.correctAnswer === i
                  ? "border-[#97CE9D] bg-[#97CE9D] text-white"
                  : "border-border text-transparent hover:border-[#97CE9D]"
              )}
            >
              <Check size={13} />
            </button>
            <input
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              className={cn(field, "py-2")}
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={question.options.length <= 2}
              aria-label={`Remove option ${i + 1}`}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-red-600 disabled:opacity-30"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={addOption}
            className="text-[12.5px] text-[#1099A1] transition-colors hover:text-[#0d7f86]"
          >
            Add option
          </button>
          <span className="text-[12px] text-muted-foreground">
            The ticked option is the correct one.
          </span>
        </div>

        <input
          value={question.explanation ?? ""}
          onChange={(e) => set("explanation", e.target.value)}
          placeholder="Why that is the answer (optional, shown after marking)"
          className={cn(field, "mt-1 py-2 text-[13px]")}
        />
      </div>
    </div>
  );
}

/**
 * Two steps, because the two halves are different jobs.
 *
 * What the test is gets filled in once and rarely revisited; the questions are
 * where the work is and want the whole width. One long form made the questions
 * start below the fold, so a screen whose point is writing questions opened on
 * a form about titles.
 */
function EditDialog({
  initial, busy, onSave, onClose,
}: {
  initial: DiagnosticRow | null;
  busy: boolean;
  onSave: (input: Draft, publish: boolean) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Draft>(
    initial
      ? {
          slug: initial.id,
          title: initial.title,
          description: initial.description,
          categoryId: initial.categoryId,
          categoryName: initial.categoryName,
          timeLimitMinutes: initial.timeLimitMinutes ?? null,
          questions: initial.questions.length ? initial.questions : [BLANK_QUESTION(1)],
          courseId: initial.courseId,
          published: initial.published,
        }
      : EMPTY
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"form" | "json">("form");
  // Held apart from the questions, so a half-typed paste is not parsed on every
  // keystroke and the caret does not jump while somebody edits.
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }));

  const written = form.questions.filter((q) => q.text.trim());
  const usable = written.filter((q) => q.options.filter((o) => o.trim()).length >= 2);

  function openJson() {
    // Whatever is written already, or a worked example when starting from
    // nothing, so the box is never a blank rectangle with no clue what fits.
    setJson(written.length ? JSON.stringify(written, null, 2) : QUESTION_TEMPLATE);
    setJsonError(null);
    setMode("json");
  }

  function applyJson() {
    const parsed = parseQuestionsJson(json);
    if (!parsed.ok) return setJsonError(parsed.error);
    setJsonError(null);
    set("questions", parsed.questions);
    setMode("form");
    toast.success(`${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"} loaded.`);
  }

  /** What both buttons share. Publishing asks for more than saving a draft. */
  function collect(publish: boolean): Draft | null {
    if (!form.title.trim()) {
      setStep(1);
      toast.error("A title is needed.");
      return null;
    }
    if (!form.slug.trim()) {
      setStep(1);
      toast.error("An id is needed. Results are keyed by it.");
      return null;
    }
    if (!form.categoryName.trim()) {
      setStep(1);
      toast.error("A subject is needed.");
      return null;
    }
    if (publish && usable.length === 0) {
      setStep(2);
      toast.error("A published test needs at least one question with two options.");
      return null;
    }
    if (publish && usable.length !== form.questions.length) {
      setStep(2);
      toast.error("Some questions are unfinished. Finish them, or remove them before publishing.");
      return null;
    }
    return {
      ...form,
      // A draft may hold half-written questions; a published one may not.
      questions: publish ? usable : form.questions.filter((q) => q.text.trim() || q.options.some((o) => o.trim())),
      categoryId: form.categoryId.trim() || form.categoryName.trim().toLowerCase(),
      published: publish,
    };
  }

  const steps = ["Details", "Questions"] as const;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit diagnostic" : "New diagnostic"}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
      >
        <div className="border-b border-border px-5 pt-5 md:px-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-[18px] font-semibold tracking-tight">
              {initial ? "Edit diagnostic" : "New diagnostic"}
            </h2>
            <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60">
              <X size={18} />
            </button>
          </div>

          {/* Clickable, because step one is four fields somebody will want to
              jump back to without answering "are you sure" first. */}
          <div className="mt-4 flex gap-1">
            {steps.map((name, i) => {
              const n = (i + 1) as 1 | 2;
              const active = step === n;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setStep(n)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-1 pb-3 pr-5 text-[13.5px] transition-colors",
                    active ? "border-[#1099A1] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                      active ? "bg-[#1099A1] text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {n}
                  </span>
                  {name}
                  {n === 2 && written.length > 0 && (
                    <span className="text-[12px] text-muted-foreground">{written.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {step === 1 ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={label}>Title</label>
                  <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Algebra" className={field} />
                </div>
                <div>
                  <label className={label}>Id</label>
                  <input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="algebra" className={field} />
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Results are stored against this. Changing it on a live test orphans past scores.
                  </p>
                </div>
                <div>
                  <label className={label}>Subject</label>
                  <input
                    value={form.categoryName}
                    onChange={(e) => set("categoryName", e.target.value)}
                    placeholder="K-12 Math"
                    className={field}
                  />
                  <p className="mt-1 text-[12px] text-muted-foreground">Tests are grouped under this.</p>
                </div>
                <div>
                  <label className={label}>Time limit</label>
                  <input
                    type="number"
                    min={0}
                    value={form.timeLimitMinutes ?? ""}
                    onChange={(e) => set("timeLimitMinutes", e.target.value ? Number(e.target.value) : null)}
                    placeholder="Minutes, or leave blank"
                    className={field}
                  />
                </div>
              </div>

              <div>
                <label className={label}>Description</label>
                <input
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What this covers"
                  className={field}
                />
              </div>
            </div>
          ) : mode === "form" ? (
            <div className="space-y-3">
              {form.questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  question={q}
                  index={i}
                  canRemove={form.questions.length > 1}
                  onChange={(next) => set("questions", form.questions.map((old, n) => (n === i ? next : old)))}
                  onRemove={() => set("questions", form.questions.filter((_, n) => n !== i))}
                />
              ))}
              <button
                type="button"
                onClick={() => set("questions", [...form.questions, BLANK_QUESTION(form.questions.length + 1)])}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground"
              >
                <Plus size={15} /> Add question
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  setJsonError(null);
                }}
                spellCheck={false}
                rows={16}
                className={cn(field, "resize-y font-mono text-[12.5px] leading-relaxed")}
              />
              {jsonError && (
                <p className="flex items-start gap-1.5 text-[12.5px] text-[#CAA25F]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {jsonError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={applyJson}
                  className="rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-normal text-white transition-colors hover:bg-[#0d7f86]"
                >
                  Load questions
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("form"); setJsonError(null); }}
                  className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <span className="text-[12px] text-muted-foreground">
                  correctAnswer counts from 0. A whole test can be pasted; only its questions are read.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 md:px-6">
          {/* Bottom left, and quiet: pasting is the shortcut, not the main way
              in, and it only belongs beside the questions. */}
          {step === 2 && mode === "form" ? (
            <button
              type="button"
              onClick={openJson}
              className="text-[13px] text-[#1099A1] transition-colors hover:text-[#0d7f86]"
            >
              Paste JSON
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium hover:bg-muted/60">
              Cancel
            </button>
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-normal text-white hover:bg-[#0d7f86]"
              >
                Next
              </button>
            ) : (
              <>
                {/* Saving a draft accepts an unfinished test on purpose: it is
                    what you press when you have to stop halfway. */}
                <button
                  onClick={() => { const d = collect(false); if (d) onSave(d, false); }}
                  disabled={busy}
                  className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium hover:bg-muted/60 disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  onClick={() => { const d = collect(true); if (d) onSave(d, true); }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-normal text-white hover:bg-[#0d7f86] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {initial?.published ? "Save and keep live" : "Publish"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDiagnostics() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DiagnosticRow | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<DiagnosticRow | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["admin-diagnostics"],
    queryFn: getDiagnostics,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-diagnostics"] });

  const bySubject = useMemo(() => {
    const groups = new Map<string, DiagnosticRow[]>();
    for (const t of tests) {
      const list = groups.get(t.categoryName) ?? [];
      list.push(t);
      groups.set(t.categoryName, list);
    }
    return [...groups.entries()];
  }, [tests]);

  const stats = [
    { label: "Tests", value: tests.length },
    { label: "Published", value: tests.filter((t) => t.published).length },
    { label: "Questions", value: tests.reduce((n, t) => n + t.questions.length, 0) },
  ];

  async function save(input: Draft, publish: boolean) {
    setBusy(true);
    const res = editing ? await updateDiagnostic(editing.rowId, input) : await createDiagnostic(input);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not save that.");
    toast.success(publish ? "Published. Students can sit it now." : "Saved as a draft.");
    setEditing(undefined);
    refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const res = await deleteDiagnostic(toDelete.rowId);
    if (!res.success) return toast.error(res.error ?? "Could not delete that.");
    toast.success("Diagnostic deleted.");
    setToDelete(null);
    refresh();
  }

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background dark:bg-[#111b21]">
        <AdminHeader title="Diagnostics" subtitle="The placement tests students sit" stats={stats} />

        <div className="mx-auto max-w-[1440px] space-y-5 p-6 md:p-10">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] text-muted-foreground">
              Grouped by subject. Students see published tests only.
            </p>
            <button
              onClick={() => setEditing(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1099A1] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#0d7f86]"
            >
              <ClipboardList size={16} /> New diagnostic
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : tests.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">
                Nothing here yet. Students fall back to the tests built into the app until you add one.
              </p>
            </div>
          ) : (
            bySubject.map(([subject, group]) => (
              <div key={subject} className="space-y-3">
                <h3 className="text-[14px] font-medium text-muted-foreground">{subject}</h3>
                {group.map((t) => (
                  <div
                    key={t.rowId}
                    className={cn(
                      "flex items-start gap-4 rounded-xl border border-border bg-card p-4",
                      !t.published && "opacity-55"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2.5">
                        <p className="text-[15px] font-medium">{t.title}</p>
                        <span className="text-[12.5px] text-muted-foreground">{t.id}</span>
                        {!t.published && <span className="text-[12.5px] text-muted-foreground">Draft</span>}
                      </div>
                      <p className="mt-0.5 text-[13.5px] text-muted-foreground">{t.description}</p>
                      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                        {t.questions.length} question{t.questions.length === 1 ? "" : "s"}
                        {t.timeLimitMinutes ? ` / ${t.timeLimitMinutes} min` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setEditing(t)}
                        aria-label={`Edit ${t.title}`}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => setToDelete(t)}
                        aria-label={`Delete ${t.title}`}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-muted/60 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {editing !== undefined && (
        <EditDialog initial={editing} busy={busy} onSave={save} onClose={() => setEditing(undefined)} />
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete diagnostic"
        message={`Delete "${toDelete?.title}"? Scores already recorded against it are kept, but nobody will be able to sit it again.`}
        confirmText="Delete"
        isDestructive
      />
    </PageWrapper>
  );
}
