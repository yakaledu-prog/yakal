import { useMemo, useState } from "react";
import { Check, Flag, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/utils/cn";
import type { ChatMessage } from "@/services/messageService";
import {
  FLAG_REASONS,
  flagConversation,
  withdrawFlag,
  type ConversationFlag,
  type FlagReason,
} from "@/services/flagService";

// ============================================================
// Reporting messages to the Yakal team.
//
// The messages are chosen here rather than from a flag icon on each bubble. A
// transcript is read far more often than it is reported, so the reading view
// stays clean and the picking happens once, inside the report.
//
// Three steps: which messages, why, and what has already been reported. The
// last is a list rather than a form, but it belongs in the same stepper
// because it answers the question people open this dialog a second time to
// ask.
// ============================================================

/** The most recent messages, newest first. Older ones are rarely the subject. */
const PICKABLE = 20;

type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Messages" },
  { n: 2, label: "Reason" },
  { n: 3, label: "Reported" },
];

export function FlagConversationDialog({
  open,
  contactName,
  conversationId,
  userId,
  messages,
  existing,
  onClose,
  onDone,
}: {
  open: boolean;
  contactName: string;
  conversationId: string;
  userId: string;
  /** The conversation history, for choosing which messages to report. */
  messages: ChatMessage[];
  /** This reporter's own open reports on this conversation. */
  existing: ConversationFlag[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [general, setGeneral] = useState(false);
  const [reasons, setReasons] = useState<FlagReason[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [reviewing, setReviewing] = useState<ConversationFlag | null>(null);

  const recent = useMemo(
    () => messages.filter((m) => !m.pending && m.text).slice(-PICKABLE).reverse(),
    [messages]
  );

  const alreadyReported = useMemo(
    () => new Set(existing.map((f) => f.message_id).filter(Boolean) as string[]),
    [existing]
  );
  const generalReport = existing.find((f) => !f.message_id) ?? null;

  if (!open) return null;

  function reset() {
    setSelected([]);
    setGeneral(false);
    setReasons([]);
    setNote("");
    setStep(1);
    setReviewing(null);
  }

  function close() {
    reset();
    onClose();
  }

  const picked = general || selected.length > 0;

  function toggleMessage(id: string) {
    setGeneral(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (reasons.length === 0 || !picked) return;
    setBusy(true);
    const res = await flagConversation({
      conversationId,
      userId,
      reasons,
      note,
      messageIds: general ? [] : selected,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not send that report.");
    toast.success(
      !general && selected.length > 1
        ? `${selected.length} messages reported. The Yakal team will take a look.`
        : "Reported. The Yakal team will take a look."
    );
    await onDone();
    close();
  }

  async function withdraw(flag: ConversationFlag) {
    setBusy(true);
    const res = await withdrawFlag(flag.id);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not withdraw that.");
    toast.success("Report withdrawn.");
    await onDone();
    setReviewing(null);
  }

  const textOf = (flag: ConversationFlag) =>
    flag.message_id
      ? (messages.find((m) => m.id === flag.message_id)?.text ?? "That message")
      : "The conversation overall";

  // Step 2 needs something picked. Step 3 is a list, always reachable.
  const canGo = (n: Step) => (n === 2 ? picked : true);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Report a message from ${contactName}`}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl dark:bg-[#182229]"
      >
        {/* The stepper is the header. A title and a subtitle above it said
            twice what the current step already says, and pushed the messages
            themselves below the fold. */}
        <div className="flex items-center gap-3 p-5 pb-4 md:p-6 md:pb-4">
          <ol className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {STEPS.map((s, i) => (
              <li key={s.n} className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!canGo(s.n)) return;
                    setReviewing(null);
                    setStep(s.n);
                  }}
                  disabled={!canGo(s.n)}
                  aria-current={step === s.n ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg text-[13px] font-normal transition-colors",
                    step === s.n
                      ? "text-[#1099A1]"
                      : cn("text-muted-foreground", canGo(s.n) && "hover:text-[#1099A1]")
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-normal transition-colors",
                      step === s.n
                        ? "bg-[#1099A1] text-white"
                        : step > s.n && s.n !== 3
                          ? "bg-[#1099A1]/15 text-[#1099A1]"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step > s.n && s.n !== 3 ? <Check size={11} strokeWidth={3} /> : s.n}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <span className={cn("h-px w-5", step > s.n ? "bg-[#1099A1]/40" : "bg-border")} />
                )}
              </li>
            ))}
          </ol>

          <button
            onClick={close}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1 md:px-6">
          {step === 1 && (
            <div className="space-y-2 pb-2">
              {recent.length === 0 && (
                <p className="py-2 text-[13px] text-muted-foreground">
                  There are no messages in this conversation yet.
                </p>
              )}

              {/* The options are the bubbles themselves, and more than one can
                  be picked: a problem is usually a short exchange rather than
                  a single line, and filing those separately would split one
                  complaint across several rows in the admin queue. */}
              {recent.map((m) => {
                const done = alreadyReported.has(m.id);
                // Reporting the whole conversation covers every message, so
                // they all show as picked rather than the list looking empty
                // while the checkbox says otherwise.
                const on = general || selected.includes(m.id);
                const mine = m.senderId === userId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={done}
                    onClick={() => toggleMessage(m.id)}
                    aria-pressed={on}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-xl p-1.5 text-left transition-colors",
                      on
                        ? "bg-[#1099A1]/10"
                        : done
                          ? "cursor-default opacity-45"
                          : "hover:bg-muted/40",
                      mine ? "items-end" : "items-start"
                    )}
                  >
                    <span
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-[13.5px] leading-snug shadow-sm",
                        mine
                          ? "rounded-br-sm bg-[#1099A1] text-white"
                          : "rounded-bl-sm bg-white text-[#111] dark:bg-[#202c33] dark:text-white",
                        on && "ring-2 ring-[#1099A1] ring-offset-1 ring-offset-background"
                      )}
                    >
                      {m.text}
                    </span>
                    <span className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                      {on && <Check size={11} strokeWidth={3} className="text-[#1099A1]" />}
                      {mine ? "You" : contactName}
                      {" - "}
                      {m.createdAt.toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {done && " - already reported"}
                    </span>
                  </button>
                );
              })}

            </div>
          )}

          {step === 2 && (
            <div className="pb-2">
              <Label>Why? Pick as many as apply</Label>
              <div className="space-y-1.5">
                {FLAG_REASONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() =>
                      setReasons((prev) =>
                        prev.includes(r.value)
                          ? prev.filter((x) => x !== r.value)
                          : [...prev, r.value]
                      )
                    }
                    aria-pressed={reasons.includes(r.value)}
                    className={cn(
                      "w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                      reasons.includes(r.value)
                        ? "border-[#1099A1] bg-[#1099A1]/5"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <p
                      className={cn(
                        "flex items-center gap-1.5 text-[13.5px] font-semibold",
                        reasons.includes(r.value) ? "text-[#1099A1]" : "text-foreground"
                      )}
                    >
                      {reasons.includes(r.value) && <Check size={13} strokeWidth={3} />}
                      {r.label}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{r.hint}</p>
                  </button>
                ))}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Anything else the team should know (optional)"
                className="mt-3 w-full resize-none rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[#1099A1]"
              />
            </div>
          )}

          {step === 3 &&
            (reviewing ? (
              <div className="space-y-3 pb-2">
                <Field label="Reported">
                  <p className="text-[13.5px] text-foreground">{textOf(reviewing)}</p>
                </Field>
                <Field label="Reason">
                  <p className="text-[13.5px] font-semibold text-foreground">
                    {(reviewing.reasons?.length ? reviewing.reasons : [reviewing.reason])
                      .map((r) => FLAG_REASONS.find((x) => x.value === r)?.label ?? r)
                      .join(", ")}
                  </p>
                  {reviewing.note && (
                    <p className="mt-1 text-[13px] text-muted-foreground">{reviewing.note}</p>
                  )}
                </Field>
              </div>
            ) : existing.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                You have not reported anything in this conversation.
              </p>
            ) : (
              <div className="space-y-1.5 pb-2">
                {existing.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setReviewing(f)}
                    className="flex w-full items-center gap-2 rounded-xl border border-[#CAA25F]/40 bg-[#CAA25F]/5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#CAA25F]/10"
                  >
                    <Flag size={13} className="shrink-0 text-[#CAA25F]" fill="currentColor" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-foreground">{textOf(f)}</span>
                      <span className="block text-[11.5px] text-muted-foreground">
                        {(f.reasons?.length ? f.reasons : [f.reason])
                          .map((r) => FLAG_REASONS.find((x) => x.value === r)?.label ?? r)
                          .join(", ")}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
        </div>

        <div className="flex items-center gap-2 p-5 pt-4 md:p-6 md:pt-4">
          {step === 1 && (
            /* An alternative to picking messages rather than another item in
               the list, so it sits with the actions instead of pretending to
               be the last bubble. */
            <label
              className={cn(
                "flex items-center gap-2 text-[13px] transition-colors",
                generalReport
                  ? "cursor-default text-muted-foreground opacity-60"
                  : "cursor-pointer text-foreground"
              )}
            >
              <input
                type="checkbox"
                checked={general}
                disabled={!!generalReport}
                onChange={() => {
                  setGeneral((v) => !v);
                  setSelected([]);
                }}
                className="h-4 w-4 shrink-0 accent-[#1099A1]"
              />
              Whole conversation
              {generalReport && <span className="text-muted-foreground">(reported)</span>}
            </label>
          )}
          {step === 1 && !general && selected.length > 0 && (
            <p className="text-[12.5px] text-muted-foreground">{selected.length} selected</p>
          )}
          <div className="flex-1" />

          <button
            onClick={
              reviewing
                ? () => setReviewing(null)
                : step === 1
                  ? close
                  : () => setStep((step - 1) as Step)
            }
            className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
          >
            {reviewing || step > 1 ? "Back" : "Cancel"}
          </button>

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!picked}
              className="rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
            >
              Next
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => void submit()}
              disabled={busy || reasons.length === 0 || !picked}
              className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Send report
            </button>
          )}

          {step === 3 && reviewing && (
            <button
              onClick={() => void withdraw(reviewing)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-[#CAA25F] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Withdraw report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
