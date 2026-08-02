import { useState } from "react";
import { ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { College, collegeImageUrl, computeFit, StudentProfile } from "@/services/collegeCatalogService";
import { CollegeListItem, SchoolStatus } from "@/services/collegeService";
import { Dropdown } from "@/components/ui/Dropdown";
import { VerifiedBadge } from "./VerifiedBadge";
import { FitBar } from "./FitBar";

const STATUS = [
  { value: "considering" as const, label: "Researching" },
  { value: "applying" as const, label: "Applying" },
  { value: "submitted" as const, label: "Submitted" },
  { value: "accepted" as const, label: "Accepted" },
  { value: "waitlisted" as const, label: "Waitlisted" },
  { value: "denied" as const, label: "Denied" },
  { value: "enrolled" as const, label: "Enrolled" },
];

const ROUND_LABEL: Record<string, string> = {
  ed1: "ED", ed2: "ED II", ea: "EA", rea: "REA", rd: "RD", rolling: "Rolling",
};

function daysUntil(iso: string): number {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function CollegeListRow({
  item,
  college,
  student,
  addedByName,
  onStatusChange,
  onRemove,
  canEdit = true,
}: {
  item: CollegeListItem;
  /** Catalog match, absent for manually added colleges. */
  college: College | null;
  student: StudentProfile;
  /** Who put this on the list, when it was not the student themselves. */
  addedByName?: string | null;
  onStatusChange: (id: string, status: SchoolStatus) => void;
  onRemove: (item: CollegeListItem) => void;
  /**
   * False for a viewer who may look but not change, such as a parent reading
   * their child's list. The controls are not rendered at all rather than
   * disabled: a parent's row level security would reject the write anyway, so
   * a greyed-out dropdown would only promise something that cannot happen.
   */
  canEdit?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const img = college ? collegeImageUrl(college.image, 160) : null;

  const days = item.deadline ? daysUntil(item.deadline) : null;
  const urgent = days !== null && days >= 0 && days <= 14;
  const past = days !== null && days < 0;

  const verified = !!item.verified_by;

  // The student's own filing versus what their scores say. Surfacing the gap is
  // the point: it is what the counselor is being paid to settle.
  const computed = college ? computeFit(college, student) : null;
  const declared =
    item.tier === "dream" ? "reach" : item.tier === "safety" ? "safety" : "target";
  const mismatch =
    computed && computed !== "unknown" && computed !== declared ? computed : null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e9edef] bg-white p-3 transition-colors hover:border-[#cbd5d8] dark:border-[#2a3942] dark:bg-[#182229] dark:hover:border-[#3a4a52]">
      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f3f3f5] dark:bg-[#1c2a32]">
        {img ? (
          <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center px-1 text-center text-[9px] leading-tight text-[#a8adb8]">
            {item.school_name.slice(0, 24)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h4 className="truncate text-[15px] font-medium text-[#111] dark:text-white">
            {item.school_name}
          </h4>
          {item.application_url && (
            <a
              href={item.application_url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-[#a8adb8] transition-colors hover:text-[#1099A1]"
              aria-label="Open admissions page"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <p className="truncate text-[12px] text-[#717182]">
          {college
            ? [college.city, college.state].filter(Boolean).join(", ")
            : "Not in the federal catalog"}
          {mismatch && (
            <span className="text-[#8a6a2f] dark:text-[#e0c48a]">
              {" - "}looks like a {mismatch} for you
            </span>
          )}
          {/* Only when somebody else put it here. A college appearing on a
              student's list with no explanation is a support question; saying
              who added it answers it before it is asked. */}
          {addedByName && (
            <span className="text-[#717182]">{" - "}added by {addedByName}</span>
          )}
        </p>
      </div>

      <div className="hidden w-[150px] shrink-0 md:block">
        {item.deadline ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] tabular-nums text-[#111] dark:text-white">
                {item.deadline_round ? `${ROUND_LABEL[item.deadline_round]} ` : ""}
                {new Date(item.deadline).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <VerifiedBadge provenance={verified ? "verified" : "unverified"} size={12} />
            </div>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                past ? "text-[#717182]" : urgent ? "text-[#d4183d]" : "text-[#717182]"
              )}
            >
              {past ? "Closed" : days === 0 ? "Due today" : `${days} days left`}
            </span>
          </>
        ) : (
          <span className="text-[12px] text-[#a8adb8]">No deadline yet</span>
        )}
      </div>

      <div className="hidden w-[110px] shrink-0 lg:block">
        <div className="text-[13px] tabular-nums text-[#111] dark:text-white">
          {college?.netPrice != null ? `$${college.netPrice.toLocaleString()}` : "-"}
        </div>
        <div className="text-[11px] text-[#717182]">net / yr</div>
      </div>

      <div className="hidden w-[120px] shrink-0 xl:block">
        {college ? (
          <FitBar college={college} sat={student.sat} showLabels={false} />
        ) : (
          <span className="text-[11px] text-[#a8adb8]">-</span>
        )}
      </div>

      {canEdit ? (
        <Dropdown
          value={item.status}
          onChange={(v) => onStatusChange(item.id, v as SchoolStatus)}
          options={STATUS}
          size="sm"
          align="end"
          className="w-[130px] shrink-0"
          buttonClassName="font-normal"
          ariaLabel={`Status for ${item.school_name}`}
        />
      ) : (
        <span className="w-[130px] shrink-0 text-[13px] text-[#54656f] dark:text-[#aebac1]">
          {STATUS.find((s) => s.value === item.status)?.label ?? item.status}
        </span>
      )}

      {canEdit && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            onBlur={() => setTimeout(() => setMenu(false), 150)}
            aria-label={`More options for ${item.school_name}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#a8adb8] transition-colors hover:bg-[#f3f3f5] hover:text-[#111] dark:hover:bg-[#1c2a32] dark:hover:text-white"
          >
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <div className="absolute right-0 top-9 z-20 w-40 rounded-lg border border-[#e9edef] bg-white py-1 shadow-lg dark:border-[#2a3942] dark:bg-[#202c33]">
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#d4183d] transition-colors hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
