import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  College,
  CONTROL_LABEL,
  Fit,
  FIT_LABEL,
  collegeImageUrl,
} from "@/services/collegeCatalogService";
import { FitBar } from "./FitBar";

// Solid fills, not tints. The chip sits on top of a photograph whose brightness
// we do not control, so a translucent wash is unreadable half the time.
const FIT_CHIP: Record<Fit, string> = {
  reach: "bg-secondary text-white",
  target: "bg-primary text-white",
  safety: "bg-[#3f4a52] text-white",
  unknown: "bg-black/55 text-white",
};

function money(v: number | null): string {
  return v === null ? "-" : `$${v.toLocaleString()}`;
}

/**
 * A card is a claim about a school, so every number on it comes from the
 * Scorecard record. Fields with no data render a dash rather than being hidden,
 * so a sparse school looks sparse instead of looking like a different school.
 */
export function CollegeCard({
  college,
  fit,
  sat,
  onAdd,
  isAdded,
  onOpen,
}: {
  college: College;
  fit: Fit;
  sat: number | null | undefined;
  onAdd: (c: College) => void;
  isAdded: boolean;
  onOpen: (c: College) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const img = imgFailed ? null : collegeImageUrl(college.image, 640);

  return (
    <div className="group flex flex-col overflow-hidden rounded-sm border border-[#e9edef] bg-white transition-colors hover:border-[#cbd5d8] dark:border-[#2a3942] dark:bg-[#111b21] dark:hover:border-[#3a4a52]">
      <button
        type="button"
        onClick={() => onOpen(college)}
        className="relative block aspect-[16/9] w-full overflow-hidden bg-[#f3f3f5] text-left dark:bg-[#1c2a32]"
      >
        {img ? (
          <img
            src={img}
            alt={college.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          // Online-only institutions have no campus to photograph. A typographic
          // tile is honest and reads better than a stock building.
          <div className="flex h-full w-full items-center justify-center px-4">
            <span className="text-center text-[13px] font-semibold leading-tight text-[#8a8a99]">
              {college.name}
            </span>
          </div>
        )}
        {/* No chip at all when we cannot judge fit. Stamping "no data" on every
            card is noise, and it is loudest before the student has entered the
            scores that would make the whole feature work. */}
        {fit !== "unknown" && (
          <span
            className={cn(
              "absolute right-2 top-2 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] shadow-sm",
              FIT_CHIP[fit]
            )}
          >
            {FIT_LABEL[fit]}
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <button type="button" onClick={() => onOpen(college)} className="text-left">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground">
            {college.name}
          </h3>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {[college.city, college.state].filter(Boolean).join(", ")}
            {college.control && ` - ${CONTROL_LABEL[college.control]}`}
          </p>
        </button>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <Stat label="Admit rate" value={college.admitRate === null ? "-" : `${college.admitRate}%`} />
          <Stat label="Net price" value={money(college.netPrice)} suffix="/yr" />
        </div>

        <FitBar college={college} sat={sat} />

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#e9edef] pt-2.5 dark:border-[#2a3942]">
          <span className="truncate text-[11px] tabular-nums text-muted-foreground">
            {college.undergrads !== null
              ? `${college.undergrads.toLocaleString()} undergrads`
              : "Enrollment not reported"}
          </span>
          <button
            type="button"
            onClick={() => onAdd(college)}
            disabled={isAdded}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-sm px-2.5 py-1.5 text-[12px] font-semibold transition-colors",
              isAdded
                ? "border border-[#e9edef] text-[#0d757b] dark:border-[#2a3942] dark:text-[#5fc9cf]"
                : "bg-primary text-white hover:bg-primary-hover"
            )}
          >
            {isAdded ? <Check size={13} /> : <Plus size={13} />}
            {isAdded ? "Added" : "Add"}
          </button>
        </div>

        {/* CC BY and CC BY-SA both require visible credit. 873 of our 1,216
            photos carry that condition, so this line is not optional. */}
        {img && college.credit && (
          <p className="truncate text-[10px] leading-none text-muted-foreground/70">
            Photo: {college.credit} / Wikimedia Commons
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="text-[14px] font-semibold tabular-nums text-foreground">
        {value}
        {suffix && value !== "-" && (
          <span className="text-[11px] font-normal text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}
