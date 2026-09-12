import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { AvatarStack } from "@/components/college/AvatarStack";
import { College } from "@/services/collegeCatalogService";
import { CaseloadRow } from "@/services/counselorService";

/**
 * Every student on one screen, ordered by who needs the counsellor next.
 *
 * The home page used to lead with the eight soonest deadlines across everybody,
 * which is a list of applications rather than a list of people: the same
 * student appeared three times, and a student with nine colleges and nothing
 * done could be missing from it entirely. A caseload is people.
 *
 * One row each, full width, because the useful comparison runs down the column:
 * whose bar is short, whose date is red, who has essays sitting.
 */

/**
 * What "priority" means here, in order.
 *
 * A deadline that has passed is not urgent any more, it is a conversation, so
 * it sorts to the top and says so rather than being ranked as though there were
 * still time. Then essays waiting, because that is work the counsellor owes
 * somebody today and nobody else can do it. Then the soonest deadline. A
 * student with no colleges is last: nothing is late, but they have not started,
 * and that is the other end of the same list.
 */
function rank(r: CaseloadRow): number {
  if (r.daysLeft !== null && r.daysLeft < 0) return -1000 + r.daysLeft;
  if (r.essaysWaiting > 0) return -100 - r.essaysWaiting;
  if (r.daysLeft !== null) return r.daysLeft;
  return 10_000;
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CaseloadList({
  rows,
  catalog,
  isLoading = false,
}: {
  rows: CaseloadRow[];
  /** For the crest beside each student, resolved by unitid. */
  catalog: College[];
  isLoading?: boolean;
}) {
  const navigate = useNavigate();

  const byUnitid = useMemo(
    () => new Map(catalog.map((c) => [c.unitid, c])),
    [catalog]
  );

  const ordered = useMemo(() => [...rows].sort((a, b) => rank(a) - rank(b)), [rows]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (ordered.length === 0) {
    return (
      <p className="py-16 text-center text-[14px] text-muted-foreground">
        No students yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {ordered.map((r) => {
        const college = r.nextDeadline?.unitid
          ? byUnitid.get(r.nextDeadline.unitid) ?? null
          : null;
        const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
        const late = r.daysLeft !== null && r.daysLeft < 0;
        const soon = r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 7;

        return (
          <button
            key={r.student.id}
            type="button"
            onClick={() => navigate(`/counselor/students/${r.student.id}`)}
            className="flex w-full items-center gap-4 px-2 py-3 text-left transition-colors hover:bg-muted/40"
          >
            <AvatarStack
              name={r.student.full_name}
              avatarUrl={r.student.avatar_url}
              collegeName={r.nextDeadline?.school ?? null}
              collegeLogo={college?.logo ?? null}
              // The catalog's domain when we know the college, the student's own
              // application link when we do not: an international college has no
              // unitid, so the catalog can never match it.
              collegeWebsite={college?.website ?? r.nextDeadline?.applicationUrl ?? null}
              size={40}
            />

            <div className="min-w-0 flex-1">
              <span className="block truncate text-[14px] text-foreground">
                {r.student.full_name}
              </span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {r.nextDeadline
                  ? r.nextDeadline.school
                  : r.colleges > 0
                    ? `${r.colleges} college${r.colleges === 1 ? "" : "s"}, no dates yet`
                    : "No colleges yet"}
              </span>
            </div>

            {/* The bar is the comparison. Down a column of students, a short
                one is the question worth asking about. */}
            <div className="hidden w-[160px] shrink-0 sm:block">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    pct >= 80 ? "bg-tertiary" : "bg-primary"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                {r.total > 0 ? `${r.done} of ${r.total} done` : "Nothing tracked yet"}
              </span>
            </div>

            {/* Work the counsellor owes, which outranks any date. Kept in the
                layout when there is none so the dates below stay in a column. */}
            <span
              className={cn(
                "hidden w-[110px] shrink-0 text-right text-[12px] sm:block",
                r.essaysWaiting > 0 ? "font-medium text-primary" : "invisible"
              )}
            >
              {r.essaysWaiting > 0
                ? `${r.essaysWaiting} essay${r.essaysWaiting === 1 ? "" : "s"} waiting`
                : "none"}
            </span>

            <span
              className={cn(
                "w-[76px] shrink-0 text-right text-[12px] tabular-nums",
                late
                  ? "font-medium text-[#d4183d]"
                  : soon
                    ? "font-medium text-secondary"
                    : "text-muted-foreground"
              )}
            >
              {r.nextDeadline
                ? late
                  ? "Passed"
                  : fmtDate(r.nextDeadline.date)
                : "-"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
