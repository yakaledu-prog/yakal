import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Edit2, Trash2, Loader2, X, Plus, Save, Send, Check, AlertTriangle, GripVertical, Search, ChevronLeft, Braces, ChevronRight, MoreVertical,
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
import { JsonEditor } from "@/components/ui/JsonEditor";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import { AdminHeader } from "../AdminHeader";

const BLANK_QUESTION = (n: number): DiagnosticQuestion => ({
  id: `q${n}`,
  text: "",
  options: ["", ""],
  correctAnswer: 0,
});

type Draft = DiagnosticInput;

/**
 * A saved row back into the shape the writer takes.
 *
 * The inline adder needs this because updateDiagnostic replaces the whole
 * record: appending one question still means sending every other field back
 * untouched, and rebuilding it by hand at the call site is how a title or a
 * time limit quietly gets dropped.
 */
function toInput(row: DiagnosticRow): Draft {
  return {
    slug: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    timeLimitMinutes: row.timeLimitMinutes ?? null,
    questions: row.questions,
    courseId: row.courseId,
    published: row.published,
  };
}

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

/**
 * The results key, derived from the title.
 *
 * It used to be a field. Nobody wants to invent one, and the only thing it
 * could usefully be told was not to change, because scores are stored against
 * it and moving it on a live test orphans every past result. So it is
 * generated once at creation and never written again on edit.
 */
