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
  key: string;
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
  sortOrder: string;
};

const EMPTY: FormState = {
  key: "",
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
  sortOrder: "0",
};

const centsToDollars = (c: number) => (c / 100).toString();
const quotaToStr = (n: number | null) => (n == null ? "" : String(n));
/** "" is unlimited (NULL). Any number, including 0, is a real ceiling. */
const strToQuota = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

/**
 * Initial form state, computed once from props. The modal is mounted fresh for
 * each edit (the parent gives it a changing key), so there is no effect syncing
 * props into state, and no cascading render from doing so.
 */
function initForm(tier: AdmissionsTier | null, nextSortOrder: number): FormState {
  if (!tier) return { ...EMPTY, sortOrder: String(nextSortOrder) };
  return {
    key: tier.key,
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
    sortOrder: String(tier.sortOrder),
  };
}

export function AdminTierModal({
  onClose,
  initialData,
  nextSortOrder,
  onSubmit,
  isSubmitting,
}: Props) {
  const [form, setForm] = useState<FormState>(() => initForm(initialData, nextSortOrder));
  const isEdit = !!initialData;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setFeature = (i: number, v: string) =>
    setForm((f) => ({ ...f, features: f.features.map((x, j) => (j === i ? v : x)) }));
  const addFeature = () => setForm((f) => ({ ...f, features: [...f.features, ""] }));
  const removeFeature = (i: number) =>
    setForm((f) => ({ ...f, features: f.features.filter((_, j) => j !== i) }));

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) return toast.error("A tier needs a name.");

    const price = parseFloat(form.priceDollars);
    if (!Number.isFinite(price) || price < 0) return toast.error("Enter a valid price.");

    const months = parseInt(form.instalmentMonths, 10);
    if (!Number.isFinite(months) || months < 1 || months > 24) {
      return toast.error("Monthly payments must be between 1 and 24.");
    }

    if (!isEdit) {
      // The key is the stable handle plans and invoices point at, so it is
      // set once and only accepts a-z, 0-9 and dashes.
      const key = form.key.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(key)) {
        return toast.error("Key can only use lowercase letters, numbers and dashes.");
      }
    }

    const features = form.features.map((f) => f.trim()).filter(Boolean);

    const input: TierInput & { key?: string } = {
      name,
      blurb: form.blurb.trim() || null,
      fits: form.fits.trim() || null,
      priceCents: Math.round(price * 100),
      instalmentMonths: months,
      psRoundsLimit: strToQuota(form.psRoundsLimit),
      suppEssaysLimit: strToQuota(form.suppEssaysLimit),
      mockInterviewsLimit: strToQuota(form.mockInterviewsLimit),
      sessionsPerMonth: strToQuota(form.sessionsPerMonth),
      features,
      isRecommended: form.isRecommended,
      isActive: form.isActive,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
      ...(isEdit ? {} : { key: form.key.trim().toLowerCase() }),
    };

    await onSubmit(input);
  };

  const labelCls = "block text-[13px] font-medium text-[#111] dark:text-white mb-1.5";
  const inputCls =
    "bg-gray-50 dark:bg-[#182329] border !border-gray-300 dark:!border-gray-700 focus:bg-white";
  const areaCls =
    "w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#182329] px-3 py-2 text-sm text-[#111] dark:text-white outline-none focus:bg-white focus:ring-2 focus:ring-[#1099A1]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111b21] w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-[#111] dark:text-white">
            {isEdit ? `Edit ${initialData!.name}` : "New counseling tier"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#182329] transition-colors"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
          {/* Content */}
          <section className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#1099A1]">Content</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className={labelCls}>
                  Key {isEdit && <span className="text-muted-foreground font-normal">(fixed)</span>}
                </label>
                <Input
                  value={form.key}
                  onChange={(e) => set("key", e.target.value)}
                  placeholder="premier"
                  disabled={isEdit}
                  className={cn(inputCls, isEdit && "opacity-60 cursor-not-allowed")}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Blurb</label>
              <textarea
                value={form.blurb}
                onChange={(e) => set("blurb", e.target.value)}
                rows={2}
                placeholder="One or two sentences shown under the name."
                className={areaCls}
              />
            </div>

            <div>
              <label className={labelCls}>
                Fits <span className="text-muted-foreground font-normal">(the grey box at the bottom of the card)</span>
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

          {/* Pricing */}
          <section className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#1099A1]">Pricing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* What's included */}
          <section className="space-y-3">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#1099A1]">
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

          {/* Quotas */}
          <section className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#1099A1]">Quotas</h3>
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

          {/* Visibility */}
          <section className="space-y-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#1099A1]">Visibility</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="w-32">
              <label className={labelCls}>Sort order</label>
              <Input
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", e.target.value)}
                inputMode="numeric"
                className={inputCls}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e9edef] dark:border-[#2a3942] flex justify-between shrink-0 bg-gray-50 dark:bg-[#182329]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="!border !border-gray-300 dark:!border-gray-700 !bg-transparent"
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting} className="gap-2 min-w-[140px]">
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? "Save changes" : "Create tier"}
          </Button>
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
