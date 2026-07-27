import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { FieldLabel } from "@/components/ui/InfoHint";
import { NumberStepper } from "@/components/ui/NumberStepper";

export interface NewEssay {
  title: string;
  kind: "personal_statement" | "supplement";
  college_list_item_id: string | null;
  prompt: string | null;
  word_limit: number | null;
}

const input =
  "h-11 w-full rounded-xl border border-[#e9edef] bg-white px-3 text-[14px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white";

/**
 * Adding an essay, as a modal rather than a panel that pushed the list down.
 *
 * `presetSchoolId` comes from the rail, so adding from inside a college is
 * already scoped to it and the student is not asked a question they have
 * effectively just answered.
 */
export function AddEssayModal({
  open,
  onClose,
  onSubmit,
  schools,
  presetSchoolId,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: NewEssay) => void;
  schools: CollegeListItem[];
  presetSchoolId?: string | null;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [limit, setLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPrompt("");
    setLimit(null);
    setSchoolId(presetSchoolId ?? "");
  }, [open, presetSchoolId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const submit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      kind: schoolId ? "supplement" : "personal_statement",
      college_list_item_id: schoolId || null,
      prompt: prompt.trim() || null,
      // The Common App personal statement limit is fixed at 650, so it is
      // filled in rather than asked for. Supplement limits vary per prompt.
      word_limit: limit ?? (schoolId ? null : 650),
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add an essay"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-[#1099A1] px-5 py-4 text-white">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[55%] text-white/10"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path
              d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
            />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>
          <div className="relative z-10 flex items-center gap-3">
            <h2 className="flex-1 text-[16px] font-semibold">Add an essay</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
              className="text-white/70 transition-colors hover:text-white disabled:opacity-40"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="essay-title">Title</FieldLabel>
              <input
                id="essay-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Why Hopkins? supplement"
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
            <FieldLabel hint="Colleges enforce these. The Common App statement is fixed at 650; supplements vary, so leave it blank if the prompt does not say.">
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
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#e9edef] px-5 py-3 dark:border-[#2a3942]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl px-3 text-[14px] font-medium text-[#54656f] transition-colors hover:text-[#111] disabled:opacity-40 dark:text-[#aebac1] dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || saving}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1099A1] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Add essay
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
