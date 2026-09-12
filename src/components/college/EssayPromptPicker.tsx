import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ExternalLink, Loader2, PenLine, Search, X } from "lucide-react";

import { cn } from "@/utils/cn";
import { Dropdown } from "@/components/ui/Dropdown";
import { College, loadCatalog } from "@/services/collegeCatalogService";
import { CollegeListItem } from "@/services/collegeService";
import {
  CURRENT_CYCLE,
  EssayPrompt,
  getCycles,
  getPromptCounts,
  getRequirements,
  getSchoolPrompts,
  getUniversalPrompts,
  nextDeadline,
  ROUND_LABEL,
} from "@/services/collegeCycleService";
import { ApplicationLogo, CollegeLogo } from "./CollegeLogo";

// ============================================================
// Starting an essay from the question it answers.
//
// The old flow asked a student to type a title, pick a college from a
// dropdown, then paste the prompt in by hand from another tab. That is three
// answers to questions the product already knows, and the paste is the one
// that goes wrong: a half-copied prompt, or none at all, and then a counselor
// reviews a draft without knowing what was asked.
//
// So this starts from the college. Pick it, see its real questions with their
// real word limits, tick the ones being written, and every draft arrives with
// its prompt, its limit and a link to the page it came from.
//
// Two things are deliberate. Prompts we hold are never presented as complete:
// a school with none says so and offers the blank form, because our coverage
// is a fact about us and a student's essay is not going to wait for it. And
// every prompt shows where it was read and when, because a prompt that drifted
// mid-cycle should be checkable in one click rather than trusted.
// ============================================================

/** What the caller has to create once the student has chosen. */
export interface PromptSelection {
  /** At least one. Writing your own goes through onWriteYourOwn instead. */
  prompts: EssayPrompt[];
  /** Set when the chosen prompts belong to one college. */
  unitid: number | null;
  schoolName: string | null;
  /** The college list row these belong to, when the school is already on it. */
  collegeListItemId: string | null;
}

const APP_NAMES: Record<string, string> = {
  common_app: "Common App",
  uc: "UC Personal Insight",
  coalition: "Coalition App",
  activities: "Activities and honors",
  questbridge: "QuestBridge",
};

/** Most-used first. Alphabetical put Activities above the Common App, which is
 *  the wrong thing at the top of a list nine out of ten students start from. */
const APP_ORDER = ["common_app", "uc", "coalition", "questbridge", "activities"];

/** The activities list is not an essay and does not belong under a heading
 *  that says personal statement, so it gets its own. It is here because it is
 *  the Common App's tightest writing and the part students leave to the last
 *  night. */
const NOT_AN_ESSAY = new Set(["activities"]);

/**
 * The heading a choice group needs, if this prompt starts one.
 *
 * Yale asks seven questions, of which the last three are one question with
 * three ways in. Saying "choose 1 of these" once at the top of the list read
 * as though it governed all seven, which would have a student answering one
 * Yale question instead of five.
 */
function groupHeading(prompt: EssayPrompt, previous: EssayPrompt | undefined): string | null {
  if (!prompt.choice_group || prompt.choice_group === previous?.choice_group) return null;
  const n = prompt.choose_count ?? 1;
  return `Choose ${n} of the following`;
}

