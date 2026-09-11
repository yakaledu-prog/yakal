import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, Plus, Search, X } from "lucide-react";

import { cn } from "@/utils/cn";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Dropdown } from "@/components/ui/Dropdown";
import { AdminHeader } from "./AdminHeader";
import { CollegeLogo, ApplicationLogo } from "@/components/college/CollegeLogo";
import { College, loadCatalog } from "@/services/collegeCatalogService";
import {
  CURRENT_CYCLE,
  EssayPrompt,
  createPrompt,
  getAllPrompts,
  getCycles,
  getPromptUsage,
  setPromptActive,
  updatePrompt,
} from "@/services/collegeCycleService";

// ============================================================
// The essay prompt catalogue, editable.
//
// Prompts come in from data/essay-prompts as a yearly import, and that import
// is the source of truth for a normal cycle. This screen exists for the
// abnormal one: a college quietly rewords a question in October, a counselor
// notices, and the fix cannot wait for a deploy. Everything here is an edit to
// a row the students' picker reads directly.
//
// Two things are deliberately visible on every row. The source link, because
// the only way to settle whether a prompt is current is to open the college's
// own page. And how many students are already writing against it, because
// editing the text of a prompt somebody has half answered is a different act
// from fixing one nobody has touched.
//
// Nothing is deleted. An essay keeps its own copy of the prompt text, so
// deleting the row would not break a draft, but it would erase where that
// draft's question came from. Hiding is the retirement, same as the tiers.
// ============================================================

type Scope = "all" | "shared" | "schools" | "hidden";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "shared", label: "Shared applications" },
  { value: "schools", label: "College supplements" },
  { value: "hidden", label: "Hidden" },
];

const APP_NAMES: Record<string, string> = {
  common_app: "Common App",
  uc: "UC Personal Insight",
  coalition: "Coalition App",
  activities: "Activities and honors",
  questbridge: "QuestBridge",
  mit: "MIT",
};

const REQUIREMENTS: { value: EssayPrompt["requirement"]; label: string }[] = [
  { value: "required", label: "Required" },
  { value: "optional", label: "Optional" },
  { value: "choice", label: "One of a set" },
];

function ownerName(p: EssayPrompt, catalog: College[]): string {
  if (p.unitid) {
    return catalog.find((c) => c.unitid === p.unitid)?.name ?? `Unitid ${p.unitid}`;
  }
  return APP_NAMES[p.app_key ?? ""] ?? p.app_key ?? "Shared";
}

function limitOf(p: EssayPrompt): string {
  if (p.word_limit) return `${p.word_limit} words`;
  if (p.char_limit) return `${p.char_limit} characters`;
  return "No limit";
}