function slugify(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

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
        <GripVertical size={16} className="mt-2.5 hidden shrink-0 text-muted-foreground/40 sm:block" />
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

        <button
          type="button"
          onClick={addOption}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[12.5px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground"
        >
          <Plus size={14} /> Add option
        </button>

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
  initial, presetSubject, busy, onSave, onDelete, onClose,
}: {
  initial: DiagnosticRow | null;
  /** Filled in when creating from a subject that is already open. */
  presetSubject?: string | null;
  busy: boolean;
  onSave: (input: Draft, publish: boolean) => void;
  /** Deleting lives in here rather than beside the tab, so the tab needs
      only a pencil and the destructive option is one level in. */
  onDelete: () => void;
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
      : { ...EMPTY, categoryName: presetSubject ?? "" }
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
      // Keep whatever the test already has; only a new one gets a fresh slug.
      slug: initial ? initial.id : slugify(form.title),
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
        {/* The stepper is the heading. A title saying "New diagnostic" above
            a step called "Details" said the same thing twice, and the dialog
            is already named for assistive tech by aria-label. */}
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 pt-5 md:px-6">
          {/* Clickable, because step one is three fields somebody will want to
              jump back to without answering "are you sure" first. */}
          <div className="flex gap-1">
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

          <button onClick={onClose} aria-label="Close" className="-mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-muted/60">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {step === 1 ? (
            <div className="space-y-5">
              <div>
                <label className={label}>Title</label>
                <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Algebra" className={field} />
              </div>

              <div>
                <label className={label}>Subject</label>
                <input
                  value={form.categoryName}
                  onChange={(e) => set("categoryName", e.target.value)}
                  placeholder="K-12 Math (tests are grouped under this)"
                  className={field}
                />
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

              {/* Under Add question because it is the other way to get
                  questions in, not a footer action on the dialog. */}
              <button
                type="button"
                onClick={openJson}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground"
              >
                <Braces size={15} /> Paste JSON
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <JsonEditor
                value={json}
                onChange={(next) => {
                  setJson(next);
                  setJsonError(null);
                }}
                rows={16}
                hint="correctAnswer counts from 0. A whole test can be pasted; only its questions are read."
                action={
                  <>
                    <button
                      type="button"
                      onClick={() => { setMode("form"); setJsonError(null); }}
                      className="rounded-xl bg-white/10 px-4 py-2 text-[13px] font-normal text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={applyJson}
                      className="rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-normal text-white shadow-lg transition-colors hover:bg-[#0d7f86]"
                    >
                      Load questions
                    </button>
                  </>
                }
              />
              {jsonError && (
                <p className="flex items-start gap-1.5 text-[12.5px] text-[#CAA25F]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {jsonError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 md:px-6">
          {/* Back at the left end. Closing is the X in the header, so a
              Cancel beside Publish only competed with it. */}
          <div className="flex items-center gap-4">
            {initial && (
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 text-[13px] font-normal text-red-600 transition-colors hover:text-red-700"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            {step === 2 ? (
              <button
                type="button"
                onClick={() => { if (mode === "json") { setMode("form"); setJsonError(null); } else setStep(1); }}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-normal text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ChevronLeft size={15} /> Back
              </button>
            ) : (
              <span />
            )}
          </div>

          <div className="flex items-center gap-2">
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
                  className="flex items-center gap-1.5 rounded-xl border border-[#97CE9D] bg-[#97CE9D]/15 px-4 py-2.5 text-[13.5px] font-normal text-foreground transition-colors hover:bg-[#97CE9D]/30 disabled:opacity-50"
                >
                  <Save size={14} /> Save draft
                </button>
                <button
                  onClick={() => { const d = collect(true); if (d) onSave(d, true); }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-normal text-white hover:bg-[#0d7f86] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
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

/**
 * A kebab menu.
 *
 * The menu is portalled to the body and placed from the button's rect, because
 * the subject list scrolls with overflow-y-auto and an overflow container
 * crops its own descendants however high their z-index. Positioned inside the
 * row it was clipped to a few pixels, which looked like it was not opening.
 */
function Kebab({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (at) return setAt(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setAt({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={!!at}
        className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <MoreVertical size={15} />
      </button>

      {at &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setAt(null)} />
            <div
              style={{ top: at.top, right: at.right }}
              className="fixed z-[71] w-52 rounded-xl border border-[#e9edef] bg-white p-1 text-left shadow-lg dark:border-[#2a3942] dark:bg-[#111b21]"
            >
              {children(() => setAt(null))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

const menuItem =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-muted/60";

/**
 * Adding questions to a test that already exists.
 *
 * Its own dialog rather than the create stepper: there is nothing to say about
 * the test itself, only questions to write, so the two steps and the Publish
 * decision would all be noise. Several can be added at once, by hand or by
 * pasting, because a batch is the usual reason to come here.
 */
function AddQuestionsDialog({
  test, busy, onAdd, onClose,
}: {
  test: DiagnosticRow;
  busy: boolean;
  onAdd: (questions: DiagnosticQuestion[]) => void;
  onClose: () => void;
}) {
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([
    BLANK_QUESTION(test.questions.length + 1),
  ]);
  const [mode, setMode] = useState<"form" | "json">("form");
  const [json, setJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const written = questions.filter((q) => q.text.trim());
  const usable = written.filter((q) => q.options.filter((o) => o.trim()).length >= 2);

  function openJson() {
    setJson(written.length ? JSON.stringify(written, null, 2) : QUESTION_TEMPLATE);
    setJsonError(null);
    setMode("json");
  }

  function applyJson() {
    const parsed = parseQuestionsJson(json);
    if (!parsed.ok) return setJsonError(parsed.error);
    setQuestions(parsed.questions);
    setJsonError(null);
    setMode("form");
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Add questions to ${test.title}`}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 md:px-6">
          <h2 className="text-[15px] font-semibold tracking-tight">Add questions to {test.title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          {mode === "form" ? (
            <div className="space-y-3">
              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  question={q}
                  index={test.questions.length + i}
                  canRemove={questions.length > 1}
                  onChange={(next) => setQuestions(questions.map((old, n) => (n === i ? next : old)))}
                  onRemove={() => setQuestions(questions.filter((_, n) => n !== i))}
                />
              ))}
              <button
                type="button"
                onClick={() => setQuestions([...questions, BLANK_QUESTION(test.questions.length + questions.length + 1)])}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground"
              >
                <Plus size={15} /> Add question
              </button>
              <button
                type="button"
                onClick={openJson}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground"
              >
                <Braces size={15} /> Paste JSON
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <JsonEditor
                value={json}
                onChange={(next) => { setJson(next); setJsonError(null); }}
                rows={16}
                hint="correctAnswer counts from 0. A whole test can be pasted; only its questions are read."
                action={
                  <>
                    <button
                      type="button"
                      onClick={() => { setMode("form"); setJsonError(null); }}
                      className="rounded-xl bg-white/10 px-4 py-2 text-[13px] font-normal text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={applyJson}
                      className="rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-normal text-white shadow-lg transition-colors hover:bg-[#0d7f86]"
                    >
                      Load questions
                    </button>
                  </>
                }
              />
              {jsonError && (
                <p className="flex items-start gap-1.5 text-[12.5px] text-[#CAA25F]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {jsonError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4 md:px-6">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-normal text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => onAdd(usable)}
            disabled={busy || usable.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-normal text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Add {usable.length || ""} question{usable.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The admin side of diagnostics, laid out like the student side.
 *
 * Subjects down the left, the chosen subject's tests as tabs across the top,
 * one test at a time below. The student sits these tests through exactly this
 * shape, so an admin checking what a subject looks like is looking at the
 * thing itself rather than at a list that describes it.
 *
 * A subject is not a table of its own: it exists because a test names it. So
 * "New subject" is a new diagnostic with its subject field empty and focused,
 * rather than a separate thing to create and then fill.
 */
export function AdminDiagnostics() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DiagnosticRow | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<DiagnosticRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [subject, setSubject] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [adding, setAdding] = useState<DiagnosticRow | null>(null);
  const [presetSubject, setPresetSubject] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  // One pane at a time on a phone, both on a desktop. The same hook nine other
  // pages use, rather than a tenth take on it.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["admin-diagnostics"],
    queryFn: getDiagnostics,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-diagnostics"] });

  const subjects = useMemo(() => {
    const groups = new Map<string, DiagnosticRow[]>();
    for (const t of tests) {
      const list = groups.get(t.categoryName) ?? [];
      list.push(t);
      groups.set(t.categoryName, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tests]);

  const shown = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      ([name, group]) =>
        name.toLowerCase().includes(q) ||
        group.some((t) => t.title.toLowerCase().includes(q))
    );
  }, [subjects, filterText]);

  // Derived rather than synced from an effect: the selection is only ever a
  // name, and a name that no longer exists should fall back rather than leave
  // the pane blank after a delete or a rename.
  const activeSubject = shown.find(([name]) => name === subject)?.[0] ?? shown[0]?.[0] ?? null;
  const group = shown.find(([name]) => name === activeSubject)?.[1] ?? [];
  const activeTest = group.find((t) => t.rowId === testId) ?? group[0] ?? null;

  const stats = [
    { label: "Tests", value: group.length },
    { label: "Published", value: group.filter((t) => t.published).length },
    { label: "Questions", value: group.reduce((n, t) => n + t.questions.length, 0) },
  ];

  async function save(input: Draft, publish: boolean) {
    setBusy(true);
    const res = editing ? await updateDiagnostic(editing.rowId, input) : await createDiagnostic(input);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not save that.");
    toast.success(publish ? "Published. Students can sit it now." : "Saved as a draft.");
    // Follow the subject that was just written, so creating a test in a new
    // subject does not leave you looking at the old one.
    if (input.categoryName) setSubject(input.categoryName);
    setEditing(undefined);
    refresh();
  }

  async function addQuestions(test: DiagnosticRow, questions: DiagnosticQuestion[]) {
    if (!questions.length) return;
    setBusy(true);
    const res = await updateDiagnostic(test.rowId, {
      ...toInput(test),
      questions: [...test.questions, ...questions],
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not add those questions.");
    toast.success(questions.length === 1 ? "Question added." : `${questions.length} questions added.`);
    setAdding(null);
    refresh();
  }

  /** Rename rewrites categoryName on every test grouped under it. */
  async function confirmRename() {
    if (!renaming) return;
    const to = renaming.to.trim();
    if (!to) return toast.error("A subject name is needed.");
    const affected = tests.filter((t) => t.categoryName === renaming.from);
    setBusy(true);
    for (const t of affected) {
      const res = await updateDiagnostic(t.rowId, {
        ...toInput(t),
        categoryName: to,
        categoryId: to.toLowerCase(),
      });
      if (!res.success) {
        setBusy(false);
        return toast.error(res.error ?? "Could not rename that subject.");
      }
    }
    setBusy(false);
    toast.success(`Renamed to ${to}.`);
    setSubject(to);
    setRenaming(null);
    refresh();
  }

  async function confirmDeleteSubject() {
    if (!subjectToDelete) return;
    const affected = tests.filter((t) => t.categoryName === subjectToDelete);
    setBusy(true);
    for (const t of affected) {
      const res = await deleteDiagnostic(t.rowId);
      if (!res.success) {
        setBusy(false);
        return toast.error(res.error ?? "Could not delete that subject.");
      }
    }
    setBusy(false);
    toast.success(`${subjectToDelete} deleted.`);
    setSubjectToDelete(null);
    setSubject(null);
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
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-background md:flex-row md:overflow-hidden dark:bg-[#111b21]">
        <aside className={cn("w-full flex-col border-b border-[#e9edef] md:h-full md:w-[300px] md:shrink-0 md:border-b-0 md:border-r dark:border-[#2a3942]", listClass)}>
          <div className="border-b border-[#e9edef] bg-white px-3 pb-2 pt-5 dark:border-[#2a3942] dark:bg-[#111b21]">
            <div className="group flex items-center gap-2 border-b-2 border-transparent px-2 py-2 transition ease-in-out focus-within:border-[#1099A1]">
              <Search size={18} className="shrink-0 text-[#697780] group-focus-within:text-[#1099A1]" />
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search subjects"
                className="flex-1 bg-transparent text-[14px] text-[#111] outline-none placeholder:text-[#8696a0] dark:text-white"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#1099A1]" />
              </div>
            ) : shown.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                {filterText ? "No subject matches that." : "No subjects yet."}
              </p>
            ) : (
              shown.map(([name, list]) => {
                const active = name === activeSubject;
                return (
                  <div
                    key={name}
                    className={cn(
                      "flex items-center gap-2 border-l-2 pr-2 transition-colors",
                      active
                        ? "border-l-[#1099A1] bg-[#1099A1]/5"
                        : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]"
                    )}
                  >
                    <button
                      onClick={() => { setSubject(name); setTestId(null); openDetail(); }}
                      className="min-w-0 flex-1 p-4 text-left"
                    >
                      <p className={cn("truncate text-[14px] font-semibold", active ? "text-[#1099A1]" : "text-[#111] dark:text-white")}>
                        {name}
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {list.filter((t) => t.published).length} / {list.length} published
                      </p>
                    </button>

                    <Kebab label={`Actions for ${name}`}>
                      {(close) => (
                        <>
                          <button
                            type="button"
                            className={menuItem}
                            onClick={() => { setRenaming({ from: name, to: name }); close(); }}
                          >
                            <Edit2 size={14} /> Rename subject
                          </button>
                          <button
                            type="button"
                            className={cn(menuItem, "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30")}
                            onClick={() => { setSubjectToDelete(name); close(); }}
                          >
                            <Trash2 size={14} /> Delete subject
                          </button>
                        </>
                      )}
                    </Kebab>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-[#e9edef] p-3 dark:border-[#2a3942]">
            <button
              onClick={() => { setPresetSubject(null); setEditing(null); }}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground"
            >
              <Plus size={15} /> New diagnostic
            </button>
          </div>
        </aside>

        <section className={cn("min-h-0 min-w-0 flex-1 flex-col md:h-full md:overflow-y-auto", detailClass)}>
          {activeSubject === null ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center">
              <p className="max-w-sm text-muted-foreground">
                Nothing here yet. Students fall back to the tests built into the app until you add one.
              </p>
            </div>
          ) : (
            <>
              <AdminHeader
                title={activeSubject}
                subtitle={`${group.length} test${group.length === 1 ? "" : "s"}`}
                stats={stats}
                hideStatsOnMobile
                hideSubtitleOnMobile
                leading={
                  <button
                    onClick={closeDetail}
                    className="mb-2 flex items-center gap-1 text-[13px] text-white/80 transition-colors hover:text-white md:hidden"
                  >
                    <ChevronLeft size={15} /> Subjects
                  </button>
                }
              >
                <div className="-mb-8 mt-6 flex items-center gap-5 overflow-x-auto">
                  {group.map((t) => {
                    const on = t.rowId === activeTest?.rowId;
                    return (
                      /* Each tab carries its own kebab, so a test can be
                         edited or deleted without selecting it first. */
                      <div
                        key={t.rowId}
                        className={cn(
                          "flex shrink-0 items-center gap-1 border-b-2 pb-0.5 transition-all",
                          on ? "border-white" : "border-transparent"
                        )}
                      >
                        <button
                          onClick={() => setTestId(t.rowId)}
                          className={cn(
                            "whitespace-nowrap px-1 text-[13.5px] font-normal transition-colors",
                            on ? "text-white" : "text-white/70 hover:text-white"
                          )}
                        >
                          {t.title}
                          {!t.published && <span className="ml-2 text-white/60">Draft</span>}
                        </button>

                        <button
                          onClick={() => setEditing(t)}
                          aria-label={`Edit ${t.title}`}
                          title={`Edit ${t.title}`}
                          className="shrink-0 rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    );
                  })}

                  {/* A new test in the subject already open, rather than the
                      sidebar button which starts from an empty subject. */}
                  <button
                    onClick={() => { setPresetSubject(activeSubject); setEditing(null); }}
                    aria-label={`New test in ${activeSubject}`}
                    title={`New test in ${activeSubject}`}
                    className="mb-1 shrink-0 rounded-lg p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </AdminHeader>

              {activeTest && (
                <div className="mx-auto w-full space-y-6 p-6 md:p-10">
                  {/* Laid out the way the student meets it: the question, then
                      the choices as cards. Reading it here is the check that
                      matters, and it only works if it looks like the thing. */}
                  <div className="space-y-10">
                    {activeTest.questions.map((q, i) => (
                      <div key={q.id ?? i}>
                        <p className="text-[16px] font-semibold">
                          {i + 1}. {q.text || <span className="font-normal text-muted-foreground">No question text</span>}
                        </p>

                        <div className="mt-4 space-y-3">
                          {q.options.map((opt, n) => {
                            const correct = n === q.correctAnswer;
                            return (
                              <div
                                key={n}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-[14px]",
                                  correct
                                    ? "border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1]"
                                    : "border-border text-foreground"
                                )}
                              >
                                <span>{opt || <span className="text-muted-foreground">Empty option</span>}</span>
                                {correct && <Check size={16} className="shrink-0" />}
                              </div>
                            );
                          })}
                        </div>

                        {/* Folded away: it is shown to the student only after
                            marking, and reading a page of them while checking
                            the questions buries the questions. */}
                        {q.explanation && (
                          <details className="mt-3 group">
                            <summary className="cursor-pointer list-none text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
                              <ChevronRight size={13} className="mr-1 inline transition-transform group-open:rotate-90" />
                              Explanation
                            </summary>
                            <p className="mt-2 pl-5 text-[13px] text-muted-foreground">{q.explanation}</p>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setAdding(activeTest)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground"
                  >
                    <Plus size={15} /> Add a question
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {editing !== undefined && (
        <EditDialog
          initial={editing}
          presetSubject={presetSubject}
          busy={busy}
          onSave={save}
          onDelete={() => { if (editing) { setToDelete(editing); setEditing(undefined); } }}
          onClose={() => { setEditing(undefined); setPresetSubject(null); }}
        />
      )}

      {adding && (
        <AddQuestionsDialog
          test={adding}
          busy={busy}
          onAdd={(questions) => void addQuestions(adding, questions)}
          onClose={() => setAdding(null)}
        />
      )}

      {renaming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setRenaming(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Rename subject"
            className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl md:p-6"
          >
            <h2 className="text-[15px] font-semibold tracking-tight">Rename subject</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Every test grouped under {renaming.from} moves with it.
            </p>
            <input
              autoFocus
              value={renaming.to}
              onChange={(e) => setRenaming({ ...renaming, to: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") void confirmRename(); }}
              className={cn(field, "mt-4")}
            />
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={() => { setSubjectToDelete(renaming.from); setRenaming(null); }}
                className="flex items-center gap-1.5 text-[13px] font-normal text-red-600 transition-colors hover:text-red-700"
              >
                <Trash2 size={14} /> Delete subject
              </button>
              <span className="flex-1" />
              <button
                onClick={() => setRenaming(null)}
                className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-normal text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmRename()}
                disabled={busy || !renaming.to.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-normal text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-40"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!subjectToDelete}
        onClose={() => setSubjectToDelete(null)}
        onConfirm={confirmDeleteSubject}
        title="Delete subject"
        message={`Delete "${subjectToDelete}" and all ${tests.filter((t) => t.categoryName === subjectToDelete).length} test(s) in it? Scores already recorded are kept, but nobody will be able to sit them again.`}
        confirmText="Delete"
        isDestructive
      />

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
