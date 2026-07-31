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
// Reporting a message to the Yakal team.
//
// The message is chosen here rather than from a flag icon on each bubble. A
// transcript is read far more often than it is reported, so the reading view
// stays clean and the picking happens once, inside the report.
//
// Two steps, and neither is skippable: which message, then why. Reporting
// somebody is not a thing to do by accident, and an unexplained flag on an
// unnamed message tells an admin only that somebody was unhappy.
// ============================================================

/** The most recent messages, newest first. Older ones are rarely the subject. */
const PICKABLE = 20;

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
  /** The conversation history, for choosing which message to report. */
  messages: ChatMessage[];
  /** This reporter's own open reports on this conversation. */
  existing: ConversationFlag[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [messageId, setMessageId] = useState<string | null>(null);
  const [general, setGeneral] = useState(false);
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<ConversationFlag | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

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
    setMessageId(null);
    setGeneral(false);
    setReason(null);
    setNote("");
    setReviewing(null);
    setStep(1);
  }

  function close() {
    reset();
    onClose();
  }

  const picked = general || !!messageId;

  async function submit() {
    if (!reason || !picked) return;
    setBusy(true);
    const res = await flagConversation({
      conversationId,
      userId,
      reason,
      note,
      messageId: general ? null : messageId,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not send that report.");
    toast.success("Reported. The Yakal team will take a look.");
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
    close();
  }

  const reportedText = (flag: ConversationFlag) =>
    flag.message_id
      ? (messages.find((m) => m.id === flag.message_id)?.text ?? "That message")
      : "The conversation overall";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl dark:bg-[#182229]"
      >
        <div className="p-5 pb-4 md:p-6 md:pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Flag size={20} className="mt-0.5 shrink-0 text-[#CAA25F]" />
              <div>
                <h2 className="text-[17px] font-bold text-foreground">
                  {reviewing ? "Your report" : "Report a message"}
                </h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {reviewing
                    ? "The Yakal team has this. You can withdraw it if you no longer need it."
                    : step === 1
                      ? `Pick the message from ${contactName} that concerns you.`
                      : "Tell us what the problem is."}
                </p>
              </div>
            </div>
            <button
              onClick={close}
              aria-label="Close"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
            >
              <X size={18} />
            </button>
          </div>

          {/* Two steps, shown rather than implied. Picking a message and
              saying what is wrong with it are different questions, and putting
              both on one screen made a long scroll of radio buttons. */}
          {!reviewing && (
            <ol className="mt-4 flex items-center gap-2">
              {[
                { n: 1 as const, label: "Message" },
                { n: 2 as const, label: "Reason" },
              ].map((s2, i) => (
                <li key={s2.n} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => s2.n === 1 && setStep(1)}
                    disabled={s2.n === 2}
                    aria-current={step === s2.n ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-1 py-0.5 text-[12.5px] font-semibold transition-colors",
                      step === s2.n
                        ? "text-[#1099A1]"
                        : step > s2.n
                          ? "text-foreground hover:text-[#1099A1]"
                          : "text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                        step === s2.n
                          ? "bg-[#1099A1] text-white"
                          : step > s2.n
                            ? "bg-[#1099A1]/15 text-[#1099A1]"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {step > s2.n ? <Check size={11} strokeWidth={3} /> : s2.n}
                    </span>
                    {s2.label}
                  </button>
                  {i === 0 && (
                    <span
                      className={cn(
                        "h-px flex-1 transition-colors",
                        step > 1 ? "bg-[#1099A1]/40" : "bg-border"
                      )}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1 md:px-6">
          {reviewing ? (
            <div className="space-y-4">
              <Field label="Reported message">
                <p className="text-[13.5px] text-foreground">{reportedText(reviewing)}</p>
              </Field>
              <Field label="Reason">
                <p className="text-[13.5px] font-semibold text-foreground">
                  {FLAG_REASONS.find((r) => r.value === reviewing.reason)?.label ?? reviewing.reason}
                </p>
                {reviewing.note && (
                  <p className="mt-1 text-[13px] text-muted-foreground">{reviewing.note}</p>
                )}
              </Field>
            </div>
          ) : (
            <>
              {existing.length > 0 && (
                <div className="mb-5">
                  <Label>Already reported</Label>
                  <div className="space-y-1.5">
                    {existing.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setReviewing(f)}
                        className="flex w-full items-center gap-2 rounded-xl border border-[#CAA25F]/40 bg-[#CAA25F]/5 px-3.5 py-2.5 text-left transition-colors hover:bg-[#CAA25F]/10"
                      >
                        <Flag size={13} className="shrink-0 text-[#CAA25F]" fill="currentColor" />
                        <span className="truncate text-[13px] text-foreground">
                          {reportedText(f)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 ? (
                <div className="space-y-2 pb-2">
                  {recent.length === 0 && (
                    <p className="py-2 text-[13px] text-muted-foreground">
                      There are no messages in this conversation yet.
                    </p>
                  )}

                  {/* The options are the bubbles themselves. A report is about
                      a specific thing somebody said, and stripping it to a row
                      of plain text made it hard to be sure you had the right
                      one. */}
                  {recent.map((m) => {
                    const done = alreadyReported.has(m.id);
                    const on = messageId === m.id;
                    const mine = m.senderId === userId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={done}
                        onClick={() => {
                          setMessageId(m.id);
                          setGeneral(false);
                        }}
                        aria-pressed={on}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-xl p-1.5 text-left transition-colors",
                          on ? "bg-[#1099A1]/10" : done ? "cursor-default opacity-45" : "hover:bg-muted/40",
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
                        <span className="px-1 text-[11px] text-muted-foreground">
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

                  {/* Not every concern is about one message. Repeated
                      cancellations are a pattern, and forcing a choice would
                      only produce an arbitrary one. */}
                  <button
                    type="button"
                    disabled={!!generalReport}
                    onClick={() => {
                      setGeneral(true);
                      setMessageId(null);
                    }}
                    aria-pressed={general}
                    className={cn(
                      "mt-1 flex w-full items-center gap-2.5 rounded-xl border border-dashed px-3.5 py-2.5 text-left transition-colors",
                      general
                        ? "border-[#1099A1] bg-[#1099A1]/5"
                        : generalReport
                          ? "cursor-default border-border opacity-50"
                          : "border-border hover:bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                        general ? "border-[#1099A1] bg-[#1099A1] text-white" : "border-[#c2c7d0]"
                      )}
                    >
                      {general && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span className="text-[13.5px] text-foreground">
                      Not one message, a concern about the conversation
                      {generalReport && (
                        <span className="text-muted-foreground"> - already reported</span>
                      )}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="pb-2">
                  {/* What is being reported, kept in view so the reason is
                      chosen against it rather than from memory. */}
                  <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3">
                    <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      Reporting
                    </p>
                    <p className="line-clamp-3 text-[13px] text-foreground">
                      {general
                        ? "The conversation overall"
                        : (recent.find((m) => m.id === messageId)?.text ?? "")}
                    </p>
                  </div>

                  <Label>Why?</Label>
                  <div className="space-y-1.5">
                    {FLAG_REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setReason(r.value)}
                        className={cn(
                          "w-full rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                          reason === r.value
                            ? "border-[#1099A1] bg-[#1099A1]/5"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <p
                          className={cn(
                            "text-[13.5px] font-semibold",
                            reason === r.value ? "text-[#1099A1]" : "text-foreground"
                          )}
                        >
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
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 p-5 pt-4 md:p-6 md:pt-4">
          <button
            onClick={reviewing ? () => setReviewing(null) : step === 2 ? () => setStep(1) : close}
            className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
          >
            {reviewing || step === 2 ? "Back" : "Cancel"}
          </button>
          {reviewing ? (
            <button
              onClick={() => void withdraw(reviewing)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-[#CAA25F] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Withdraw report
            </button>
          ) : step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!picked}
              className="rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => void submit()}
              disabled={busy || !reason || !picked}
              className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Send report
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
