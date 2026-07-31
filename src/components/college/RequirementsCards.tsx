import { Check, Minus } from "lucide-react";
import { cn } from "@/utils/cn";
import { CollegeListItem, SchoolStatus } from "@/services/collegeService";
import {
  ReqCell,
  ReqKey,
  REQUIREMENTS,
  StudentContext,
  completion,
  requirementsFor,
} from "@/services/requirementsService";
import { Dropdown } from "@/components/ui/Dropdown";

const ROUND_LABEL: Record<string, string> = {
  ed1: "ED", ed2: "ED II", ea: "EA", rea: "REA", rd: "RD", rolling: "Rolling",
};

/** Only the outcomes belong here. Researching and Applying are not decisions. */
const DECISIONS: { value: string; label: string }[] = [
  { value: "", label: "No decision yet" },
  { value: "accepted", label: "Accepted" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "denied", label: "Denied" },
  { value: "enrolled", label: "Enrolling here" },
];

function daysUntil(iso: string) {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

/**
 * One card per college.
 *
 * Reads college by college, which is how a student works: they open this
 * asking what one college still needs, not to compare the same requirement
 * across nine. The matrix answers the opposite question and is kept beside this
 * for whoever needs it, which is mostly a counselor scanning for a gap that
 * runs the whole way down a column.
 */
export function RequirementsCards({
  schools,
  ctx,
  onToggle,
  onDecision,
  canEdit = true,
}: {
  schools: CollegeListItem[];
  ctx: StudentContext;
  onToggle: (school: CollegeListItem, key: ReqKey, next: boolean) => void;
  onDecision: (school: CollegeListItem, decision: SchoolStatus | null) => void;
  /** False for a viewer who may read the tracker but not change it. */
  canEdit?: boolean;
}) {
  return (
    <div className="space-y-3">
      {schools.map((s) => {
        const cells = requirementsFor(s, ctx);
        const done = completion(cells);
        const pct = done.total ? done.done / done.total : 0;
        const days = s.deadline ? daysUntil(s.deadline) : null;
        const urgent = days !== null && days >= 0 && days <= 14;
        const closed = days !== null && days < 0;

        const decided = ["accepted", "waitlisted", "denied", "enrolled"].includes(
          s.status
        )
          ? s.status
          : "";

        return (
          <div
            key={s.id}
            className="overflow-hidden rounded-xl border border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#182229]"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3">
              <h3 className="text-[15px] font-medium text-[#111] dark:text-white">
                {s.school_name}
              </h3>

              {s.deadline && (
                <span
                  className={cn(
                    "text-[12px] tabular-nums",
                    closed
                      ? "text-[#a8adb8]"
                      : urgent
                        ? "font-medium text-[#d4183d]"
                        : "text-[#717182]"
                  )}
                >
                  {s.deadline_round ? `${ROUND_LABEL[s.deadline_round]} · ` : ""}
                  {closed
                    ? "closed"
                    : days === 0
                      ? "due today"
                      : `${days} days left`}
                </span>
              )}

              <div className="flex-1" />

              <span className="text-[13px] tabular-nums text-[#717182]">
                {done.done}/{done.total}
              </span>

              {canEdit ? (
              <Dropdown
                value={decided}
                onChange={(v) => onDecision(s, (v || null) as SchoolStatus | null)}
                options={DECISIONS}
                size="sm"
                align="end"
                className="w-[160px]"
                buttonClassName={cn(
                  "font-normal",
                  decided === "accepted" || decided === "enrolled"
                    ? "border-[#1099A1]/40 font-medium text-[#1099A1]"
                    : decided === "denied"
                      ? "border-[#d4183d]/30 text-[#d4183d]"
                      : decided === "waitlisted"
                        ? "border-[#CAA25F]/40 text-[#8a6a2f]"
                        : ""
                )}
                ariaLabel={`Decision for ${s.school_name}`}
              />
              ) : (
                <span className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
                  {DECISIONS.find((d) => d.value === decided)?.label ?? "No decision yet"}
                </span>
              )}
            </div>

            {/* Inset and rounded rather than a rule welded to the card edges,
                which read as a border that had gone wrong. */}
            <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-[#f3f3f5] dark:bg-[#1c2a32]">
              <div
                className="h-full rounded-full bg-[#1099A1] transition-[width] duration-300"
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 p-3">
              {cells.map((c) => (
                <Chip
                  key={c.key}
                  cell={c}
                  onClick={canEdit ? () => onToggle(s, c.key, c.status !== "done") : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Chip({ cell, onClick }: { cell: ReqCell; onClick?: () => void }) {
  const label = REQUIREMENTS.find((r) => r.key === cell.key)?.label ?? cell.key;
  const { status, derived, reason, progress } = cell;

  if (status === "not_required") {
    return (
      <span
        title={reason}
        className="inline-flex items-center gap-1 rounded-full bg-[#f3f3f5] px-2.5 py-1 text-[12px] text-[#c2c7d0] line-through dark:bg-[#1c2a32]"
      >
        <Minus size={11} />
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={reason}
      aria-label={reason}
      aria-pressed={status === "done"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] transition-colors",
        // No hover affordance for a reader who cannot change it.
        !onClick && "cursor-default",
        status === "done"
          ? cn("bg-[#1099A1] font-medium text-white", onClick && "hover:bg-[#0d848b]")
          : status === "partial"
            ? cn("bg-[#1099A1]/12 font-medium text-[#0d757b] dark:text-[#5fc9cf]", onClick && "hover:bg-[#1099A1]/20")
            : cn("bg-[#f3f3f5] text-[#54656f] dark:bg-[#1c2a32] dark:text-[#aebac1]", onClick && "hover:bg-[#ececf0]"),
        // A dashed edge marks a value the system worked out rather than one
        // somebody ticked, so a student can tell whose claim it is.
        derived && status === "done" && "ring-1 ring-inset ring-dashed ring-white/60",
        derived && status !== "done" && "border border-dashed border-[#cbd5d8] dark:border-[#3a4a52]"
      )}
    >
      {status === "done" && <Check size={11} strokeWidth={3} />}
      {label}
      {progress && progress.total > 1 && status !== "done" && (
        <span className="tabular-nums opacity-70">
          {progress.done}/{progress.total}
        </span>
      )}
    </button>
  );
}
