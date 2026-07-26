import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, Search, X } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  College,
  CONTROL_LABEL,
  Fit,
  StudentProfile,
  collegeImageUrl,
  computeFit,
  filterCatalog,
  EMPTY_FILTERS,
} from "@/services/collegeCatalogService";
import { SchoolTier } from "@/services/collegeService";
import { VerifiedBadge } from "./VerifiedBadge";

export interface AddCollegeInput {
  unitid: number | null;
  school_name: string;
  tier: SchoolTier;
  deadline: string | null;
  deadline_round: DeadlineRound | null;
  application_url: string | null;
  supp_essay_count: number | null;
  why_school: string | null;
}

export type DeadlineRound = "ed1" | "ed2" | "ea" | "rea" | "rd" | "rolling";

const ROUNDS: { value: DeadlineRound; label: string }[] = [
  { value: "ed1", label: "Early Decision" },
  { value: "ed2", label: "Early Decision II" },
  { value: "ea", label: "Early Action" },
  { value: "rea", label: "Restrictive Early Action" },
  { value: "rd", label: "Regular Decision" },
  { value: "rolling", label: "Rolling" },
];

const TIERS: { value: SchoolTier; label: string }[] = [
  { value: "dream", label: "Reach" },
  { value: "target", label: "Target" },
  { value: "safety", label: "Safety" },
];

const FIT_TO_TIER: Record<Fit, SchoolTier> = {
  reach: "dream",
  target: "target",
  safety: "safety",
  unknown: "target",
};

const field =
  "w-full rounded-lg border border-[#e9edef] bg-white px-3 py-2 text-[14px] text-[#111] outline-none transition-colors focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white";
const label =
  "mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

