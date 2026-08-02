import { useEffect, useMemo, useState } from "react";
import { Check, Flag, Loader2, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";
import type { ChatMessage } from "@/services/messageService";
import { useChatSurface } from "./ChatBody";
import {
  FLAG_REASONS,
  flagConversation,
  withdrawFlag,
  type ConversationFlag,
  type FlagReason,
  type MessageReport,
  describeReport,
  reasonsFor,
} from "@/services/reports";

// ============================================================
// Reporting messages to the Yakal team.
//
// Two steps: which messages, then why. There used to be a third listing what
// you had already sent, which was a page of its own for something better said
// on the message it was about, so withdrawing now lives there instead.
//
// The scan fills both steps in before the dialog opens. What is left is
// reading it and agreeing, and the stepper is what keeps that from arriving as
// one long wall.
//
// The transcript is drawn as a transcript: sides and colours as in the chat
// itself, because a parent picking messages out of an exchange has to be able
// to see at a glance who said what. Whose messages sit on the right is given
// rather than assumed - a parent watching their child is a third party to the
// conversation, and "mine against theirs" puts every message on one side and
// labels the child's own words with the tutor's name.
// ============================================================

/** The most recent messages, newest first. Older ones are rarely the subject. */
const PICKABLE = 20;

type Step = 1 | 2;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Messages" },
  { n: 2, label: "Reason" },
];

