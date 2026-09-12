import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/utils/cn";

// ============================================================
// The two pieces a CV-shaped list is made of.
//
// Pulled out of TutorResume so the student profile's activities and honors can
// be the same thing on the screen rather than a second list that almost
// matches. Rendered output is unchanged from where these lived before.
// ============================================================

/** "2016 - 2020", "2022 - Present", or nothing at all. */
export function period(from?: string, to?: string): string {
  if (!from && !to) return "";
  if (from && !to) return `${from} - Present`;
  if (!from) return to!;
  return `${from} - ${to}`;
}

export function Section({
  icon,
  title,
  onAdd,
  addLabel,
  /** Shown in place of the add link, for a section that has filled up. */
  note,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onAdd?: () => void;
  addLabel: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between border-b border-border pb-2">
        <span className="inline-flex items-center gap-2 border-b-2 border-primary pb-2 text-[16px] font-bold text-foreground">
          {icon} {title}
        </span>
        {note ? (
          <span className="pb-2 text-[13px] text-muted-foreground">{note}</span>
        ) : (
          onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="pb-2 text-[13px] font-medium text-primary transition-colors hover:underline"
            >
              {addLabel}
            </button>
          )
        )}
      </div>
      {children}
    </section>
  );
}

/** A dated row: the period on the left, the substance on the right. */
export function Entry({
  when,
  title,
  subtitle,
  body,
  onRemove,
}: {
  when: string;
  title: string;
  subtitle?: string;
  body?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="group flex flex-col gap-1 sm:flex-row sm:gap-4">
      <div className="w-32 shrink-0 pt-0.5 text-[14px] font-medium text-muted-foreground">
        {when}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[16px] font-bold text-foreground">{title}</h4>
        {subtitle && <p className="text-[14px] text-muted-foreground">{subtitle}</p>}
        {body && <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>}
      </div>
      {onRemove && (
        // Only on hover: a row of Remove links down the page reads as a form,
        // and this is a CV the rest of the time.
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 self-start text-[13px] text-muted-foreground opacity-0 transition-opacity hover:text-secondary focus:opacity-100 group-hover:opacity-100"
        >
          Remove
        </button>
      )}
    </div>
  );
}

/**
 * The same row, folded.
 *
 * Entry hangs the period in a fixed 128px gutter, which works for a CV where
 * every line is dated and reads as an empty indent where they are not: an
 * honor with no year left its title floating a third of the way across the
 * page. Here the title is flush and the detail is behind a disclosure, so a
 * list of ten activities is ten scannable lines rather than a wall.
 *
 * Remove moved inside the open panel for the reason it used to be hover-only:
 * a column of Remove links down the page reads as a form, and this is a CV the
 * rest of the time.
 */
export function EntryAccordion({
  when,
  title,
  subtitle,
  body,
  onRemove,
}: {
  when?: string;
  title: string;
  subtitle?: string;
  body?: string;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(subtitle || body || onRemove);

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => hasDetail && setOpen((o) => !o)}
          aria-expanded={hasDetail ? open : undefined}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left",
            hasDetail && "transition-colors hover:text-primary"
          )}
        >
          <ChevronRight
            size={16}
            aria-hidden="true"
            className={cn(
              "shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
              !hasDetail && "invisible"
            )}
          />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-foreground">
            {title}
          </span>
          {when && <span className="shrink-0 text-[13px] text-muted-foreground">{when}</span>}
        </button>

        {/* On the title's own line, and only while the row is open. A Remove
            beside every row is a column of them down the page, which reads as
            a form; this is a CV the rest of the time. */}
        {open && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-[13px] text-muted-foreground transition-colors hover:text-secondary"
          >
            Remove
          </button>
        )}
      </div>

      {open && (subtitle || body) && (
        <div className="space-y-2 pb-4 pl-7">
          {subtitle && <p className="text-[14px] text-muted-foreground">{subtitle}</p>}
          {body && <p className="text-[14px] leading-relaxed text-muted-foreground">{body}</p>}
        </div>
      )}
    </div>
  );
}

/** "Nothing added yet." under a section its owner has not filled in. */
export function SectionEmpty({ className }: { className?: string }) {
  return <p className={cn("text-[14px] text-muted-foreground", className)}>Nothing added yet.</p>;
}