export function AddCollegeModal({
  open,
  onClose,
  onSubmit,
  catalog,
  student,
  alreadyAdded,
  saving,
  preselected = null,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AddCollegeInput) => void;
  catalog: College[];
  student: StudentProfile;
  alreadyAdded: Set<string>;
  saving: boolean;
  /** Skip the search step when the student already picked from a card. */
  preselected?: College | null;
}) {
  const [step, setStep] = useState<"search" | "details">("search");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<College | null>(null);
  /** Set when the student adds a college that is not in the federal catalog. */
  const [manualName, setManualName] = useState("");

  const [tier, setTier] = useState<SchoolTier>("target");
  const [round, setRound] = useState<DeadlineRound | "">("");
  const [deadline, setDeadline] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [essays, setEssays] = useState("");
  const [why, setWhy] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setManualName("");
    setRound("");
    setDeadline("");
    setAppUrl("");
    setEssays("");
    setWhy("");

    if (preselected) {
      setPicked(preselected);
      setTier(FIT_TO_TIER[computeFit(preselected, student)]);
      setStep("details");
      return;
    }

    setPicked(null);
    setTier("target");
    setStep("search");
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // `student` is a fresh object each render; keying on the scores avoids a
    // reset loop that would wipe what the student is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselected, student.sat, student.act]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return filterCatalog(catalog, { ...EMPTY_FILTERS, query }, student).slice(0, 8);
  }, [catalog, query, student]);

  const choose = (c: College) => {
    setPicked(c);
    setTier(FIT_TO_TIER[computeFit(c, student)]);
    // Everything the federal data already knows is filled for them. The only
    // fields left blank are the ones no public source supplies.
    setAppUrl("");
    setStep("details");
  };

  const chooseManual = () => {
    if (!manualName.trim()) return;
    setPicked(null);
    setStep("details");
  };

  const submit = () => {
    const name = picked?.name ?? manualName.trim();
    if (!name) return;
    onSubmit({
      unitid: picked?.unitid ?? null,
      school_name: name,
      tier,
      deadline: deadline || null,
      deadline_round: (round || null) as DeadlineRound | null,
      application_url: appUrl.trim() || null,
      supp_essay_count: essays === "" ? null : Number(essays),
      why_school: why.trim() || null,
    });
  };

  if (!open) return null;

  const name = picked?.name ?? manualName.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21]">
        <header className="flex items-center gap-3 border-b border-[#e9edef] px-5 py-4 dark:border-[#2a3942]">
          {step === "details" && (
            <button
              type="button"
              onClick={() => setStep("search")}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back to search"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-bold text-[#111] dark:text-white">
              {step === "search" ? "Add a college" : name}
            </h2>
            <p className="truncate text-[12px] text-muted-foreground">
              {step === "search"
                ? "Search and we fill in what we already know"
                : picked
                  ? [picked.city, picked.state].filter(Boolean).join(", ")
                  : "Not in the federal catalog"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {step === "search" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="p-5 pb-3">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Start typing a college name"
                  className={cn(field, "pl-9")}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {query.trim() === "" ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">
                  {catalog.length.toLocaleString()} US colleges. Cost, admit rate
                  and score ranges come filled in.
                </p>
              ) : matches.length === 0 ? (
                <div className="rounded-lg border border-[#e9edef] p-4 dark:border-[#2a3942]">
                  <p className="text-[13px] font-semibold text-foreground">
                    No match for "{query}"
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    Foreign universities and some very small colleges are not in
                    the federal data. Add it by name and fill in the rest yourself.
                  </p>
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="College name"
                    className={cn(field, "mt-3")}
                  />
                  <button
                    type="button"
                    onClick={chooseManual}
                    disabled={!manualName.trim()}
                    className="mt-2 w-full rounded-lg bg-[#1099A1] py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-50"
                  >
                    Add manually
                  </button>
                </div>
              ) : (
                <ul className="space-y-1">
                  {matches.map((c) => {
                    const added = alreadyAdded.has(c.name.toLowerCase());
                    const img = collegeImageUrl(c.image, 120);
                    return (
                      <li key={c.unitid}>
                        <button
                          type="button"
                          disabled={added}
                          onClick={() => choose(c)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors",
                            added
                              ? "cursor-not-allowed border-transparent opacity-50"
                              : "border-transparent hover:border-[#e9edef] hover:bg-[#f8f9fa] dark:hover:border-[#2a3942] dark:hover:bg-[#1c2a32]"
                          )}
                        >
                          <span className="h-10 w-14 shrink-0 overflow-hidden rounded bg-[#f3f3f5] dark:bg-[#1c2a32]">
                            {img && (
                              <img
                                src={img}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-semibold text-foreground">
                              {c.name}
                            </span>
                            <span className="block truncate text-[12px] text-muted-foreground">
                              {[c.city, c.state].filter(Boolean).join(", ")}
                              {c.control && ` - ${CONTROL_LABEL[c.control]}`}
                              {c.admitRate !== null && ` - ${c.admitRate}% admit`}
                            </span>
                          </span>
                          {added && (
                            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                              On your list
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {picked && (
                <div className="mb-5 rounded-lg bg-[#f3f3f5] p-3 dark:bg-[#1c2a32]">
                  <div className="mb-2 flex items-center gap-1.5">
                    <VerifiedBadge provenance="catalog" size={13} />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Already filled in for you
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                    <Row k="Admit rate" v={picked.admitRate === null ? "-" : `${picked.admitRate}%`} />
                    <Row
                      k="Net price"
                      v={picked.netPrice === null ? "-" : `$${picked.netPrice.toLocaleString()}/yr`}
                    />
                    <Row
                      k="SAT middle 50"
                      v={picked.satLow ? `${picked.satLow} - ${picked.satHigh}` : "Not reported"}
                    />
                    <Row
                      k="Graduation rate"
                      v={picked.gradRate === null ? "-" : `${picked.gradRate}%`}
                    />
                  </dl>
                </div>
              )}

              <div className="mb-1.5 flex items-center gap-1.5">
                <VerifiedBadge provenance="unverified" size={13} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  What we cannot look up
                </span>
              </div>
              <p className="mb-4 text-[12px] leading-snug text-muted-foreground">
                Deadlines and essay counts are not in any federal dataset. Add what
                you can from the college's own page. Your counselor checks it and
                marks it verified.
              </p>

              <div className="space-y-4">
                <div>
                  <span className={label}>How likely is it for you?</span>
                  <div className="flex gap-1.5">
                    {TIERS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTier(t.value)}
                        className={cn(
                          "flex-1 rounded-lg border py-2 text-[13px] font-semibold transition-colors",
                          tier === t.value
                            ? "border-[#1099A1] bg-[#1099A1]/10 text-[#0d757b] dark:text-[#5fc9cf]"
                            : "border-[#e9edef] text-foreground/70 hover:border-[#cbd5d8] dark:border-[#2a3942]"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {picked && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Our suggestion based on your scores. Your counselor makes the
                      final call.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label} htmlFor="round">
                      Application round
                    </label>
                    <select
                      id="round"
                      value={round}
                      onChange={(e) => setRound(e.target.value as DeadlineRound | "")}
                      className={field}
                    >
                      <option value="">Not sure yet</option>
                      {ROUNDS.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={label} htmlFor="deadline">
                      Deadline
                    </label>
                    <input
                      id="deadline"
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      className={field}
                    />
                  </div>
                </div>

                <div>
                  <label className={label} htmlFor="appurl">
                    Admissions page
                  </label>
                  <input
                    id="appurl"
                    type="url"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder={
                      picked ? "Paste the deadlines page you used" : "https://"
                    }
                    className={field}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Where you found the deadline. This is what lets a counselor
                    verify it in one click.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label} htmlFor="essays">
                      Supplemental essays
                    </label>
                    <input
                      id="essays"
                      type="number"
                      min={0}
                      max={20}
                      value={essays}
                      onChange={(e) => setEssays(e.target.value)}
                      placeholder="How many?"
                      className={field}
                    />
                  </div>
                </div>

                <div>
                  <label className={label} htmlFor="why">
                    Why this college
                  </label>
                  <textarea
                    id="why"
                    rows={3}
                    value={why}
                    onChange={(e) => setWhy(e.target.value)}
                    placeholder="What draws you to it? This becomes the seed of your supplement."
                    className={cn(field, "resize-none")}
                  />
                </div>
              </div>
            </div>

            <footer className="flex items-center gap-2 border-t border-[#e9edef] px-5 py-3 dark:border-[#2a3942]">
              <p className="flex-1 text-[11px] leading-snug text-muted-foreground">
                You can leave these blank and fill them in later.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving || !name}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Add to my list
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-semibold tabular-nums text-foreground">{v}</dd>
    </>
  );
}
