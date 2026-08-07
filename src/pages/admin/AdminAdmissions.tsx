import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Check, Star, EyeOff } from "lucide-react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { AdminHeader } from "./AdminHeader";
import { AdminTierModal } from "./admissions/AdminTierModal";
import { money } from "@/services/billingService";
import {
  getAllTiers,
  monthlyCents,
  updateTier,
  createTier,
  setTierFlag,
  type AdmissionsTier,
  type TierInput,
} from "@/services/admissionsService";

// ============================================================
// Admin editor for the college-counseling tiers.
//
// These are the same rows the public page and the parent checkout read, so
// invalidating both query keys after a write keeps the marketing card, the
// parent dashboard and this list from ever disagreeing about a price.
//
// There is no delete. A tier a family is on cannot be removed without orphaning
// their plan and their invoices, so hiding it (Active off) is the only safe
// retirement, and it is what the row toggle does.
// ============================================================

const quota = (n: number | null) => (n == null ? "Unlimited" : String(n));

export function AdminAdmissions() {
  const qc = useQueryClient();
  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ["admin-admissions-tiers"],
    queryFn: getAllTiers,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdmissionsTier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextSortOrder = tiers.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1;
  const activeCount = tiers.filter((t) => t.isActive).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-admissions-tiers"] });
    // The public marketing page and the parent dashboard both read this key.
    qc.invalidateQueries({ queryKey: ["admissions-tiers"] });
  };

  const openCreate = () => {
    setEditing(null);
    setIsModalOpen(true);
  };
  const openEdit = (t: AdmissionsTier) => {
    setEditing(t);
    setIsModalOpen(true);
  };

  const handleSubmit = async (input: TierInput & { key?: string }) => {
    setIsSubmitting(true);
    try {
      const res = editing
        ? await updateTier(editing.id, input)
        : await createTier(input as TierInput & { key: string });
      if (!res.success) {
        toast.error(res.error || "Could not save the tier.");
        return;
      }
      toast.success(editing ? "Tier updated." : "Tier created.");
      refresh();
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggle = async (t: AdmissionsTier, patch: { isActive?: boolean; isRecommended?: boolean }) => {
    const res = await setTierFlag(t.id, patch);
    if (!res.success) return toast.error(res.error || "Could not update.");
    refresh();
  };

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <AdminHeader
          title="Admissions"
          subtitle="College counseling tiers families see and buy"
          stats={[
            { label: "Tiers", value: tiers.length },
            { label: "Active", value: activeCount },
          ]}
        />

        <div className="max-w-[1100px] mx-auto p-6 md:p-10">
          <div className="flex justify-between items-center gap-4 mb-8">
            <p className="text-[13px] text-muted-foreground">
              Editing a tier changes the public page and the parent checkout together.
            </p>
            <Button onClick={openCreate} className="gap-2 shrink-0">
              <Plus size={16} /> New tier
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : tiers.length === 0 ? (
            <p className="text-center py-16 text-[14px] text-muted-foreground">
              No tiers yet. Create the first one.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {tiers.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "bg-white dark:bg-[#111b21] rounded-2xl border p-6 md:p-7 transition-colors",
                    t.isRecommended ? "border-[#1099A1]" : "border-[#e9edef] dark:border-[#2a3942]",
                    !t.isActive && "opacity-60"
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                    {/* Left: identity + price */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-[20px] font-bold text-[#111] dark:text-white">{t.name}</h3>
                        {t.isRecommended && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#1099A1]">
                            <Star size={12} className="fill-[#1099A1]" /> Most chosen
                          </span>
                        )}
                        {!t.isActive && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                            <EyeOff size={12} /> Hidden
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] text-muted-foreground font-mono">{t.key}</p>

                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-[24px] font-bold text-[#111] dark:text-white">
                          {money(t.priceCents)}
                        </span>
                        {t.instalmentMonths > 1 && (
                          <span className="text-[13px] text-muted-foreground">
                            = {money(monthlyCents(t))}/mo over {t.instalmentMonths} months
                          </span>
                        )}
                      </div>

                      {t.blurb && (
                        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground max-w-xl">
                          {t.blurb}
                        </p>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <ToggleChip
                        label="Recommended"
                        active={t.isRecommended}
                        onClick={() => toggle(t, { isRecommended: !t.isRecommended })}
                      />
                      <ToggleChip
                        label={t.isActive ? "Active" : "Hidden"}
                        active={t.isActive}
                        onClick={() => toggle(t, { isActive: !t.isActive })}
                      />
                      <Button
                        variant="outline"
                        onClick={() => openEdit(t)}
                        className="h-9 px-4 text-[13px] gap-2 rounded-lg font-medium border-gray-300 dark:border-gray-700"
                      >
                        <Pencil size={14} /> Edit
                      </Button>
                    </div>
                  </div>

                  {/* Quotas */}
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat label="Advising / month" value={quota(t.sessionsPerMonth)} />
                    <Stat label="PS rounds" value={quota(t.psRoundsLimit)} />
                    <Stat label="Supp. essays" value={quota(t.suppEssaysLimit)} />
                    <Stat
                      label="Mock interviews"
                      value={t.mockInterviewsLimit === 0 ? "None" : quota(t.mockInterviewsLimit)}
                    />
                  </div>

                  {/* Features */}
                  {t.features.length > 0 && (
                    <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 border-t border-[#e9edef] dark:border-[#2a3942] pt-4">
                      {t.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-[13px] text-[#111] dark:text-white">
                          <Check size={14} className="mt-0.5 shrink-0 text-[#97CE9D]" />
                          <span className="leading-snug">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mounted fresh per edit (keyed) so the form initializes from props
          without an effect syncing them in. */}
      {isModalOpen && (
        <AdminTierModal
          key={editing?.id ?? "new"}
          onClose={() => setIsModalOpen(false)}
          initialData={editing}
          nextSortOrder={nextSortOrder}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </PageWrapper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-[#182329] px-3.5 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-[#111] dark:text-white">{value}</p>
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] font-medium border transition-colors",
        active
          ? "border-[#1099A1] text-[#1099A1] bg-[#1099A1]/5"
          : "border-gray-300 dark:border-gray-700 text-muted-foreground hover:text-[#111] dark:hover:text-white"
      )}
      title={`Toggle ${label.toLowerCase()}`}
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          active ? "bg-[#1099A1]" : "bg-gray-300 dark:bg-gray-600"
        )}
      />
      {label}
    </button>
  );
}
