import { useState } from "react";
import { ExternalLink, FileText, Loader2, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem, Essay, EssayStatus } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { FieldLabel } from "@/components/ui/InfoHint";

const STATUS: { value: EssayStatus; label: string }[] = [
  { value: "todo", label: "Not started" },
  { value: "drafting", label: "Drafting" },
  { value: "in_review", label: "With counselor" },
  { value: "done", label: "Done" },
];

const input =
  "h-11 w-full rounded-xl border border-[#e9edef] bg-white px-3 text-[14px] text-[#111] outline-none transition-colors placeholder:text-[#a8adb8] focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#1c2a32] dark:text-white";

export interface NewEssay {
  title: string;
  kind: "personal_statement" | "supplement";
  college_list_item_id: string | null;
}

/**
 * Essays, grouped by what they are for.
 *
 * The personal statement is written once and reused everywhere, so it is kept
 * apart from supplements, which are per college and die with that application.
 * Conflating them is why students lose track of how many they still owe.
 */
export function EssaysPanel({
  essays,
  schools,
  onAdd,
  onStatusChange,
  onCreateDoc,
  creatingDoc,
  saving,
}: {
  essays: Essay[];
  schools: CollegeListItem[];
  onAdd: (e: NewEssay) => void;
  onStatusChange: (id: string, status: EssayStatus) => void;
  onCreateDoc: (essay: Essay) => void;
  creatingDoc: string | null;
  saving: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [schoolId, setSchoolId] = useState<string>("");

  const core = essays.filter((e) => e.kind === "personal_statement");
  const supplements = essays.filter((e) => e.kind === "supplement");
  const done = essays.filter((e) => e.status === "done").length;

  // How many supplements are still owed across the whole list, which is the
  // number that actually predicts how much work is left.
  const owed = schools.reduce((n, s) => n + (s.supp_essay_count ?? 0), 0);

  const reset = () => {
    setTitle("");
    setSchoolId("");
    setAdding(false);
  };

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      title: title.trim(),
      kind: schoolId ? "supplement" : "personal_statement",
      college_list_item_id: schoolId || null,
    });
    reset();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
          {essays.length === 0
            ? owed > 0
              ? `Your list needs about ${owed} supplemental essays plus a personal statement.`
              : "Start with your Common App personal statement."
            : `${done} of ${essays.length} finished`}
        </p>
        <div className="flex-1" />
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1099A1] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d848b]"
          >
            <Plus size={15} />
            Add essay
          </button>
        )}
      </div>

      {adding && (
        <div className="space-y-4 rounded-xl border border-[#e9edef] p-4 dark:border-[#2a3942]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="essay-title">Title</FieldLabel>
              <input
                id="essay-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Why Hopkins? supplement'
                className={input}
              />
            </div>
            <div>
              <FieldLabel hint="Leave as Common App if this is your main personal statement, which every college sees.">
                For which college
              </FieldLabel>
              <Dropdown
                value={schoolId}
                onChange={setSchoolId}
                options={[
                  { value: "", label: "Common App (all colleges)" },
                  ...schools.map((s) => ({ value: s.id, label: s.school_name })),
                ]}
                buttonClassName="h-11 rounded-xl text-[14px] font-normal"
                ariaLabel="College this essay is for"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              className="h-10 rounded-xl px-3 text-[14px] font-medium text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!title.trim() || saving}
              className="h-10 rounded-xl bg-[#1099A1] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0d848b] disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {essays.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-[#e9edef] py-12 text-center dark:border-[#2a3942]">
          <p className="text-[14px] text-[#111] dark:text-white">No essays yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[#717182]">
            Add one and Yakal creates a Google Doc your counselor can comment on.
          </p>
        </div>
      ) : (
        <>
          <Group
            title="Personal statement"
            essays={core}
            schools={schools}
            onStatusChange={onStatusChange}
            onCreateDoc={onCreateDoc}
            creatingDoc={creatingDoc}
          />
          <Group
            title="Supplements"
            essays={supplements}
            schools={schools}
            onStatusChange={onStatusChange}
            onCreateDoc={onCreateDoc}
            creatingDoc={creatingDoc}
          />
        </>
      )}
    </div>
  );
}

function Group({
  title,
  essays,
  schools,
  onStatusChange,
  onCreateDoc,
  creatingDoc,
}: {
  title: string;
  essays: Essay[];
  schools: CollegeListItem[];
  onStatusChange: (id: string, s: EssayStatus) => void;
  onCreateDoc: (e: Essay) => void;
  creatingDoc: string | null;
}) {
  if (essays.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
        {title}
        <span className="tabular-nums text-[#a8adb8]">{essays.length}</span>
      </h3>
      <div className="space-y-2">
        {essays.map((e) => {
          const school = schools.find((s) => s.id === e.college_list_item_id);
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#182229]"
            >
              <FileText size={17} className="shrink-0 text-[#717182]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] text-[#111] dark:text-white">
                  {e.title}
                </div>
                <div className="truncate text-[12px] text-[#717182]">
                  {school ? school.school_name : "Every college"}
                  {e.due_date && ` · due ${new Date(e.due_date).toLocaleDateString()}`}
                </div>
              </div>

              {e.drive_url ? (
                <a
                  href={e.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#1099A1] hover:underline"
                  )}
                >
                  Open doc
                  <ExternalLink size={12} />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => onCreateDoc(e)}
                  disabled={creatingDoc === e.id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#e9edef] px-2.5 py-1.5 text-[12px] font-medium text-[#54656f] transition-colors hover:border-[#1099A1] hover:text-[#1099A1] disabled:opacity-50 dark:border-[#2a3942] dark:text-[#aebac1]"
                >
                  {creatingDoc === e.id && <Loader2 size={12} className="animate-spin" />}
                  Create doc
                </button>
              )}

              <Dropdown
                value={e.status}
                onChange={(v) => onStatusChange(e.id, v as EssayStatus)}
                options={STATUS}
                size="sm"
                align="end"
                className="w-[150px] shrink-0"
                buttonClassName="font-normal"
                ariaLabel={`Status for ${e.title}`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
