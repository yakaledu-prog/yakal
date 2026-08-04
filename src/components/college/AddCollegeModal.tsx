import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  DollarSign,
  GraduationCap,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { dicebearUrl } from "@/utils/avatar";
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
import { Dropdown } from "@/components/ui/Dropdown";
import { DateField } from "@/components/ui/DateField";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Segmented } from "@/components/ui/Segmented";
import { Stepper } from "@/components/ui/Stepper";
import { FieldLabel, InfoHint } from "@/components/ui/InfoHint";

export type DeadlineRound = "ed1" | "ed2" | "ea" | "rea" | "rd" | "rolling";

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

const ROUNDS = [
  { value: "ed1" as const, label: "Early Decision" },
  { value: "ed2" as const, label: "Early Decision II" },
  { value: "ea" as const, label: "Early Action" },
  { value: "rea" as const, label: "Restrictive Early Action" },
  { value: "rd" as const, label: "Regular Decision" },
  { value: "rolling" as const, label: "Rolling" },
];

const TIERS = [
  { value: "dream" as const, label: "Reach" },
  { value: "target" as const, label: "Target" },
  { value: "safety" as const, label: "Safety" },
];

const FIT_TO_TIER: Record<Fit, SchoolTier> = {
  reach: "dream",
  target: "target",
  safety: "safety",
  unknown: "target",
};

const STEPS = ["College", "Deadline", "Your take"];

const input =
  "h-11 w-full rounded-xl border border-[#e9edef] bg-white px-3 text-[14px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white";

