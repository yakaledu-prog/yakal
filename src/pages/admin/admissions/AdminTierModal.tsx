import { useState } from "react";
import { toast } from "sonner";
import { Loader2, X, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/utils/cn";
import type { AdmissionsTier, TierInput } from "@/services/admissionsService";

interface Props {
  onClose: () => void;
  initialData: AdmissionsTier | null;
  /** Highest existing sort_order, so a new tier lands at the end of the list. */
  nextSortOrder: number;
  onSubmit: (input: TierInput & { key?: string }) => Promise<void>;
  isSubmitting?: boolean;
}

// The quota fields are the one place blank has a meaning: it is "no ceiling",
// which the database stores as NULL. So they live as strings and only become
// numbers on save, and "" survives the round trip as null rather than 0.
type FormState = {
  name: string;
  blurb: string;
  fits: string;
  priceDollars: string;
  instalmentMonths: string;
  psRoundsLimit: string;
  suppEssaysLimit: string;
  mockInterviewsLimit: string;
  sessionsPerMonth: string;
  features: string[];
  isRecommended: boolean;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  blurb: "",
  fits: "",
  priceDollars: "",
  instalmentMonths: "1",
  psRoundsLimit: "",
  suppEssaysLimit: "",
  mockInterviewsLimit: "",
  sessionsPerMonth: "",
  features: [""],
  isRecommended: false,
  isActive: true,
};

/** What the tier is, what it costs, what it includes. */
const STEPS = ["Content", "Pricing", "Includes", "Visibility"] as const;

const centsToDollars = (c: number) => (c / 100).toString();
const quotaToStr = (n: number | null) => (n == null ? "" : String(n));
/**
 * "" is unlimited (NULL). Any number, including 0, is a real ceiling.
 *
 * Anything else is `undefined`, which the caller refuses. It used to return
 * null for unreadable input too, so a typo in a quota on a paid tier silently
 * granted unlimited: blank and wrong meant the same thing, and only one of
 * them was intended.
 */
const strToQuota = (s: string): number | null | undefined => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
};

/**
 * Initial form state, computed once from props. The modal is mounted fresh for
 * each edit (the parent gives it a changing key), so there is no effect syncing
 * props into state, and no cascading render from doing so.
 */
function initForm(tier: AdmissionsTier | null): FormState {
  if (!tier) return { ...EMPTY };
  return {
    name: tier.name,
    blurb: tier.blurb ?? "",
    fits: tier.fits ?? "",
    priceDollars: centsToDollars(tier.priceCents),
    instalmentMonths: String(tier.instalmentMonths),
    psRoundsLimit: quotaToStr(tier.psRoundsLimit),
    suppEssaysLimit: quotaToStr(tier.suppEssaysLimit),
    mockInterviewsLimit: quotaToStr(tier.mockInterviewsLimit),
    sessionsPerMonth: quotaToStr(tier.sessionsPerMonth),
    features: tier.features.length ? [...tier.features] : [""],
    isRecommended: tier.isRecommended,
    isActive: tier.isActive,
  };
}

