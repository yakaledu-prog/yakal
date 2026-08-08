import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Check, Star, EyeOff, Rows3, Columns3, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import { dicebearUrl } from "@/utils/avatar";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { AdminHeader } from "./AdminHeader";
import { AdminTierModal } from "./admissions/AdminTierModal";
import { money } from "@/services/billingService";
import {
  getAllTiers,
  getTierSubscribers,
  reorderTiers,
  monthlyCents,
  updateTier,
  createTier,
  setTierFlag,
  type AdmissionsTier,
  type TierInput,
  type TierSubscriber,
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

  // Tiers are sold as columns on the landing page, so an admin comparing them
  // wants the same shape. The row view stays for reading the detail.
  const [view, setView] = useState<"row" | "column">("row");
  const [subsFor, setSubsFor] = useState<AdmissionsTier | null>(null);

  const { data: subscribers } = useQuery({
    queryKey: ["admin-tier-subscribers"],
    queryFn: getTierSubscribers,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdmissionsTier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextSortOrder = tiers.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1;
  const activeCount = tiers.filter((t) => t.isActive).length;

  /** Move a tier one place and write the whole order back. */
  async function move(index: number, delta: -1 | 1) {
    const next = [...tiers];
    const to = index + delta;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    // Written optimistically: the arrows are for nudging things into place and
    // waiting for a round trip between clicks makes that feel broken.
    qc.setQueryData(["admin-admissions-tiers"], next);
    const res = await reorderTiers(next.map((t) => t.id));
    if (!res.success) toast.error(res.error ?? "Could not save the new order.");
    refresh();
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-admissions-tiers"] });
    // The public marketing page and the parent dashboard both read this key.
    qc.invalidateQueries({ queryKey: ["admissions-tiers"] });
    qc.invalidateQueries({ queryKey: ["admin-tier-subscribers"] });
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

        <div className="mx-auto max-w-[1440px] p-6 md:p-10">
          <div className="flex justify-between items-center gap-4 mb-8">
            <p className="text-[13px] text-muted-foreground">
              Editing a tier changes the public page and the parent checkout together.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 rounded-lg bg-[#f0f2f5] p-1 dark:bg-[#182329]">
                {([["row", Rows3, "Rows"], ["column", Columns3, "Columns"]] as const).map(
                  ([v, Icon, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-label={label}
                      aria-pressed={view === v}
                      className={cn(
                        "rounded-md p-1.5 transition-colors",
                        view === v
                          ? "bg-white text-[#1099A1] shadow-sm dark:bg-[#111b21]"
                          : "text-muted-foreground hover:text-[#111] dark:hover:text-white"
                      )}
                    >
                      <Icon size={16} />
                    </button>
                  )
                )}
              </div>
              <Button onClick={openCreate} className="gap-2">
                <Plus size={16} /> New tier
              </Button>
            </div>
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
            <div className={cn(
              view === "row"
                ? "flex flex-col gap-5"
                // The shape the landing page sells them in, so an admin can
                // compare the columns families compare.
                : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start"
            )}>
              {tiers.map((t, i) => (
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
                      {/* The arrows point the way the cards are laid out, so
                          "left" always means "earlier" on screen. */}
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move ${t.name} earlier`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[#f0f2f5] hover:text-[#111] disabled:opacity-30 dark:hover:bg-[#182329] dark:hover:text-white"
                        >
                          {view === "row" ? <ChevronUp size={16} /> : <ChevronLeft size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === tiers.length - 1}
                          aria-label={`Move ${t.name} later`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[#f0f2f5] hover:text-[#111] disabled:opacity-30 dark:hover:bg-[#182329] dark:hover:text-white"
                        >
                          {view === "row" ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        aria-label={`Edit ${t.name}`}
                        className="rounded-lg border border-[#e9edef] p-2 text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-[#1099A1] dark:border-[#2a3942]"
                      >
                        <Pencil size={15} />
                      </button>
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

                  <Subscribers
                    people={subscribers?.get(t.id) ?? []}
                    onOpen={() => setSubsFor(t)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mounted fresh per edit (keyed) so the form initializes from props
          without an effect syncing them in. */}
      {subsFor && (
        <SubscribersModal
          tier={subsFor}
          people={subscribers?.get(subsFor.id) ?? []}
          onClose={() => setSubsFor(null)}
        />
      )}

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

/**
 * Who is on this tier, as a row of faces and a count.
 *
 * A number alone ("4 families") is a fact; the faces make it a group of people
 * an admin recognises, which is the difference between reading a dashboard and
 * knowing who to call.
 */
function Subscribers({ people, onOpen }: { people: TierSubscriber[]; onOpen: () => void }) {
  if (people.length === 0) {
    return (
      <p className="mt-5 border-t border-[#e9edef] pt-4 text-[12.5px] text-muted-foreground dark:border-[#2a3942]">
        Nobody on this tier yet.
      </p>
    );
  }

  const shown = people.slice(0, 5);
  const rest = people.length - shown.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-5 flex w-full items-center gap-3 border-t border-[#e9edef] pt-4 text-left transition-colors hover:opacity-80 dark:border-[#2a3942]"
    >
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <img
            key={p.planId}
            src={p.studentAvatar || dicebearUrl(p.studentName)}
            alt=""
            title={p.studentName}
            className="h-7 w-7 rounded-full bg-muted object-cover ring-2 ring-white dark:ring-[#111b21]"
          />
        ))}
        {rest > 0 && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f0f2f5] text-[10.5px] font-medium text-muted-foreground ring-2 ring-white dark:bg-[#2a3942] dark:ring-[#111b21]">
            +{rest}
          </span>
        )}
      </div>
      <span className="text-[12.5px] text-muted-foreground">
        {people.length} {people.length === 1 ? "student" : "students"}
      </span>
      <span className="ml-auto flex items-center gap-1 text-[12.5px] text-[#1099A1]">
        <Users size={13} /> View all
      </span>
    </button>
  );
}

/** The same people, with the parent who is paying beside each one. */
function SubscribersModal({
  tier, people, onClose,
}: {
  tier: AdmissionsTier;
  people: TierSubscriber[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Students on ${tier.name}`}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#111b21]"
      >
        <div className="flex items-center justify-between border-b border-[#e9edef] px-6 py-4 dark:border-[#2a3942]">
          <div>
            <h2 className="text-[17px] font-semibold text-[#111] dark:text-white">{tier.name}</h2>
            <p className="text-[12.5px] text-muted-foreground">
              {people.length} {people.length === 1 ? "student" : "students"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-[#f0f2f5] dark:hover:bg-[#182329]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {people.map((p) => (
            <div key={p.planId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#f8f9fa] dark:hover:bg-[#182329]">
              <img
                src={p.studentAvatar || dicebearUrl(p.studentName)}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-[#111] dark:text-white">{p.studentName}</p>
                {/* The parent, because they are who an admin contacts about a
                    plan: the student consumes it, the parent bought it. */}
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {p.parentName ? `Paid by ${p.parentName}` : "No linked parent"}
                </p>
              </div>
              {p.parentAvatar !== undefined && p.parentName && (
                <img
                  src={p.parentAvatar || dicebearUrl(p.parentName)}
                  alt=""
                  title={p.parentName}
                  className="h-7 w-7 shrink-0 rounded-full bg-muted object-cover"
                />
              )}
              <span className="shrink-0 text-[12px] capitalize text-muted-foreground">{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