export function AddCollegeModal({
  addLabel = "Add to my list",
  targets,
  selectedTargets,
  onTargetsChange,
  open,
  onClose,
  onSubmit,
  catalog,
  student,
  alreadyAdded,
  saving,
  preselected = null,
}: {
  /** Whose list this goes on. "my" is wrong when a parent adds for a child. */
  addLabel?: string;
  /**
   * The people this college could go to, for a parent or counselor adding on
   * somebody's behalf. Absent for a student adding to their own list, who has
   * no choice to make and should not be asked to make one.
   */
  targets?: { id: string; name: string; avatarUrl?: string | null; subtitle?: string | null }[];
  selectedTargets?: string[];
  onTargetsChange?: (ids: string[]) => void;
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AddCollegeInput) => void;
  catalog: College[];
  student: StudentProfile;
  alreadyAdded: Set<string>;
  saving: boolean;
  preselected?: College | null;
}) {
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const chosenTargets = (targets ?? []).filter((t) => (selectedTargets ?? []).includes(t.id));
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<College | null>(null);
  const [manualName, setManualName] = useState("");

  const [tier, setTier] = useState<SchoolTier>("target");
  const [round, setRound] = useState<DeadlineRound | "">("");
  const [deadline, setDeadline] = useState<string | null>(null);
  const [appUrl, setAppUrl] = useState("");
  const [essays, setEssays] = useState<number | null>(null);
  const [why, setWhy] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setManualName("");
    setRound("");
    setDeadline(null);
    setAppUrl("");
    setEssays(null);
    setWhy("");

    if (preselected) {
      setPicked(preselected);
      setTier(FIT_TO_TIER[computeFit(preselected, student)]);
      setStep(1);
      return;
    }

    setPicked(null);
    setTier("target");
    setStep(0);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselected, student.sat, student.act]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return filterCatalog(catalog, { ...EMPTY_FILTERS, query }, student).slice(0, 7);
  }, [catalog, query, student]);

  /**
   * What to show before anyone types.
   *
   * A count of the catalog is a fact about us, not a starting point for them.
   * Targets lead because that is the band most lists are short of, and a couple
   * of safeties follow, since a list with none is the failure this product
   * exists to prevent. With no scores on file there is nothing to fit against,
   * so it falls back to the largest colleges, which are the ones a student is
   * most likely to recognise anyway.
   */
  const suggestions = useMemo(() => {
    const pool = catalog.filter((c) => !alreadyAdded.has(c.name.toLowerCase()));
    if (!student.sat && !student.act) return pool.slice(0, 6);
    const byFit = (want: Fit) =>
      pool.filter((c) => computeFit(c, student) === want);
    return [...byFit("target").slice(0, 4), ...byFit("safety").slice(0, 2)].slice(0, 6);
  }, [catalog, student, alreadyAdded]);

  const name = picked?.name ?? manualName.trim();

  const choose = (c: College) => {
    setPicked(c);
    setTier(FIT_TO_TIER[computeFit(c, student)]);
    setStep(1);
  };

  const submit = () => {
    if (!name) return;
    onSubmit({
      unitid: picked?.unitid ?? null,
      school_name: name,
      tier,
      deadline,
      deadline_round: (round || null) as DeadlineRound | null,
      application_url: appUrl.trim() || null,
      supp_essay_count: essays,
      why_school: why.trim() || null,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21]",
          // A floor, not a fixed height. Pinning it to 700px gave a short form
          // a tall box with a void through the middle and handed the panel
          // beside it more height than there was anything to put in.
          picked && step > 0 ? "max-h-[88vh] md:min-h-[440px]" : "max-h-[88vh]",
          picked && step > 0 ? "max-w-lg md:max-w-4xl" : "max-w-lg",
          "flex-col md:flex-row"
        )}
      >
        {/* The college being added, kept in view while the form is filled in.
            Desktop only: on a phone this would be a screen of context before
            the first field, so the compact strip below stays there instead. */}
        {picked && step > 0 && <CollegePanel college={picked} />}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="border-b border-[#e9edef] px-6 pb-5 pt-5 dark:border-[#2a3942] md:px-8 md:pb-6 md:pt-6">
          {/* One row. On a phone it carries the college name, because the
              side panel that would otherwise say it is not there; from md the
              panel has the name and this row gives the space to the stepper.
              The close button stays at the end of it either way. */}
          <div className="flex items-center gap-6">
            <div className={cn("min-w-0 flex-1", step > 0 && picked && "md:hidden")}>
              <h2 className="truncate text-[16px] font-semibold text-[#111] dark:text-white">
                {step === 0 ? "Add a college" : name}
              </h2>
              {step > 0 && picked && (
                <p className="truncate text-[12px] text-[#717182]">
                  {[picked.city, picked.state].filter(Boolean).join(", ")}
                  {picked.control && ` - ${CONTROL_LABEL[picked.control]}`}
                </p>
              )}
            </div>

            <Stepper
              className="hidden min-w-0 flex-1 md:flex"
              steps={STEPS}
              current={step}
              onStepClick={(i) => name && setStep(i)}
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 text-[#717182] transition-colors hover:text-[#111] dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* The phone keeps its stepper on its own line, where a three step
              rail beside a title would have nowhere to go. */}
          <Stepper
            className="mt-4 md:hidden"
            steps={STEPS}
            current={step}
            onStepClick={(i) => name && setStep(i)}
          />
        </header>

        {/* Facts we already hold, shown as context rather than announced. */}
        {picked && step > 0 && (
          <div className="grid grid-cols-4 divide-x divide-[#e9edef] border-b border-[#e9edef] bg-[#fafbfc] md:hidden dark:divide-[#2a3942] dark:border-[#2a3942] dark:bg-[#0f171c]">
            <Stat
              k="Admit"
              v={picked.admitRate === null ? "-" : `${picked.admitRate}%`}
              hint="Share of all applicants admitted, across the whole college. Competitive majors like nursing, CS and engineering are usually harder than this number suggests."
            />
            <Stat
              k="Net price"
              v={picked.netPrice === null ? "-" : `$${(picked.netPrice / 1000).toFixed(0)}k`}
              hint="Average yearly cost after grants for students receiving federal aid, not the sticker price and not a quote for you. Run the college's net price calculator for your own figure."
            />
            <Stat
              k="SAT"
              v={picked.satLow ? `${picked.satLow}-${picked.satHigh}` : "-"}
              hint="Middle 50 percent of enrolled students who submitted a score. Because many now apply test-optional, this skews higher than the typical admitted student."
            />
            <Stat
              k="Grad"
              v={picked.gradRate === null ? "-" : `${picked.gradRate}%`}
              hint="Share of students who finish a bachelor's degree here within six years."
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-7">
          {step === 0 && (
            <>
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#717182]"
                />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search colleges"
                  className={cn(input, "pl-9")}
                />
              </div>

              {query.trim() === "" ? (
                <>
                  <p className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-[0.06em] text-[#a8adb8]">
                    {student.sat || student.act
                      ? "Suggested for you"
                      : `Popular of ${catalog.length.toLocaleString()} US colleges`}
                  </p>
                  <ul className="space-y-0.5">
                    {suggestions.map((c) => (
                      <CollegeOption
                        key={c.unitid}
                        college={c}
                        added={false}
                        onPick={() => choose(c)}
                      />
                    ))}
                  </ul>
                </>
              ) : matches.length === 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-[13px] text-[#717182]">
                    Not in the federal data. Add it by name.
                  </p>
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="College name"
                    className={input}
                  />
                  <button
                    type="button"
                    onClick={() => manualName.trim() && setStep(1)}
                    disabled={!manualName.trim()}
                    className="mt-2 h-11 w-full rounded-xl bg-[#1099A1] text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-40"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                <ul className="mt-3 space-y-0.5">
                  {matches.map((c) => (
                    <CollegeOption
                      key={c.unitid}
                      college={c}
                      added={alreadyAdded.has(c.name.toLowerCase())}
                      onPick={() => choose(c)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}

          {step === 1 && (
            <div className="space-y-5">
              {/* Round and deadline are one decision, so they share a row. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel hint="Early rounds close sooner. Early Decision is binding: if admitted you must enrol. Pick Not decided if you are still weighing it.">
                    Round
                  </FieldLabel>
                  <Dropdown
                    value={round}
                    onChange={(v) => setRound(v as DeadlineRound | "")}
                    options={[{ value: "" as const, label: "Not decided" }, ...ROUNDS]}
                    buttonClassName="h-11 rounded-xl text-[14px] font-normal"
                    ariaLabel="Application round"
                  />
                </div>
                <div>
                  <FieldLabel hint="The date the application is due, taken from the college's own admissions page. Deadlines are in no federal dataset, so this is the one date only you can supply.">
                    Deadline
                  </FieldLabel>
                  <DateField
                    value={deadline}
                    onChange={setDeadline}
                    ariaLabel="Application deadline"
                  />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div>
                  <FieldLabel
                    htmlFor="appurl"
                    hint="The page you read the deadline on. Your counselor opens it to confirm in one click instead of hunting for it."
                  >
                    Admissions page
                  </FieldLabel>
                  <input
                    id="appurl"
                    type="url"
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder="https://"
                    className={input}
                  />
                </div>
                <div>
                  <FieldLabel hint="Extra essays this college wants on top of the Common App personal statement. Leave blank if you have not checked yet.">
                    Essays
                  </FieldLabel>
                  <NumberStepper
                    value={essays}
                    onChange={setEssays}
                    max={20}
                    ariaLabel="Number of supplemental essays"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <FieldLabel hint="Reach, target or safety. We suggest one from your scores against admitted students. Your counselor makes the final call.">Your odds</FieldLabel>
                <Segmented
                  value={tier}
                  onChange={setTier}
                  options={TIERS}
                  ariaLabel="Reach, target or safety"
                />
              </div>
              <div>
                <FieldLabel htmlFor="why" hint="Your own reason for wanting it. This becomes the raw material for the supplemental essay, so write it in your words.">Why this college</FieldLabel>
                <textarea
                  id="why"
                  rows={5}
                  value={why}
                  onChange={(e) => setWhy(e.target.value)}
                  placeholder="What draws you to it?"
                  className={cn(input, "h-auto resize-none py-2.5 leading-relaxed")}
                />
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-[#e9edef] px-6 py-4 dark:border-[#2a3942] md:px-8 md:py-5">
          {/* Beside the navigation rather than inside a step: it is the one
              answer that is not about the college, and it stays visible while
              the rest is being filled in.

              A dropdown rather than a row of names. Two fit on the line and
              five do not, and a footer that reflows as a family grows is a
              footer that breaks for exactly the people who need it most. */}
          {targets && targets.length > 0 && (
            <div className="relative mr-auto">
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                aria-expanded={pickerOpen}
                aria-haspopup="listbox"
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] transition-colors",
                  chosenTargets.length
                    ? "border-[#1099A1] text-[#1099A1]"
                    : "border-[#e9edef] text-[#54656f] dark:border-[#2a3942] dark:text-[#aebac1]"
                )}
              >
                <span className="flex -space-x-2">
                  {chosenTargets.slice(0, 3).map((t) => (
                    <img
                      key={t.id}
                      src={t.avatarUrl || dicebearUrl(t.name)}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover ring-2 ring-white dark:ring-[#111b21]"
                    />
                  ))}
                </span>
                <span className="max-w-[140px] truncate font-medium">
                  {chosenTargets.length === 0
                    ? "Choose who for"
                    : chosenTargets.length === 1
                      ? chosenTargets[0].name
                      : `${chosenTargets.length} selected`}
                </span>
                <ChevronDown size={15} className={cn("transition-transform", pickerOpen && "rotate-180")} />
              </button>

              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                  <ul
                    role="listbox"
                    aria-multiselectable
                    className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-64 overflow-y-auto rounded-xl border border-[#e9edef] bg-white p-1 shadow-lg dark:border-[#2a3942] dark:bg-[#182229]"
                  >
                    {targets.map((t) => {
                      const on = (selectedTargets ?? []).includes(t.id);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={on}
                            onClick={() =>
                              onTargetsChange?.(
                                on
                                  ? (selectedTargets ?? []).filter((x) => x !== t.id)
                                  : [...(selectedTargets ?? []), t.id]
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                              on ? "bg-[#1099A1]/10" : "hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]"
                            )}
                          >
                            <img
                              src={t.avatarUrl || dicebearUrl(t.name)}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] text-foreground">{t.name}</span>
                              {t.subtitle && (
                                <span className="block truncate text-[11.5px] text-[#717182]">{t.subtitle}</span>
                              )}
                            </span>
                            {on && <Check size={15} className="shrink-0 text-[#1099A1]" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Both on the right, Prev bordered so going back is visibly a
              button rather than a piece of text. No Skip: every field on these
              steps is already optional and Next moves on without them, so it
              was a second button for the same outcome. */}
          <div className="flex-1" />
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#e9edef] px-4 text-[14px] font-medium text-[#54656f] transition-colors hover:border-[#cbd5d8] hover:text-[#111] dark:border-[#2a3942] dark:text-[#aebac1] dark:hover:text-white"
            >
              <ArrowLeft size={15} />
              Prev
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!name}
              className="h-10 rounded-xl bg-[#1099A1] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving || !name || (!!targets?.length && !selectedTargets?.length)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {addLabel}
            </button>
          )}
        </footer>
        </div>
      </div>
    </div>
  );
}

/**
 * The college, beside the form.
 *
 * The four numbers were a strip of four cells across the top, which put them
 * above the fold on a laptop and nowhere near the fields they inform. Down the
 * side they stay readable while somebody works, which is the point of showing
 * them at all.
 *
 * The photograph is the campus, not a crest: the catalog holds Wikimedia
 * images and no logos, and inventing one would mean a wrong mark next to a
 * real university.
 */
function CollegePanel({ college }: { college: College }) {
  const [imgFailed, setImgFailed] = useState(false);
  const img = imgFailed ? null : collegeImageUrl(college.image, 480);

  const rows = [
    {
      icon: <Users size={15} />,
      label: "Admit",
      value: college.admitRate === null ? "-" : `${college.admitRate}%`,
      hint: "Share of all applicants admitted, across the whole college. Competitive majors like nursing, CS and engineering are usually harder than this number suggests.",
    },
    {
      icon: <DollarSign size={15} />,
      label: "Net price",
      value: college.netPrice === null ? "-" : `$${(college.netPrice / 1000).toFixed(0)}k`,
      hint: "Average yearly cost after grants for students receiving federal aid, not the sticker price and not a quote for you.",
    },
    {
      icon: <BarChart3 size={15} />,
      label: "SAT",
      value: college.satLow ? `${college.satLow}-${college.satHigh}` : "-",
      hint: "Middle 50 percent of enrolled students who submitted a score. Because many now apply test-optional, this skews higher than the typical admitted student.",
    },
    {
      icon: <GraduationCap size={15} />,
      label: "Grad",
      value: college.gradRate === null ? "-" : `${college.gradRate}%`,
      hint: "Share of students who finish a bachelor's degree here within six years.",
    },
  ];

  return (
    <aside className="relative hidden w-[280px] shrink-0 flex-col overflow-hidden border-r border-[#e9edef] bg-[#f7fafb] md:flex dark:border-[#2a3942] dark:bg-[#0f171c]">
      {img && (
        <>
          <img
            src={img}
            alt=""
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* The panel's own surface, thinning downwards. Opaque where the name
              and the numbers sit, so they keep the contrast they were designed
              with, and clear enough at the foot for the campus to show through.
              It takes the theme's colour rather than a wash of black, which
              turned a light panel dark and made the text fight the photograph.
              Dark mode gets the same treatment in its own surface. */}
          <div
            className="absolute inset-0 dark:hidden"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, #f7fafb 0%, #f7fafb 70%, rgba(247,250,251,0.9) 82%, rgba(247,250,251,0.6) 92%, rgba(247,250,251,0.45) 100%)",
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, #0f171c 0%, #0f171c 70%, rgba(15,23,28,0.9) 82%, rgba(15,23,28,0.6) 92%, rgba(15,23,28,0.45) 100%)",
            }}
          />
        </>
      )}

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto p-6">
        <h3 className="text-[19px] font-bold leading-tight text-[#111] dark:text-white">
          {college.name}
        </h3>
        <p className="mt-1 text-[12.5px] text-[#717182]">
          {[college.city, college.state].filter(Boolean).join(", ")}
          {college.control && ` - ${CONTROL_LABEL[college.control]}`}
        </p>

        <div className="mt-5 space-y-2.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#e9edef] bg-white px-3.5 py-3 dark:border-[#2a3942] dark:bg-[#111b21]"
            >
              <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-[#54656f] dark:text-[#aebac1]">
                <span className="text-[#1099A1]">{r.icon}</span>
                <span className="truncate">{r.label}</span>
                <InfoHint text={r.hint} size={11} />
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[#111] dark:text-white">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** One cell of the compact strip a phone gets instead of the side panel. */
function Stat({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="px-2 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[12px] font-normal text-[#a8adb8]">
        {k}
        {hint && <InfoHint text={hint} size={11} />}
      </div>
      <div className="mt-0.5 text-[14px] font-normal tabular-nums text-[#111] dark:text-white">
        {v}
      </div>
    </div>
  );
}

/** One searchable college, shared by the suggestions and the search results. */
function CollegeOption({
  college,
  added,
  onPick,
}: {
  college: College;
  added: boolean;
  onPick: () => void;
}) {
  const img = collegeImageUrl(college.image, 120);
  return (
    <li>
      <button
        type="button"
        disabled={added}
        onClick={onPick}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors",
          added
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]"
        )}
      >
        <span className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-[#f3f3f5] dark:bg-[#1c2a32]">
          {img && <img src={img} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-[#111] dark:text-white">
            {college.name}
          </span>
          <span className="block truncate text-[12px] text-[#717182]">
            {[college.city, college.state].filter(Boolean).join(", ")}
            {college.admitRate !== null && ` - ${college.admitRate}% admit`}
          </span>
        </span>
        {added && (
          <span className="shrink-0 text-[11px] font-semibold text-[#a8adb8]">Added</span>
        )}
      </button>
    </li>
  );
}