function limitOf(p: EssayPrompt): string | null {
  if (p.word_limit) return `${p.word_limit} words`;
  if (p.char_limit) return `${p.char_limit} characters`;
  return null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function readableDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

interface PickerProps {
  onClose: () => void;
  onSubmit: (selection: PromptSelection) => void;
  /** The blank form, for a question we do not hold. */
  onWriteYourOwn: (preset: { unitid: number | null; schoolName: string | null; collegeListItemId: string | null }) => void;
  schools: CollegeListItem[];
  saving: boolean;
}

/**
 * Mounted only while open, so closing it forgets the search, the college and
 * the ticks. Resetting that state in an effect instead means a render with the
 * previous student's selection still in it, and a lint rule that is right.
 */
export function EssayPromptPicker({ open, ...props }: PickerProps & { open: boolean }) {
  if (!open) return null;
  return <Picker {...props} />;
}

function Picker({ onClose, onSubmit, onWriteYourOwn, schools, saving }: PickerProps) {
  const [cycle, setCycle] = useState(CURRENT_CYCLE);
  const [query, setQuery] = useState("");
  /** Null while browsing. A college, or a shared application by its key. */
  const [opened, setOpened] = useState<{ unitid: number | null; appKey: string | null; name: string } | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  /** Rows rendered so far. The catalog is 1,944 schools and rendering all of
   *  them costs a second of layout for a list nobody scrolls to the end of. */
  const [shown, setShown] = useState(30);
  const sentinel = useRef<HTMLDivElement>(null);

  /** Ticks belong to the college they were made on. Clearing them here rather
   *  than in an effect keeps the two changes in one render: without it a
   *  student could carry Amherst's selection onto Bowdoin. */
  const openTarget = (next: { unitid: number | null; appKey: string | null; name: string } | null) => {
    setOpened(next);
    setTicked(new Set());
  };

  /**
   * More rows as the list is scrolled, rather than a Load more button.
   *
   * Subscribing to the viewport is what an effect is for, and setShown runs in
   * the observer's callback rather than in the effect body, so this adds no
   * cascading render.
   */
  useEffect(() => {
    const node = sentinel.current;
    if (!node || opened) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + 30);
      },
      { rootMargin: "200px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [opened, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || saving) return;
      if (opened) openTarget(null);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [opened, saving, onClose]);

  const { data: catalog = [] } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const { data: cycles = [CURRENT_CYCLE] } = useQuery({
    queryKey: ["essay-prompt-cycles"],
    queryFn: getCycles,
    staleTime: Infinity,
  });

  const { data: universal = [] } = useQuery({
    queryKey: ["essay-prompts-universal", cycle],
    queryFn: () => getUniversalPrompts(cycle),
  });

  const { data: counts } = useQuery({
    queryKey: ["essay-prompt-counts", cycle],
    queryFn: () => getPromptCounts(cycle),
  });

  const { data: schoolPrompts = [], isLoading: loadingPrompts } = useQuery({
    queryKey: ["essay-prompts-school", opened?.unitid, cycle],
    queryFn: () => getSchoolPrompts(opened!.unitid!, cycle),
    enabled: !!opened?.unitid,
  });

  const { data: requirements } = useQuery({
    queryKey: ["college-requirements", opened?.unitid, cycle],
    queryFn: () => getRequirements(opened!.unitid!, cycle),
    enabled: !!opened?.unitid,
  });

  /** Shared applications, grouped out of the flat prompt list. */
  const apps = useMemo(() => {
    const byKey = new Map<string, EssayPrompt[]>();
    for (const p of universal) {
      if (!p.app_key) continue;
      const list = byKey.get(p.app_key) ?? [];
      list.push(p);
      byKey.set(p.app_key, list);
    }
    return [...byKey.entries()]
      .map(([key, prompts]) => ({
        key,
        name: APP_NAMES[key] ?? key,
        prompts: prompts.sort((a, b) => a.sort_order - b.sort_order),
      }))
      .sort((a, b) => {
        const rank = (k: string) => {
          const i = APP_ORDER.indexOf(k);
          return i === -1 ? APP_ORDER.length : i;
        };
        return rank(a.key) - rank(b.key) || a.name.localeCompare(b.name);
      });
  }, [universal]);

  const onList = useMemo(
    () => new Map(schools.filter((s) => s.unitid).map((s) => [s.unitid as number, s])),
    [schools]
  );

  const q = query.trim().toLowerCase();

  const matchingApps = q
    ? apps.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.prompts.some((p) => p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q))
      )
    : apps;

  /**
   * Colleges, with the student's own list first.
   *
   * A student adding essays is nearly always adding them for a college they
   * have already chosen, so their list leads and the full catalogue is the
   * long tail underneath it.
   */
  const { mine, others } = useMemo(() => {
    const wanted = (c: College) =>
      !q || c.name.toLowerCase().includes(q) || (c.state ?? "").toLowerCase() === q;

    const mine: College[] = [];
    const others: College[] = [];
    for (const c of catalog) {
      if (!wanted(c)) continue;
      if (onList.has(c.unitid)) mine.push(c);
      else others.push(c);
    }
    // Colleges we hold questions for lead, because those are the ones where
    // this dialog does something the blank form does not. The rest follow in
    // name order rather than being hidden: a student writing for a college we
    // have nothing on still needs to get to it.
    return {
      mine: mine.sort((a, b) => a.name.localeCompare(b.name)),
      others: others.sort(
        (a, b) =>
          (counts?.get(b.unitid) ?? 0) - (counts?.get(a.unitid) ?? 0) ||
          a.name.localeCompare(b.name)
      ),
    };
  }, [catalog, onList, counts, q]);

  const openedCollege = opened?.unitid ? catalog.find((c) => c.unitid === opened.unitid) ?? null : null;
  const openedApp = opened?.appKey ? apps.find((a) => a.key === opened.appKey) ?? null : null;
  const visiblePrompts = opened?.appKey ? openedApp?.prompts ?? [] : schoolPrompts;

  const toggle = (id: string) =>
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    const chosen = visiblePrompts.filter((p) => ticked.has(p.id));
    if (!chosen.length) return;
    onSubmit({
      prompts: chosen,
      unitid: opened?.unitid ?? null,
      schoolName: openedCollege?.name ?? null,
      collegeListItemId: opened?.unitid ? onList.get(opened.unitid)?.id ?? null : null,
    });
  };

  const deadline = requirements ? nextDeadline(requirements) : null;

  /** A choice group where more has been ticked than the college asked for. */
  const over = (() => {
    const groups = new Map<string, { n: number; picked: number }>();
    for (const p of visiblePrompts) {
      if (!p.choice_group || !p.choose_count) continue;
      const entry = groups.get(p.choice_group) ?? { n: p.choose_count, picked: 0 };
      if (ticked.has(p.id)) entry.picked += 1;
      groups.set(p.choice_group, entry);
    }
    for (const [, entry] of groups) {
      if (entry.picked > entry.n) return { n: entry.n };
    }
    return null;
  })();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add an essay from a prompt"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21]">
        {opened ? (
          <>
            <header className="flex items-center gap-3 border-b border-border/50 px-6 py-4">
              <button
                type="button"
                onClick={() => openTarget(null)}
                aria-label="Back to all schools"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ArrowLeft size={18} />
              </button>
              {opened.appKey ? (
                <ApplicationLogo appKey={opened.appKey} name={opened.name} size={36} />
              ) : (
                <CollegeLogo
                  name={opened.name}
                  logo={openedCollege?.logo ?? null}
                  website={openedCollege?.website ?? null}
                  size={36}
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-foreground">{opened.name}</h2>
                <p className="truncate text-sm text-muted-foreground">
                  {deadline
                    ? `${ROUND_LABEL[deadline.round]} ${readableDate(deadline.date)}`
                    : requirements?.is_rolling
                      ? "Rolling admission"
                      : loadingPrompts
                        ? "Loading questions"
                        : "Application essays"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                aria-label="Close"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loadingPrompts ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" /> Loading questions
                </div>
              ) : visiblePrompts.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="text-base font-medium text-foreground">
                    We do not hold {opened.name}'s questions yet
                  </p>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Prompts are transcribed from each college's own admissions page and this one is
                    not done. Start the essay anyway and paste the question in, or tell your
                    counselor so it gets added.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onWriteYourOwn({
                        unitid: opened.unitid,
                        schoolName: openedCollege?.name ?? null,
                        collegeListItemId: opened.unitid ? onList.get(opened.unitid)?.id ?? null : null,
                      })
                    }
                    className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                  >
                    <PenLine size={15} />
                    {opened.unitid && !onList.has(opened.unitid)
                      ? `Add ${opened.name} and write it myself`
                      : "Write it myself"}
                  </button>
                </div>
              ) : (
                <>
                  {/* The cycle sits with the questions rather than in the
                      title bar, because it is what the list below is: prompts
                      are rewritten every August and last year's are still
                      worth reading when a student started early. */}
                  <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/50 bg-white px-6 py-2.5 dark:bg-[#111b21]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {/* Text, not a field. It labels the list as much as it
                          changes it, and a bordered control here competed with
                          the checkboxes for being the thing to click. */}
                      <Dropdown
                        value={cycle}
                        onChange={setCycle}
                        options={cycles.map((c) => ({
                          value: c,
                          label: c === CURRENT_CYCLE ? `${c} cycle` : c,
                        }))}
                        size="sm"
                        ariaLabel="Admissions cycle"
                        className="-ml-3 w-auto"
                        buttonClassName="h-8 border-transparent bg-transparent text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setTicked(new Set(visiblePrompts.map((p) => p.id)))}
                        className="text-sm font-medium text-primary transition-opacity hover:opacity-80"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setTicked(new Set())}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <ul className="divide-y divide-border/50">
                    {visiblePrompts.map((p, i) => {
                      const on = ticked.has(p.id);
                      const limit = limitOf(p);
                      const host = hostOf(p.source_url);
                      const heading = groupHeading(p, visiblePrompts[i - 1]);
                      return (
                        <li key={p.id}>
                          {heading && (
                            <p className="bg-muted/40 px-6 py-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                              {heading}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => toggle(p.id)}
                            aria-pressed={on}
                            className={cn(
                              "flex w-full gap-3 px-6 py-4 text-left transition-colors",
                              on ? "bg-primary/5" : "hover:bg-muted/40"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors",
                                on
                                  ? "border-primary bg-primary text-white"
                                  : "border-border/70 bg-transparent"
                              )}
                            >
                              {on && <Check size={12} strokeWidth={3} />}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-3">
                                <span className="text-sm font-medium text-foreground">
                                  {p.group_label ? `${p.group_label}. ` : ""}
                                  {p.title}
                                </span>
                                {limit && (
                                  <span className="shrink-0 text-xs font-medium text-primary">
                                    {limit}
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                                {p.prompt}
                              </span>
                              {host && (
                                <span className="mt-1.5 block text-xs text-muted-foreground/80">
                                  {host}
                                  {p.verified_on
                                    ? ` · checked ${readableDate(p.verified_on)}`
                                    : null}
                                  {p.extraction === "machine" && (
                                    // Said plainly. Most of these are right and
                                    // some are not, and a student who knows
                                    // that opens the college's page before
                                    // writing nine hundred words to it.
                                    <span className="text-secondary">
                                      {" · read automatically, worth checking"}
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {visiblePrompts.length > 0 && (
              <footer className="flex items-center gap-3 border-t border-border/50 px-6 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {ticked.size === 0
                      ? `${visiblePrompts.length} ${visiblePrompts.length === 1 ? "question" : "questions"}`
                      : `${ticked.size} of ${visiblePrompts.length} selected`}
                  </p>
                  {over && (
                    // Not an error. Drafting two and choosing later is what a
                    // counselor tells a student to do, which is also why these
                    // are checkboxes and not radio buttons: the college wants
                    // one answer, the student may want two drafts.
                    <p className="truncate text-xs text-secondary">
                      Only {over.n} of these {over.n === 1 ? "is" : "are"} required
                    </p>
                  )}
                </div>
                {requirements?.essay_page_url && (
                  <a
                    href={requirements.essay_page_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    <ExternalLink size={13} /> Their page
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="h-10 rounded-lg border border-border/60 px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={ticked.size === 0 || saving}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Add {ticked.size || ""} {ticked.size === 1 ? "draft" : "drafts"}
                </button>
              </footer>
            )}
          </>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-border/50 px-6 py-4">
              <Search size={17} className="shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(30);
                }}
                placeholder={
                  catalog.length
                    ? `Search ${catalog.length.toLocaleString()} schools`
                    : "Search a school or a prompt"
                }
                className="h-8 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto pb-5">
              {matchingApps.some((a) => !NOT_AN_ESSAY.has(a.key)) && (
                <Section title="Personal statement">
                  {matchingApps
                    .filter((a) => !NOT_AN_ESSAY.has(a.key))
                    .map((a) => (
                      <Row
                        key={a.key}
                        logo={<ApplicationLogo appKey={a.key} name={a.name} size={38} />}
                        title={a.name}
                        subtitle={`${a.prompts.length} ${a.prompts.length === 1 ? "prompt" : "prompts"}`}
                        onClick={() => openTarget({ unitid: null, appKey: a.key, name: a.name })}
                      />
                    ))}
                </Section>
              )}

              {matchingApps.some((a) => NOT_AN_ESSAY.has(a.key)) && (
                <Section title="Activities">
                  {matchingApps
                    .filter((a) => NOT_AN_ESSAY.has(a.key))
                    .map((a) => (
                      <Row
                        key={a.key}
                        logo={<ApplicationLogo appKey={a.key} name={a.name} size={38} />}
                        title={a.name}
                        subtitle={`${a.prompts.length} ${a.prompts.length === 1 ? "field" : "fields"}`}
                        onClick={() => openTarget({ unitid: null, appKey: a.key, name: a.name })}
                      />
                    ))}
                </Section>
              )}

              {mine.length > 0 && (
                <Section title="Your list" count={mine.length}>
                  {mine.map((c) => (
                    <CollegeRow
                      key={c.unitid}
                      college={c}
                      count={counts?.get(c.unitid) ?? 0}
                      onClick={() => openTarget({ unitid: c.unitid, appKey: null, name: c.name })}
                    />
                  ))}
                </Section>
              )}

              {others.length > 0 && (
                <Section title="Schools" count={others.length}>
                  {others.slice(0, shown).map((c) => (
                    <CollegeRow
                      key={c.unitid}
                      college={c}
                      count={counts?.get(c.unitid) ?? 0}
                      onClick={() => openTarget({ unitid: c.unitid, appKey: null, name: c.name })}
                    />
                  ))}
                </Section>
              )}

              {/* Crossing this brings the next thirty. It sits inside the
                  scroller so the observer has a root to measure against. */}
              <div ref={sentinel} aria-hidden className="h-px" />

              {matchingApps.length === 0 && mine.length === 0 && others.length === 0 && (
                <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                  Nothing matches "{query.trim()}".
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  /** How many there are in total, not how many are rendered. */
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-6 first:pt-5">
      <h3 className="px-6 pb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-1 tabular-nums font-normal text-muted-foreground/70">
            ({count.toLocaleString()})
          </span>
        )}
      </h3>
      {/* Two columns. A single column of 1,900 rows is a lot of scrolling for
          a list whose rows are two short lines. */}
      <ul className="grid grid-cols-1 gap-2.5 px-6 sm:grid-cols-2">{children}</ul>
    </section>
  );
}

function Row({
  logo,
  title,
  subtitle,
  onClick,
}: {
  logo: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3.5 rounded-md border border-border/60 bg-transparent px-4 py-3.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
      >
        {logo}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {subtitle}
          </span>
        </span>
      </button>
    </li>
  );
}

function CollegeRow({
  college,
  count,
  onClick,
}: {
  college: College;
  count: number;
  onClick: () => void;
}) {
  return (
    <Row
      logo={
        <CollegeLogo
          name={college.name}
          logo={college.logo}
          website={college.website}
          size={38}
        />
      }
      title={college.name}
      subtitle={
        count > 0
          ? `${count} ${count === 1 ? "essay" : "essays"}`
          : "No prompts yet"
      }
      onClick={onClick}
    />
  );
}
