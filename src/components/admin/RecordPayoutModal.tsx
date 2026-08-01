import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { money } from "@/services/billingService";
import type { TutorPayout } from "@/services/adminService";
import { METHODS, recordPayout, referenceLabel, type PayoutMethod } from "@/services/payoutService";

// ============================================================
// Writing down a payment made somewhere else.
//
// For tutors who have not connected a bank. It does not move money: it records
// that somebody already did, which is why the reference is required rather
// than optional. An admin who cannot produce one has not paid anybody, and the
// form should not let them claim they have.
//
// The reference label changes with the method because every rail names its own
// differently, and "reference" alone leaves an admin guessing which number to
// copy.
// ============================================================

const today = () => new Date().toISOString().slice(0, 10);

export function RecordPayoutModal({
  payout,
  onClose,
  onSaved,
}: {
  payout: TutorPayout;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [method, setMethod] = useState<PayoutMethod>("ach");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user) return;
    if (!reference.trim()) return toast.error(`${referenceLabel(method)} is required.`);

    setBusy(true);
    const res = await recordPayout({
      tutorId: payout.tutor_id,
      invoiceId: payout.id,
      amountCents: payout.payout_cents,
      currency: payout.currency,
      method,
      reference,
      paidOn,
      note,
      adminId: user.id,
    });
    setBusy(false);

    if (!res.success) return toast.error(res.error ?? "Could not record that.");
    toast.success(`Recorded. ${payout.tutor_name} can see the reference.`);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Record a payment to ${payout.tutor_name}`}
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-medium text-foreground">Record a payment</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {payout.tutor_name} - {money(payout.payout_cents, payout.currency)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
          This does not send anything. Pay them first, then write down how, so they can check it
          against their own bank.
        </p>

        <label className="mt-5 block text-[12.5px] font-medium text-foreground">
          How did you pay them
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PayoutMethod)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] outline-none focus:border-[#1099A1]"
          >
            {METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-[12.5px] font-medium text-foreground">
          {referenceLabel(method)}
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={referenceLabel(method)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-[14px] outline-none focus:border-[#1099A1]"
          />
        </label>

        <label className="mt-4 block text-[12.5px] font-medium text-foreground">
          When the money left
          <input
            type="date"
            value={paidOn}
            max={today()}
            onChange={(e) => setPaidOn(e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] outline-none focus:border-[#1099A1]"
          />
        </label>

        <label className="mt-4 block text-[12.5px] font-medium text-foreground">
          Note, if any
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px] outline-none focus:border-[#1099A1]"
          />
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={busy || !reference.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Record it
          </button>
        </div>
      </div>
    </div>
  );
}