export function AdminTierModal({
  onClose,
  initialData,
  nextSortOrder,
  onSubmit,
  isSubmitting,
}: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(initialData));
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const isEdit = !!initialData;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setFeature = (i: number, v: string) =>
    setForm((f) => ({ ...f, features: f.features.map((x, j) => (j === i ? v : x)) }));
  const addFeature = () => setForm((f) => ({ ...f, features: [...f.features, ""] }));
  const removeFeature = (i: number) =>
    setForm((f) => ({ ...f, features: f.features.filter((_, j) => j !== i) }));

  /** Which step a field belongs to, so a failure can open the right one. */
  const STEP_OF: Record<string, 1 | 2 | 3 | 4> = {
    name: 1, blurb: 1, fits: 1,
    price: 2, months: 2,
    quota: 3, features: 3,
  };

  const fail = (field: keyof typeof STEP_OF, message: string) => {
    setStep(STEP_OF[field]);
    toast.error(message);
    return null;
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) return fail("name", "A tier needs a name.");

    const price = parseFloat(form.priceDollars);
    if (!Number.isFinite(price) || price < 0) return fail("price", "Enter a valid price.");

    const months = parseInt(form.instalmentMonths, 10);
    if (!Number.isFinite(months) || months < 1 || months > 24) {
      return fail("months", "Monthly payments must be between 1 and 24.");
    }

    // Blank is unlimited and 0 is none, but anything unreadable is a typo, and
    // a typo must not quietly become the most generous option on a paid tier.
    const quotas = {
      psRoundsLimit: strToQuota(form.psRoundsLimit),
      suppEssaysLimit: strToQuota(form.suppEssaysLimit),
      mockInterviewsLimit: strToQuota(form.mockInterviewsLimit),
      sessionsPerMonth: strToQuota(form.sessionsPerMonth),
    };
    const bad = Object.entries(quotas).find(([, v]) => v === undefined);
    if (bad) {
      return fail("quota", "A quota must be a whole number, or blank for unlimited.");
    }

    const features = form.features.map((f) => f.trim()).filter(Boolean);

    const input: TierInput = {
      name,
      blurb: form.blurb.trim() || null,
      fits: form.fits.trim() || null,
      priceCents: Math.round(price * 100),
      instalmentMonths: months,
      psRoundsLimit: quotas.psRoundsLimit as number | null,
      suppEssaysLimit: quotas.suppEssaysLimit as number | null,
      mockInterviewsLimit: quotas.mockInterviewsLimit as number | null,
      sessionsPerMonth: quotas.sessionsPerMonth as number | null,
      features,
      isRecommended: form.isRecommended,
      isActive: form.isActive,
      // Ordering is done with the arrows on the list, where the tiers are
      // visible side by side, rather than by typing a number in here.
      sortOrder: initialData?.sortOrder ?? nextSortOrder,
    };

    await onSubmit(input);
  };

  const labelCls = "block text-[13px] font-medium text-[#111] dark:text-white mb-1.5";
  // The tokens the rest of the admin uses. This was raw tailwind greys with
  // !important overrides, which looked right in isolation and slightly wrong
  // beside every other dialog.
  const inputCls = "bg-transparent border !border-[#e9edef] dark:!border-[#2a3942]";
  const areaCls =
    "w-full rounded-md border border-[#e9edef] dark:border-[#2a3942] bg-transparent px-3 py-2 text-sm text-[#111] dark:text-white outline-none transition-colors focus:border-[#1099A1]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* The stepper is the heading. A title saying "Edit Premier" above a
            step called Content repeated what the list already said to open it. */}
        <div className="flex items-start justify-between gap-4 border-b border-[#e9edef] px-6 pt-4 shrink-0 dark:border-[#2a3942]">
          <div className="flex gap-1">
            {STEPS.map((name, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4;
              const active = step === n;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setStep(n)}
                  className={cn(
                    "flex items-center gap-2 border-b-2 px-1 pb-3 pr-5 text-[13.5px] transition-colors",
                    active
                      ? "border-[#1099A1] text-[#111] dark:text-white"
                      : "border-transparent text-muted-foreground hover:text-[#111] dark:hover:text-white"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                      active ? "bg-[#1099A1] text-white" : "bg-[#e9edef] text-muted-foreground dark:bg-[#2a3942]"
                    )}
                  >
                    {n}
                  </span>
                  {name}
                </button>
              );
            })}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-2 transition-colors hover:bg-[#f0f2f5] dark:hover:bg-[#182329]"
          >
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          {step === 1 && (
            <section className="space-y-4">

              {/* No key field. The column is NOT NULL so a row needs one, but
                nothing in the app reads it (plans point at id), so it is
                generated from the name rather than invented by hand. */}
              <div>
                <label className={labelCls}>Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Premier"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Short description</label>
                <textarea
                  value={form.blurb}
                  onChange={(e) => set("blurb", e.target.value)}
                  rows={2}
                  placeholder="One or two sentences, shown under the name on the card."
                  className={areaCls}
                />
              </div>

              <div>
                <label className={labelCls}>
                  Who it suits <span className="font-normal text-muted-foreground">(the box at the bottom of the card)</span>
                </label>
                <textarea
                  value={form.fits}
                  onChange={(e) => set("fits", e.target.value)}
                  rows={2}
                  placeholder="Families wanting ongoing mentorship, not just checkpoints."
                  className={areaCls}
                />
              </div>
            </section>
          )}

          {step === 2 && (

            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelCls}>Total price (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[14px]">$</span>
                    <Input
                      value={form.priceDollars}
                      onChange={(e) => set("priceDollars", e.target.value)}
                      placeholder="2500.00"
                      inputMode="decimal"
                      className={cn(inputCls, "pl-7")}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Monthly payments</label>
                  <Input
                    value={form.instalmentMonths}
                    onChange={(e) => set("instalmentMonths", e.target.value)}
                    placeholder="10"
                    inputMode="numeric"
                    className={inputCls}
                  />
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    1 is a single payment. Otherwise the total is split over this many months.
                  </p>
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <>
              <section className="space-y-3">
                <h3 className="sr-only">
                  What is included
                </h3>
                <p className="text-[12px] text-muted-foreground -mt-1">
                  The bullet list on the card, in order.
                </p>
                <div className="space-y-2">
                  {form.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={f}
                        onChange={(e) => setFeature(i, e.target.value)}
                        placeholder="Two advising sessions per month"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => removeFeature(i)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={addFeature} className="gap-2 h-9">
                  <Plus size={15} /> Add line
                </Button>
              </section>


              <section className="space-y-4">
                <p className="text-[12px] text-muted-foreground -mt-1">
                  Leave blank for unlimited. These are shown to families, not enforced, except advising
                  sessions per month, which the counselor calendar does enforce. For mock interviews, 0
                  means the tier includes none.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className={labelCls}>Advising / month</label>
                    <Input
                      value={form.sessionsPerMonth}
                      onChange={(e) => set("sessionsPerMonth", e.target.value)}
                      placeholder="unlimited"
                      inputMode="numeric"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>PS rounds</label>
                    <Input
                      value={form.psRoundsLimit}
                      onChange={(e) => set("psRoundsLimit", e.target.value)}
                      placeholder="unlimited"
                      inputMode="numeric"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Supp. essays</label>
                    <Input
                      value={form.suppEssaysLimit}
                      onChange={(e) => set("suppEssaysLimit", e.target.value)}
                      placeholder="unlimited"
                      inputMode="numeric"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Mock interviews</label>
                    <Input
                      value={form.mockInterviewsLimit}
                      onChange={(e) => set("mockInterviewsLimit", e.target.value)}
                      placeholder="unlimited"
                      inputMode="numeric"
                      className={inputCls}
                    />
                  </div>
                </div>
              </section>
            </>
          )}

          {step === 4 && (
            <section className="space-y-4">
              {/* Stacked, not side by side. These are two independent switches
                and a row of two reads as one choice with two halves. */}
              <div className="grid grid-cols-1 gap-4">
                <ToggleRow
                  label="Recommended"
                  hint="Marks the card Most chosen and highlights it."
                  value={form.isRecommended}
                  onChange={(v) => set("isRecommended", v)}
                />
                <ToggleRow
                  label="Active"
                  hint="Off hides it from families but keeps existing plans."
                  value={form.isActive}
                  onChange={(v) => set("isActive", v)}
                />
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e9edef] dark:border-[#2a3942] flex justify-between shrink-0">
          {/* Back rather than Cancel. The X closes it, and a Cancel beside a
              Next is two ways out and no way back. Invisible on the first
              step so the footer does not shift when it appears. */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : 1))}
            disabled={step === 1}
            className={cn(
              "!border !border-[#e9edef] dark:!border-[#2a3942] !bg-transparent",
              step === 1 && "invisible"
            )}
          >
            Back
          </Button>
          {/* One primary button that changes what it does, rather than Next
              beside Save. Two buttons of similar weight next to each other
              make somebody choose before they know the difference.

              An edit skips the walk: it opens on whichever step you want and
              saves from there, because an edit is usually one field. */}
          {step < 4 && !isEdit ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
              className="gap-2 min-w-[140px]"
            >
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="gap-2 min-w-[140px]">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={15} />}
              {isEdit ? "Save changes" : "Create tier"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-[#e9edef] dark:border-[#2a3942] p-3.5">
      <div>
        <p className="text-[14px] font-medium text-[#111] dark:text-white">{label}</p>
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          "w-10 h-5 rounded-full relative transition-colors shrink-0 mt-0.5",
          value ? "bg-[#1099A1]" : "bg-gray-300 dark:bg-gray-700"
        )}
        title={value ? `Turn off ${label.toLowerCase()}` : `Turn on ${label.toLowerCase()}`}
      >
        <div
          className={cn(
            "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
            value ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}