export function AdminEssayPrompts() {
  const qc = useQueryClient();
  const [cycle, setCycle] = useState(CURRENT_CYCLE);
  const [scope, setScope] = useState<Scope>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<EssayPrompt | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: cycles = [CURRENT_CYCLE] } = useQuery({
    queryKey: ["essay-prompt-cycles"],
    queryFn: getCycles,
    staleTime: Infinity,
  });

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["admin-essay-prompts", cycle],
    queryFn: () => getAllPrompts(cycle),
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const { data: usage } = useQuery({
    queryKey: ["essay-prompt-usage"],
    queryFn: () => getPromptUsage(cycle),
  });

  const needle = q.trim().toLowerCase();

  /** Grouped by whoever asks the question, which is how an admin looks for one. */
  const groups = useMemo(() => {
    const matching = prompts.filter((p) => {
      if (scope === "shared" && p.unitid) return false;
      if (scope === "schools" && !p.unitid) return false;
      if (scope === "hidden" && p.is_active !== false) return false;
      if (scope !== "hidden" && p.is_active === false) return false;
      if (!needle) return true;
      return (
        p.title.toLowerCase().includes(needle) ||
        p.prompt.toLowerCase().includes(needle) ||
        ownerName(p, catalog).toLowerCase().includes(needle)
      );
    });

    const by = new Map<string, EssayPrompt[]>();
    for (const p of matching) {
      const key = ownerName(p, catalog);
      by.set(key, [...(by.get(key) ?? []), p]);
    }
    return [...by.entries()].sort((a, b) => {
      // Shared applications first: they are read by every student, so an error
      // in one of them is the expensive kind.
      const shared = (rows: EssayPrompt[]) => (rows[0].unitid ? 1 : 0);
      return shared(a[1]) - shared(b[1]) || a[0].localeCompare(b[0]);
    });
  }, [prompts, catalog, needle, scope]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-essay-prompts"] });
    void qc.invalidateQueries({ queryKey: ["essay-prompts-universal"] });
    void qc.invalidateQueries({ queryKey: ["essay-prompts-school"] });
    void qc.invalidateQueries({ queryKey: ["essay-prompt-counts"] });
  };

  const toggleActive = async (p: EssayPrompt) => {
    const next = p.is_active === false;
    const res = await setPromptActive(p.id, next);
    if (!res.success) return toast.error(res.error || "Could not change that.");
    toast.success(next ? `${p.title} is visible again.` : `${p.title} hidden.`);
    refresh();
  };

  const shownCount = groups.reduce((n, [, rows]) => n + rows.length, 0);
  const active = prompts.filter((p) => p.is_active !== false);

  return (
    <PageWrapper className="!p-0">
      <AdminHeader
        title="Essay prompts"
        subtitle="The questions colleges ask, as students see them when starting a draft."
        stats={[
          { label: "Live prompts", value: active.length },
          { label: "Colleges covered", value: new Set(active.filter((p) => p.unitid).map((p) => p.unitid)).size },
          { label: "Cycle", value: cycle },
        ]}
      />

      <div className="mx-auto w-full max-w-[1200px] p-6 md:p-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a college, a title or the text of a prompt"
              className="h-10 w-full rounded-md border border-border/60 bg-card pl-9 pr-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <Dropdown value={scope} onChange={setScope} options={SCOPES} ariaLabel="Which prompts" />
          <Dropdown
            value={cycle}
            onChange={setCycle}
            options={cycles.map((c) => ({ value: c, label: c }))}
            ariaLabel="Admissions cycle"
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            <Plus size={16} />
            Add a prompt
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-[14px] text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading
          </div>
        ) : shownCount === 0 ? (
          <p className="py-20 text-center text-[14px] text-muted-foreground">
            {needle ? `Nothing matches "${q.trim()}".` : "No prompts in this cycle yet."}
          </p>
        ) : (
          <div className="space-y-8">
            {groups.map(([owner, rows]) => (
              <section key={owner}>
                <div className="mb-3 flex items-center gap-3">
                  {rows[0].unitid ? (
                    <CollegeLogo
                      name={owner}
                      logo={catalog.find((c) => c.unitid === rows[0].unitid)?.logo ?? null}
                      website={catalog.find((c) => c.unitid === rows[0].unitid)?.website ?? null}
                      size={32}
                    />
                  ) : (
                    <ApplicationLogo appKey={rows[0].app_key ?? ""} name={owner} size={32} />
                  )}
                  <h2 className="text-[15px] font-semibold text-foreground">{owner}</h2>
                  <span className="text-[12.5px] text-muted-foreground">
                    {rows.length} {rows.length === 1 ? "prompt" : "prompts"}
                  </span>
                </div>

                <div className="divide-y divide-border/50 rounded-md border border-border/60">
                  {rows.map((p) => (
                    <div key={p.id} className="flex items-start gap-4 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-[14px] font-medium text-foreground">{p.title}</span>
                          <span className="text-[12.5px] font-medium text-primary">{limitOf(p)}</span>
                          {p.is_active === false && (
                            <span className="text-[12.5px] text-secondary">Hidden</span>
                          )}
                          {(usage?.get(p.id) ?? 0) > 0 && (
                            <span className="text-[12.5px] text-muted-foreground">
                              {usage!.get(p.id)} in progress
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.prompt}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12px] text-muted-foreground/80">
                          <span>{p.slug}</span>
                          {p.verified_on && <span>checked {p.verified_on}</span>}
                          {p.source_url && (
                            <a
                              href={p.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                            >
                              <ExternalLink size={12} /> source
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          className="h-8 rounded-md border border-border/60 px-3 text-[13px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(p)}
                          className="h-8 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {p.is_active === false ? "Show" : "Hide"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {(editing || creating) && (
        <PromptEditor
          prompt={editing}
          cycle={cycle}
          catalog={catalog}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            refresh();
          }}
        />
      )}
    </PageWrapper>
  );
}

const field =
  "h-10 w-full rounded-md border border-border/60 bg-card px-3 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[12.5px] font-medium text-foreground">{children}</span>;
}

function PromptEditor({
  prompt,
  cycle,
  catalog,
  onClose,
  onSaved,
}: {
  prompt: EssayPrompt | null;
  cycle: string;
  catalog: College[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [text, setText] = useState(prompt?.prompt ?? "");
  const [slug, setSlug] = useState(prompt?.slug ?? "");
  const [words, setWords] = useState(prompt?.word_limit?.toString() ?? "");
  const [chars, setChars] = useState(prompt?.char_limit?.toString() ?? "");
  const [requirement, setRequirement] = useState<EssayPrompt["requirement"]>(
    prompt?.requirement ?? "required"
  );
  const [source, setSource] = useState(prompt?.source_url ?? "");
  const [school, setSchool] = useState(prompt?.unitid?.toString() ?? "");
  const [appKey, setAppKey] = useState(prompt?.app_key ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim() || !text.trim()) return;
    setBusy(true);

    const patch = {
      cycle,
      slug: slug.trim() || `${(school || appKey || "prompt")}-${cycle}-${Date.now()}`,
      title: title.trim(),
      prompt: text.trim(),
      word_limit: words ? Number(words) : null,
      char_limit: chars ? Number(chars) : null,
      requirement,
      source_url: source.trim() || null,
      unitid: school ? Number(school) : null,
      app_key: appKey.trim() || null,
      // An edit here is a person saying they just looked at the college's page,
      // which is exactly what verified_on records.
      verified_on: new Date().toISOString().slice(0, 10),
      choice_group: prompt?.choice_group ?? null,
      choose_count: prompt?.choose_count ?? null,
      group_label: prompt?.group_label ?? null,
      is_active: prompt?.is_active ?? true,
    };

    const res = prompt
      ? await updatePrompt(prompt.id, patch)
      : await createPrompt(patch as never);
    setBusy(false);

    if (!res.success) return toast.error(res.error || "Could not save that.");
    toast.success(prompt ? `${patch.title} updated.` : `${patch.title} added.`);
    onSaved();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={prompt ? "Edit prompt" : "Add a prompt"}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="flex max-h-[84vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <h2 className="text-[16px] font-semibold text-foreground">
            {prompt ? "Edit prompt" : "Add a prompt"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <Label>Title</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A few words a student can scan"
              className={field}
            />
          </div>

          <div>
            <Label>The question, in the college's own words</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="Paste it verbatim. Never paraphrase: a student answers the question that was asked."
              className={cn(field, "h-auto resize-none py-2.5 leading-relaxed")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Word limit</Label>
              <input
                value={words}
                onChange={(e) => setWords(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="650"
                className={field}
              />
            </div>
            <div>
              <Label>Character limit</Label>
              <input
                value={chars}
                onChange={(e) => setChars(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="150"
                className={field}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Asked of everyone, or a choice</Label>
              <Dropdown
                value={requirement}
                onChange={setRequirement}
                options={REQUIREMENTS}
                buttonClassName="h-10 rounded-md text-[14px] font-normal"
                ariaLabel="Requirement"
              />
            </div>
            <div>
              <Label>Which application</Label>
              <input
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                placeholder="common_app, uc, coalition"
                className={field}
              />
            </div>
          </div>

          <div>
            <Label>College</Label>
            <input
              value={school}
              onChange={(e) => setSchool(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="IPEDS unitid, or blank for a shared application"
              className={field}
            />
            {school && (
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                {catalog.find((c) => c.unitid === Number(school))?.name ?? "No college with that unitid"}
              </p>
            )}
          </div>

          <div>
            <Label>Source</Label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="The page on the college's own site where this is published"
              className={field}
            />
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              Saving records today as the day this was checked.
            </p>
          </div>

          {!prompt && (
            <div>
              <Label>Handle</Label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="yale-2026-27-community, or leave blank for one to be made"
                className={field}
              />
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border/50 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-10 rounded-md border border-border/60 px-3.5 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !title.trim() || !text.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
            Save
          </button>
        </footer>
      </div>
    </div>
  );
}
