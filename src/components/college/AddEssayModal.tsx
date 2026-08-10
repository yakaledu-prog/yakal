import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { FieldLabel } from "@/components/ui/InfoHint";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Segmented } from "@/components/ui/Segmented";

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
  // Asked rather than worked out from whether a college is picked. It used to
  // be inferred, so a student had no way to see which of the two they were
  // making, and the 650 word limit appeared from nowhere.
  const [kind, setKind] = useState<"personal_statement" | "supplement">("personal_statement");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPrompt("");
    setLimit(null);
    setSchoolId(presetSchoolId ?? "");
    setKind(presetSchoolId ? "supplement" : "personal_statement");
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
      kind,
      // A personal statement goes to every college, so it belongs to none.
      college_list_item_id: kind === "supplement" ? schoolId || null : null,
      prompt: prompt.trim() || null,
      // The Common App personal statement is fixed at 650, so it is filled in
      // rather than asked for. Supplement limits vary per prompt.
      word_limit: limit ?? (kind === "supplement" ? null : 650),
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
        <header className="flex items-center justify-between gap-4 border-b border-[#e9edef] px-5 py-4 dark:border-[#2a3942]">
          <h2 className="text-[16px] font-semibold">Add an essay</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <FieldLabel hint="The personal statement is the one essay every college reads. A supplement is written for one college and answers its own question.">
              What kind
            </FieldLabel>
            <Segmented
              value={kind}
              onChange={setKind}
              ariaLabel="Kind of essay"
              options={[
                { value: "personal_statement", label: "Personal statement" },
                { value: "supplement", label: "Supplement" },
              ]}
            />
          </div>

          <div>
            <FieldLabel htmlFor="essay-title">Title</FieldLabel>
            <input
              id="essay-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={kind === "supplement" ? "Why Hopkins?" : "Personal statement"}
              className={input}
            />
          </div>

          {/* Only for a supplement. A personal statement goes to every
              college, so asking which one it is for is a question with no
              right answer. */}
          {kind === "supplement" && (
            <div>
              <FieldLabel hint="Add colleges to your list first if the one you want is not here.">
                Which college
              </FieldLabel>
              <Dropdown
                value={schoolId}
                onChange={setSchoolId}
                options={[
                  { value: "", label: "Not decided yet" },
                  ...schools.map((s) => ({ value: s.id, label: s.school_name })),
                ]}
                buttonClassName="h-11 rounded-xl text-[14px] font-normal"
                ariaLabel="College this essay is for"
              />
            </div>
          )}

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
            <FieldLabel hint="Colleges enforce these. Supplements vary, so leave it blank if the prompt does not say.">
              Word limit
            </FieldLabel>
            <NumberStepper
              value={limit}
              onChange={setLimit}
              max={2000}
              placeholder={kind === "supplement" ? "-" : "650"}
              ariaLabel="Word limit"
            />
            {kind === "personal_statement" && limit === null && (
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                Left blank this is 650, the Common App limit.
              </p>
            )}
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
