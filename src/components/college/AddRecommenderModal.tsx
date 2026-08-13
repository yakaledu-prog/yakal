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
      notes: askedOn ? `Asked on ${askedOn}` : null,
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
        <header className="relative overflow-hidden bg-primary px-5 py-4 text-white">
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
            <div className="flex-1">
              <h2 className="text-[16px] font-semibold">Add a recommender</h2>
              <p className="text-[12px] text-white/80">
                Ask in person first. Adding them here only tracks it.
              </p>
            </div>
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
            className="h-10 rounded-xl px-3 text-[14px] font-medium text-[#54656f] transition-colors hover:text-[#111] disabled:opacity-40 dark:text-[#aebac1] dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || saving}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
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
