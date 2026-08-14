import { Check, Minus } from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem } from "@/services/collegeService";
import {
  ReqCell,
  ReqKey,
  REQUIREMENTS,
  StudentContext,
  completion,
  requirementsFor,
} from "@/services/requirementsService";
import { InfoHint } from "@/components/ui/InfoHint";

const ROUND_LABEL: Record<string, string> = {
  ed1: "ED", ed2: "ED II", ea: "EA", rea: "REA", rd: "RD", rolling: "Rolling",
};

function daysUntil(iso: string) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/**
 * Colleges as rows, the eight requirements as columns.
 *
 * A per-college card list cannot show that "recommendations submitted" is empty
 * across every single college, which is exactly the pattern worth catching. The
 * matrix makes that a vertical stripe you notice without reading anything.
 */
export function RequirementsMatrix({
  schools,
  ctx,
  onToggle,
  canEdit = true,
}: {
  schools: CollegeListItem[];
  ctx: StudentContext;
  onToggle: (school: CollegeListItem, key: ReqKey, next: boolean) => void;
  /** False for a viewer who may read the tracker but not change it. */
  canEdit?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-[#e9edef] dark:border-[#2a3942]">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-[#e9edef] dark:border-[#2a3942]">
              <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left text-[12px] font-medium text-[#717182] dark:bg-[#182229]">
                College
              </th>
              {REQUIREMENTS.map((r) => (
                <th key={r.key} className="px-2 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#717182]">
                    {r.short}
                    <InfoHint text={r.label} size={11} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => {
              const cells = requirementsFor(s, ctx);
              const done = completion(cells);
              const days = s.deadline ? daysUntil(s.deadline) : null;
              const urgent = days !== null && days >= 0 && days <= 14;

              return (
                <tr
                  key={s.id}
                  className="border-b border-[#e9edef] last:border-0 dark:border-[#2a3942]"
                >
                  <td className="sticky left-0 z-10 min-w-[240px] bg-white px-4 py-3 dark:bg-[#182229]">
                    <div className="truncate text-[14px] text-[#111] dark:text-white">
                      {s.school_name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[#717182]">
                      <span className="tabular-nums">
                        {done.done}/{done.total}
                      </span>
                      {s.deadline && (
                        <>
                          <span aria-hidden>·</span>
                          <span
                            className={cn(
                              "tabular-nums",
                              urgent && "text-[#d4183d]"
                            )}
                          >
                            {s.deadline_round ? `${ROUND_LABEL[s.deadline_round]} ` : ""}
                            {days !== null && days >= 0
                              ? `${days}d left`
                              : "closed"}
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {cells.map((c) => (
                    <td key={c.key} className="px-2 py-3 text-center">
                      <Cell
                        cell={c}
                        onClick={
                          canEdit
                            ? () => onToggle(s, c.key, c.status !== "done")
                            : undefined
                        }
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Legend />
    </div>
  );
}

function Cell({ cell, onClick }: { cell: ReqCell; onClick?: () => void }) {
  const { status, derived, reason, progress } = cell;

  if (status === "not_required") {
    return (
      <span
        title={reason}
        className="inline-grid h-7 w-7 place-items-center text-[#c2c7d0]"
      >
        <Minus size={13} />
      </span>
    );
  }

  const pct = progress && progress.total > 0 ? progress.done / progress.total : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={reason}
      aria-label={reason}
      className={cn(
        "group inline-flex flex-col items-center gap-0.5",
        !onClick && "cursor-default"
      )}
    >
      <span
        className={cn(
          "relative grid h-7 w-7 place-items-center overflow-hidden rounded-md border transition-colors",
          status === "done"
            ? "border-primary bg-primary text-white"
            : status === "partial"
              ? "border-primary text-primary"
              : cn(
                "border-[#dfe3e6] text-transparent dark:border-[#3a4a52]",
                onClick && "group-hover:border-primary"
              ),
          // A dashed edge marks a value the system worked out, so a student can
          // tell at a glance which ticks are theirs and which are ours. On a
          // filled square the border is invisible against the fill, so the
          // dashes move inside as a light outline instead.
          derived &&
            (status === "done"
              ? "outline-1 outline-dashed outline-offset-[-3px] outline-white/80"
              : "border-dashed")
        )}
      >
        {status === "partial" && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 bg-primary/20"
            style={{ height: `${Math.round(pct * 100)}%` }}
          />
        )}
        {status === "done" && <Check size={14} strokeWidth={2.5} />}
      </span>
      {progress && progress.total > 1 && (
        <span className="text-[10px] tabular-nums text-[#a8adb8]">
          {progress.done}/{progress.total}
        </span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[#717182]">
      <span className="inline-flex items-center gap-1.5">
        <span className="grid h-4 w-4 place-items-center rounded border border-primary bg-primary text-white">
          <Check size={10} strokeWidth={3} />
        </span>
        Done
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-4 rounded border border-dashed border-primary" />
        Filled in from your profile
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-4 w-4 rounded border border-[#dfe3e6] dark:border-[#3a4a52]" />
        Not started
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Minus size={12} className="text-[#c2c7d0]" />
        Not required
      </span>
      <span className="ml-auto">Hover any square for why. Click to override.</span>
    </div>
  );
}