export function FlagConversationDialog({
  open,
  contactName,
  conversationId,
  userId,
  subjectId,
  subjectName = "You",
  subjectAvatarUrl,
  contactAvatarUrl,
  messages,
  existing,
  reports,
  onClose,
  onDone,
}: {
  open: boolean;
  /** The other party in the conversation. */
  contactName: string;
  conversationId: string;
  /** Who is filing this report. */
  userId: string;
  /**
   * Whose messages sit on the right. The reporter's own id in a conversation
   * they are part of; the child's id when a parent is watching one they are
   * not. Defaults to the reporter.
   */
  subjectId?: string;
  /** What to call that side. "You" reads wrong when it is somebody's child. */
  subjectName?: string;
  /** Faces for the two sides. Falls back to the generated avatar by name. */
  subjectAvatarUrl?: string | null;
  contactAvatarUrl?: string | null;
  /** The conversation history, for choosing which messages to report. */
  messages: ChatMessage[];
  /** This reporter's own open reports on this conversation. */
  existing: ConversationFlag[];
  /**
   * What the scan picked out, keyed by message id. Given, those messages start
   * picked and the reasons start filled in: somebody who has been told there
   * is something to look at should not then have to find it themselves.
   */
  reports?: Map<string, MessageReport>;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [general, setGeneral] = useState(false);
  const [reasons, setReasons] = useState<FlagReason[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>(1);

  const rightHandId = subjectId ?? userId;
  // The same mint and dots as the conversation this was opened from, so the
  // messages read as the transcript they are rather than as form controls.
  const chatSurface = useChatSurface();

  const recent = useMemo(
    () => messages.filter((m) => !m.pending && m.text).slice(-PICKABLE).reverse(),
    [messages]
  );

  const flagByMessage = useMemo(
    () => new Map(existing.filter((f) => f.message_id).map((f) => [f.message_id!, f])),
    [existing]
  );
  const generalReport = existing.find((f) => !f.message_id) ?? null;

  // What the scan caught, still unreported and still in the pickable window.
  const scanned = useMemo(
    () =>
      reports
        ? recent.filter((m) => reports.has(m.id) && !flagByMessage.has(m.id)).map((m) => m.id)
        : [],
    [reports, recent, flagByMessage]
  );

  // Opening the dialog fills the form in. It can still be added to or taken
  // apart before sending; it just does not start from nothing.
  useEffect(() => {
    if (!open || scanned.length === 0) return;
    setSelected((current) => (current.length > 0 ? current : scanned));
    setReasons((current) => (current.length > 0 ? current : reasonsFor(scanned, reports!)));
  }, [open, scanned, reports]);

  if (!open) return null;

  function reset() {
    setSelected([]);
    setGeneral(false);
    setReasons([]);
    setNote("");
    setStep(1);
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
  }

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
                    if (s.n === 2 && !picked) return;
                    setStep(s.n);
                  }}
                  disabled={s.n === 2 && !picked}
                  aria-current={step === s.n ? "step" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg text-[13px] font-normal transition-colors",
                    step === s.n
                      ? "text-[#1099A1]"
                      : cn(
                        "text-muted-foreground",
                        (s.n === 1 || picked) && "hover:text-[#1099A1]"
                      )
                  )}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-normal transition-colors",
                      step === s.n
                        ? "bg-[#1099A1] text-white"
                        : step > s.n
                          ? "bg-[#1099A1]/15 text-[#1099A1]"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {step > s.n ? <Check size={11} strokeWidth={3} /> : s.n}
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

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-1 md:px-6"
          style={step === 1 ? chatSurface : undefined}
        >
          {step === 1 && (
            <div className="space-y-2 py-3">
              {recent.length === 0 && (
                <p className="py-2 text-[13px] text-[#667781] dark:text-[#8696a0]">
                  There are no messages in this conversation yet.
                </p>
              )}

              {/* The options are the bubbles themselves, and more than one can
                  be picked: a problem is usually a short exchange rather than a
                  single line, and filing those separately would split one
                  complaint across several rows in the admin queue. */}
              {recent.map((m) => {
                const done = flagByMessage.get(m.id);
                // Reporting the whole conversation covers every message, so
                // they all show as picked rather than the list looking empty
                // while the checkbox says otherwise.
                const on = general || selected.includes(m.id);
                const onRight = m.senderId === rightHandId;
                const caught = reports?.get(m.id);

                const bubble = (
                  <span
                    className={cn(
                      "relative block max-w-full rounded-xl px-3 pb-5 pt-2 text-[13.5px] leading-snug shadow-sm",
                      onRight
                        ? "rounded-br-sm bg-[#1099A1] text-white"
                        : "rounded-bl-sm bg-white text-[#111] dark:bg-[#202c33] dark:text-white",
                      // Gold marks what the scan found, teal marks what is
                      // going in the report. A caught message keeps the gold:
                      // it is the reason the dialog is open, and the tint
                      // behind it already says it is picked.
                      caught
                        ? "ring-2 ring-[#CAA25F]"
                        : on && "ring-2 ring-[#1099A1] ring-offset-1 ring-offset-background"
                    )}
                  >
                    {caught && !done && (
                      // Why the system picked this one, said plainly: somebody
                      // about to put their name to a report is entitled to know
                      // what they are agreeing with.
                      <span className="mb-1 flex items-center gap-1.5 text-[11px] text-[#CAA25F]">
                        <Flag size={10} fill="currentColor" />
                        {describeReport(caught)}
                      </span>
                    )}

                    {m.text}

                    <span
                      className={cn(
                        "absolute bottom-1 right-2.5 text-[10px]",
                        onRight ? "text-white/70" : "text-[#667781] dark:text-[#8696a0]"
                      )}
                    >
                      {done ? "Reported" : m.createdAt.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                );

                const avatar = (
                  <img
                    src={
                      (onRight ? subjectAvatarUrl : contactAvatarUrl) ??
                      dicebearUrl(onRight ? subjectName : contactName)
                    }
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                );

                return (
                  <div
                    key={m.id}
                    className={cn(
                      // Picked is the whole row lighting up rather than a tick
                      // off to one side. What is going in the report should be
                      // readable by glancing down the list, and a small mark
                      // at the end of a line is not.
                      "flex items-end gap-2 rounded-2xl p-1.5 transition-colors",
                      onRight ? "flex-row-reverse" : "flex-row",
                      on && "bg-[#1099A1]/15"
                    )}
                  >
                    {avatar}

                    {/* A reported message is not a button. It cannot be picked
                        again, and it has to hold a Withdraw control, which
                        cannot be nested inside another button. */}
                    {done ? (
                      <span className="flex min-w-0 max-w-[78%] items-end gap-1 opacity-60">
                        {bubble}
                        <button
                          type="button"
                          onClick={() => void withdraw(done)}
                          disabled={busy}
                          title="Withdraw this report"
                          aria-label="Withdraw this report"
                          className="shrink-0 rounded-full p-1.5 text-[#CAA25F] transition-colors hover:bg-[#CAA25F]/15 disabled:opacity-50"
                        >
                          <Undo2 size={14} />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleMessage(m.id)}
                        aria-pressed={on}
                        aria-label={`${m.text.slice(0, 60)} - from ${onRight ? subjectName : contactName}`}
                        className="flex min-w-0 max-w-[78%] rounded-xl text-left" 
                      >
                        {bubble}
                      </button>
                    )}

                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="pb-2">
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
            onClick={step === 1 ? close : () => setStep(1)}
            className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step === 1 ? (
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
              disabled={busy || reasons.length === 0 || !picked}
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
