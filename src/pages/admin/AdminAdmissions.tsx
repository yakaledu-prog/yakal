import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Check, Star, EyeOff, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users, X, MoreVertical, Search, List, LayoutGrid } from "lucide-react";
import { dicebearUrl } from "@/utils/avatar";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { cn } from "@/utils/cn";
import { AdminHeader } from "./AdminHeader";
import { AdminTierModal } from "./admissions/AdminTierModal";
import { money } from "@/services/billingService";
import {
  getAllTiers,
  getTierSubscribers,
  reorderTiers,
  monthlyCents,
  tierShade,
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
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState<"all" | "active" | "hidden">("all");
  const [subsFor, setSubsFor] = useState<AdmissionsTier | null>(null);

  const { data: subscribers } = useQuery({
    queryKey: ["admin-tier-subscribers"],
    queryFn: getTierSubscribers,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdmissionsTier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextSortOrder = tiers.reduce((m, t) => Math.max(m, t.sortOrder), 0) + 1;

  const needle = q.trim().toLowerCase();
  const shown = tiers.filter((t) => {
    if (visibility === "active" && !t.isActive) return false;
    if (visibility === "hidden" && t.isActive) return false;
    if (!needle) return true;
    return (
      t.name.toLowerCase().includes(needle) ||
      (t.blurb ?? "").toLowerCase().includes(needle) ||
      t.features.some((f) => f.toLowerCase().includes(needle))
    );
  });

  // Reordering writes positions from the rows on screen, so a filtered list
  // would renumber two tiers and quietly reshuffle whatever is hidden between
  // them. The arrows are therefore only offered on the full list.
  const filtering = needle !== "" || visibility !== "all";
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
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tiers, descriptions or features..."
                className="h-10 w-full rounded-xl border border-[#e9edef] bg-transparent pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-[#1099A1] dark:border-[#2a3942]"
              />
            </div>

            <Dropdown
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "all", label: `All (${tiers.length})` },
                { value: "active", label: `Active (${tiers.filter((t) => t.isActive).length})` },
                { value: "hidden", label: `Hidden (${tiers.filter((t) => !t.isActive).length})` },
              ]}
              size="sm"
              ariaLabel="Filter by visibility"
              className="w-[150px]"
              buttonClassName="text-foreground/70"
            />
            <div className="flex items-center gap-3 shrink-0">
              {/* The same control as the Courses page. Two togglers that do
                  the same job should not look like two different components. */}
              <div className="flex rounded-lg border border-[#e9edef] bg-gray-100 p-1 dark:border-[#2a3942] dark:bg-[#182329]">
                {([["row", List, "List view"], ["column", LayoutGrid, "Column view"]] as const).map(
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
                          ? "bg-white shadow-sm dark:bg-[#202c33]"
                          : "text-muted-foreground hover:text-[#111] dark:hover:text-white"
                      )}
                    >
                      <Icon size={18} />
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
          ) : shown.length === 0 ? (
            <p className="text-center py-16 text-[14px] text-muted-foreground">
              {filtering ? "No tiers match that." : "No tiers yet. Create the first one."}
            </p>
          ) : (
            <div className={cn(
              view === "row"
                ? "flex flex-col gap-5"
                // The shape the landing page sells them in, so an admin can
                // compare the columns families compare.
                : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start"
            )}>
              {shown.map((t, i) => (
                <div
                  key={t.id}
                  className={cn(
                    "relative overflow-hidden bg-white dark:bg-[#111b21] rounded-2xl border p-6 md:p-7 transition-colors",
                    !t.isActive && "opacity-60"
                  )}
                  // Each tier's brand shade on the top edge and border, the same
                  // colour families and parents see, so admin edits the plan it
                  // looks like. Position in the full list, not the filtered one,
                  // so a search does not repaint the cards.
                  style={{
                    borderColor: tierShade(tiers.findIndex((x) => x.id === t.id)),
                    borderTopWidth: 4,
                  }}
                >
                  {/* The actions float instead of sharing a flex row. As a
                      sibling they took width from the price line, which then
                      wrapped "over 10 months" onto its own line in a card with
                      room to spare. The padding-right is what keeps the name
                      from running under them. */}
                  <div className="pr-[104px]">
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

                    </div>

                    <div className="absolute right-6 top-6 flex items-center gap-2 md:right-7 md:top-7">
                      {/* The arrows point the way the cards are laid out, so
                          "left" always means "earlier" on screen. */}
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0 || filtering}
                          aria-label={`Move ${t.name} earlier`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[#f0f2f5] hover:text-[#111] disabled:opacity-30 dark:hover:bg-[#182329] dark:hover:text-white"
                        >
                          {view === "row" ? <ChevronUp size={16} /> : <ChevronLeft size={16} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === shown.length - 1 || filtering}
                          aria-label={`Move ${t.name} later`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-[#f0f2f5] hover:text-[#111] disabled:opacity-30 dark:hover:bg-[#182329] dark:hover:text-white"
                        >
                          {view === "row" ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </div>

                      {/* Side by side in a row, behind a kebab in a column.
                          Three controls and a name do not fit across 350px,
                          and the arrows stay out because reordering is the one
                          thing you do repeatedly. */}
                      {view === "row" ? (
                        <>
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
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="flex items-center gap-1.5 rounded-lg border border-[#e9edef] px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-[#1099A1] dark:border-[#2a3942]"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        </>
                      ) : (
                        <CardMenu
                          tier={t}
                          onEdit={() => openEdit(t)}
                          onToggle={(patch: { isActive?: boolean; isRecommended?: boolean }) => toggle(t, patch)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Below the header rather than inside it. As a flex child
                      beside the actions it only ever got the leftover width,
                      which in a column left half the card empty. */}
                  {t.blurb && (
                    <p className={cn(
                      "mt-4 text-[13.5px] leading-relaxed text-muted-foreground",
                      view === "row" && "max-w-2xl"
                    )}>
                      {t.blurb}
                    </p>
                  )}

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
          shade={tierShade(
            editing ? tiers.findIndex((x) => x.id === editing.id) : tiers.length
          )}
          nextSortOrder={nextSortOrder}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </PageWrapper>
  );
}

/**
 * One quota, in a fixed-height tile.
 *
 * Truncated rather than wrapped. "Advising / month" and "Mock interviews" are
 * wider than a quarter of a column, and letting them wrap made four tiles of
 * four different heights, so the numbers underneath stopped lining up and the
 * row read as a ragged list instead of a set. The title attribute carries the
 * full label for whoever needs it.
 */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 px-3.5 py-2.5 dark:bg-[#182329]">
      <p
        title={label}
        className="truncate text-[11px] uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </p>
      <p title={value} className="mt-0.5 truncate text-[14px] font-semibold text-[#111] dark:text-white">
        {value}
      </p>
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

/**
 * The three controls that do not fit across a column.
 *
 * Only used in the column view. In rows there is width for them to be visible,
 * and a menu that hides what could be shown costs a click for nothing.
 */
function CardMenu({
  tier, onEdit, onToggle,
}: {
  tier: AdmissionsTier;
  onEdit: () => void;
  onToggle: (patch: { isActive?: boolean; isRecommended?: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const item =
    "flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-[#f0f2f5] dark:hover:bg-[#182329]";

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Actions for ${tier.name}`}
        aria-expanded={open}
        className="rounded-lg border border-[#e9edef] p-2 text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-[#1099A1] dark:border-[#2a3942]"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-[#e9edef] bg-white p-1 shadow-lg dark:border-[#2a3942] dark:bg-[#111b21]">
          <button
            type="button"
            onClick={() => { onToggle({ isRecommended: !tier.isRecommended }); setOpen(false); }}
            className={item}
          >
            Recommended
            {tier.isRecommended && <Check size={14} className="shrink-0 text-[#1099A1]" />}
          </button>
          <button
            type="button"
            onClick={() => { onToggle({ isActive: !tier.isActive }); setOpen(false); }}
            className={item}
          >
            {tier.isActive ? "Visible to families" : "Hidden"}
            {tier.isActive && <Check size={14} className="shrink-0 text-[#1099A1]" />}
          </button>
          <div className="my-1 h-px bg-[#e9edef] dark:bg-[#2a3942]" />
          <button type="button" onClick={() => { onEdit(); setOpen(false); }} className={item}>
            Edit tier
            <Pencil size={13} className="shrink-0 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
