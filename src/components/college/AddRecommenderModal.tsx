import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { RecStatus } from "@/services/collegeService";
import { FieldLabel } from "@/components/ui/InfoHint";
import { DateField } from "@/components/ui/DateField";

export interface NewRecommender {
  recommender_name: string;
  recommender_email: string | null;
  relationship: string | null;
  status: RecStatus;
  /**
   * The date column, not prose.
   *
   * This used to go out as notes: `Asked on ${date}`, so asked_on stayed null
   * for everybody added through this form and the "asked 26 days ago" line the
   * list uses to decide whether to nudge never appeared for any of them.
   */
  asked_on: string | null;
  notes: string | null;
}

const input =
  "h-11 w-full rounded-xl border border-[#e9edef] bg-white px-3 text-[14px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-primary dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white";

export function AddRecommenderModal({
  open,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (r: NewRecommender) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [askedOn, setAskedOn] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setRole("");
    setAskedOn(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const submit = () => {
    if (!name.trim()) return;
    onSubmit({
      recommender_name: name.trim(),
      recommender_email: email.trim() || null,
      relationship: role.trim() || null,
      status: "requested",
      asked_on: askedOn,
      notes: null,
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a recommender"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21]">
        {/* Plain. The teal banner and its wave belonged to a page header, and
            on a 420px dialog it was half the height before a single field. */}
        <header className="flex items-start gap-3 px-5 pb-3 pt-5">
          <div className="flex-1">
            <h2 className="text-[16px] font-medium text-[#111] dark:text-white">
              Add a recommender
            </h2>
            <p className="mt-0.5 text-[13px] text-[#717182]">
              Ask in person first. Adding them here only tracks it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#a8adb8] transition-colors hover:bg-[#f3f3f5] hover:text-[#54656f] disabled:opacity-40 dark:hover:bg-[#1c2a32]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="rec-name">Name</FieldLabel>
              <input
                id="rec-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Mr Daniel Tesfaye"
                className={input}
              />
            </div>
            <div>
              <FieldLabel
                htmlFor="rec-role"
                hint="Colleges want to hear from teachers of core academic subjects you took recently, ideally in junior year."
              >
                Subject or role
              </FieldLabel>
              <input
                id="rec-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="AP Biology teacher"
                className={input}
              />
            </div>
            <div>
              <FieldLabel
                htmlFor="rec-email"
                hint="Common App emails the invitation here, so it must be the address they actually check. A school address is usually safest."
              >
                Email
              </FieldLabel>
              <input
                id="rec-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@school.edu"
                className={input}
              />
            </div>
            <div>
              <FieldLabel hint="Ask in person first, ideally late in junior year. Give recommenders three to four weeks.">
                Asked on
              </FieldLabel>
              <DateField value={askedOn} onChange={setAskedOn} ariaLabel="Date asked" />
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#e9edef] px-5 py-3 dark:border-[#2a3942]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-[#e9edef] px-3 text-[14px] font-medium text-[#54656f] transition-colors hover:bg-[#f3f3f5] disabled:opacity-40 dark:border-[#2a3942] dark:text-[#aebac1] dark:hover:bg-[#1c2a32]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || saving}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            )}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Add recommender
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
