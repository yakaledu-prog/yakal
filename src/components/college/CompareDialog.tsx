import { createPortal } from "react-dom";
import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";
import { College, CONTROL_LABEL, FIT_LABEL, StudentProfile, computeFit } from "@/services/collegeCatalogService";
import { CollegeListItem } from "@/services/collegeService";

export interface CompareRow {
  item: CollegeListItem;
  college: College | null;
}

/**
 * Colleges as columns, attributes as rows.
 *
 * The transpose matters: comparing means reading one attribute across several
 * colleges, and a list of cards forces you to hold four numbers in your head to
 * do it. Cells that stand out from the rest of their row are highlighted,
 * because the useful question is "which of these is the cheapest" rather than
 * "what does each of these cost".
 */
export function CompareDialog({
  open,
  rows,
  student,
  onClose,
}: {
  open: boolean;
  rows: CompareRow[];
  student: StudentProfile;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const money = (v: number | null | undefined) =>
    v == null ? "-" : `$${v.toLocaleString()}`;

  /** Best value in a row, so the winner can be marked without a legend. */
  const best = (pick: (r: CompareRow) => number | null | undefined, lowest: boolean) => {
    const vals = rows.map(pick).filter((v): v is number => v != null);
    if (vals.length < 2) return null;
    return lowest ? Math.min(...vals) : Math.max(...vals);
  };

  const bestNet = best((r) => r.college?.netPrice, true);
  const bestGrad = best((r) => r.college?.gradRate, false);
  const bestAdmit = best((r) => r.college?.admitRate, false);

  const ATTRS: {
    label: string;
    render: (r: CompareRow) => React.ReactNode;
    highlight?: (r: CompareRow) => boolean;
  }[] = [
    {
      label: "Fit",
      render: (r) => (r.college ? FIT_LABEL[computeFit(r.college, student)] : "-"),
    },
    {
      label: "Category",
      render: (r) =>
        r.item.tier === "dream" ? "Reach" : r.item.tier === "safety" ? "Safety" : "Target",
    },
    {
      label: "Deadline",
      render: (r) =>
        r.item.deadline
          ? new Date(r.item.deadline).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "-",
    },
    {
      label: "Net price / yr",
      render: (r) => money(r.college?.netPrice),
      highlight: (r) => bestNet != null && r.college?.netPrice === bestNet,
    },
    { label: "Sticker / yr", render: (r) => money(r.college?.cost) },
    {
      label: "Admit rate",
      render: (r) => (r.college?.admitRate == null ? "-" : `${r.college.admitRate}%`),
      highlight: (r) => bestAdmit != null && r.college?.admitRate === bestAdmit,
    },
    {
      label: "SAT middle 50",
      render: (r) =>
        r.college?.satLow ? `${r.college.satLow}-${r.college.satHigh}` : "Not reported",
    },
    {
      label: "Graduation rate",
      render: (r) => (r.college?.gradRate == null ? "-" : `${r.college.gradRate}%`),
      highlight: (r) => bestGrad != null && r.college?.gradRate === bestGrad,
    },
    {
      label: "Student-faculty",
      render: (r) => (r.college?.ratio == null ? "-" : `${r.college.ratio}:1`),
    },
    {
      label: "Undergrads",
      render: (r) => r.college?.undergrads?.toLocaleString() ?? "-",
    },
    {
      label: "Type",
      render: (r) => (r.college?.control ? CONTROL_LABEL[r.college.control] : "-"),
    },
    {
      label: "Supplements",
      render: (r) => r.item.supp_essay_count ?? "?",
    },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare colleges"
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-primary px-5 py-4 text-white">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[45%] text-white/10"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex-1">
              <h2 className="text-[16px] font-semibold">Compare</h2>
              <p className="text-[12px] text-white/80">
                {rows.length} colleges side by side
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-white/70 transition-colors hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse">
            {/* Teal, so the names read as the rest of the header rather than as
                a first row of the table. They stay table cells: the alignment
                with the column underneath is the whole point of a comparison,
                and a flex row in the header above would have to guess at
                widths the table decides. */}
            <thead className="sticky top-0 z-10 bg-primary text-white">
              <tr>
                <th className="sticky left-0 z-20 bg-primary px-4 py-3" />
                {rows.map((r) => (
                  <th
                    key={r.item.id}
                    className="min-w-[150px] px-4 py-3 text-left text-[13px] font-medium"
                  >
                    {r.item.school_name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATTRS.map((a) => (
                <tr
                  key={a.label}
                  className="border-b border-[#e9edef] last:border-0 dark:border-[#2a3942]"
                >
                  <th className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2.5 text-left text-[12px] font-normal text-[#717182] dark:bg-[#111b21]">
                    {a.label}
                  </th>
                  {rows.map((r) => (
                    <td
                      key={r.item.id}
                      className={cn(
                        "px-4 py-2.5 text-[13px] tabular-nums",
                        a.highlight?.(r)
                          ? "font-semibold text-primary"
                          : "text-[#111] dark:text-white"
                      )}
                    >
                      {a.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
}
