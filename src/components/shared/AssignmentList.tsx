import { useState } from "react";
import { CalendarDays, ChevronDown, ExternalLink, Loader2, Paperclip } from "lucide-react";

import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

// ============================================================
// Assignments, read only.
//
// Google Classroom owns this work: it is where the assignment was written,
// where the student turns it in, and where the tutor marks it. This shows what
// is there and links out for anything that changes it, which is why there is
// no edit, no submit and no grade box anywhere in here.
//
// Shared by the student's course tasks and the tutor's assignment list. What
// differs between them is only the footer: a student sees their own grade, a
// tutor sees who has turned it in.
//
// Collapsed by default. A course with a term of work behind it was a page you
// scrolled for a minute to find the thing due on Friday; closed, the whole
// term fits on one screen and opens where you need it.
// ============================================================

export interface AssignmentMaterial {
  title: string;
  link: string | null;
}

export interface AssignmentSubmitter {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AssignmentItem {
  id: string;
  /** Position in the course, as Classroom orders it. */
  index: number;
  title: string;
  /** Classroom stores this as plain text. Newlines are all the structure there is. */
  description: string | null;
  materials: AssignmentMaterial[];
  /** ISO date, or null for an assignment with no deadline. */
  dueDate: string | null;
  maxPoints: number | null;
  /** The Classroom page for this assignment. */
  link: string | null;
  /** The student's own grade, on a student's list. */
  grade?: number | null;
  /** Whether this student has turned it in. Undefined on a tutor's list. */
  isSubmitted?: boolean;
}

/**
 * Database rows to list items.
 *
 * The tutor's view of a student and the parent's view of a child both build
 * this same object from their own service's row type, field for field. The two
 * row types are structurally identical, so this is one function rather than the
 * same twelve lines drifting apart in two files.
 *
 * The index is positional: these lists arrive already sorted by deadline, so it
 * numbers what the reader sees rather than anything stored.
 */
export function toAssignmentItems(
  rows: Omit<AssignmentItem, "index">[]
): AssignmentItem[] {
  return rows.map((row, i) => ({ ...row, index: i + 1 }));
}

/**
 * Classroom descriptions are plain text with newlines, so a blank line is a
 * paragraph and a leading dash is a bullet. Anything cleverer would be
 * inventing structure the source does not have.
 */
function DescriptionText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());

  return (
    <div className="space-y-2 text-[14px] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const bulleted = lines.length > 0 && lines.every((l) => /^[-*•]\s/.test(l));

        if (bulleted) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^[-*•]\s/, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

/** Up to four faces and a count, so a busy assignment stays one line. */
function SubmitterStack({ people }: { people: AssignmentSubmitter[] }) {
  const shown = people.slice(0, 4);
  const rest = people.length - shown.length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <img
            key={p.id}
            src={p.avatarUrl || dicebearUrl(p.name)}
            alt={p.name}
            title={p.name}
            className="h-7 w-7 rounded-full object-cover ring-2 ring-card"
          />
        ))}
      </div>
      <span className="text-[13px] text-muted-foreground">
        {people.length} turned in{rest > 0 ? ` (+${rest} more)` : ""}
      </span>
    </div>
  );
}

export function AssignmentList({
  assignments,
  isLoading = false,
  emptyText = "No assignments yet.",
  /** Everyone who has turned each one in, keyed by assignment id. */
  submittersById,
  /** Given, the submitter row becomes a way into the detail. */
  onOpenSubmissions,
  className,
}: {
  assignments: AssignmentItem[];
  isLoading?: boolean;
  emptyText?: string;
  submittersById?: Record<string, AssignmentSubmitter[]>;
  onOpenSubmissions?: (assignment: AssignmentItem) => void;
  className?: string;
}) {
  // The first one is open and the rest are closed, so the page opens on
  // something to read rather than on a list of titles.
  //
  // Only what has been clicked is stored, and the default is worked out per
  // row. Seeding a set with the first id would need the assignments to have
  // arrived before the state existed, which on a slow query they have not.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const isOpen = (id: string, index: number) => toggled[id] ?? index === 0;
  const toggle = (id: string, index: number) =>
    setToggled((current) => ({ ...current, [id]: !isOpen(id, index) }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return <p className="py-16 text-center text-[14px] text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className={cn("space-y-3 pb-8", className)}>
      {assignments.map((a, index) => {
        // Done is the exception worth colouring. Everything else is simply
        // outstanding, and tinting most of a list tells nobody anything.
        const done = a.isSubmitted === true || a.grade != null;
        const submitters = submittersById?.[a.id] ?? [];
        const open = isOpen(a.id, index);

        return (
          <article
            key={a.id}
            className={cn(
              "overflow-hidden rounded border",
              done ? "border-primary/30" : "border-border"
            )}
          >
            <header
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3",
                open && "border-b",
                done
                  ? "border-primary/30 bg-primary/10"
                  : "border-border bg-muted/40"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(a.id, index)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <ChevronDown
                  size={17}
                  className={cn(
                    "shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                />
                <span className="min-w-0 truncate text-[16px] text-foreground">
                  {a.index}. {a.title}
                </span>
                {/* Closed, the row still has to answer when it is due and how
                    it went, or it is only a title to click hopefully. */}
                {!open && (
                  <span className="ml-auto hidden shrink-0 items-center gap-4 pl-3 text-[13px] text-muted-foreground sm:flex">
                    {a.dueDate && (
                      <span>
                        Due{" "}
                        {new Date(`${a.dueDate}T00:00:00`).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    {a.grade != null && (
                      <span className="text-primary">
                        {a.grade}
                        {a.maxPoints != null && ` / ${a.maxPoints}`}
                      </span>
                    )}
                  </span>
                )}
              </button>

              {a.link && open && (
                <a
                  href={a.link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
                >
                  <ExternalLink size={16} /> Open in Google Classroom
                </a>
              )}
            </header>

            {open && (
              <div className="flex flex-col gap-4 px-4 py-4">
                <div className="text-foreground">
                  {a.description ? (
                    <DescriptionText text={a.description} />
                  ) : (
                    <p className="text-[14px] text-muted-foreground">No description.</p>
                  )}

                  {a.materials.length > 0 && (
                    <div className="mt-4">
                      <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
                        Materials
                      </h4>
                      <div className="space-y-2">
                        {a.materials.map((m, i) => (
                          <a
                            key={i}
                            href={m.link ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center text-[14px] font-medium text-primary hover:underline"
                          >
                            <Paperclip size={15} className="mr-2 text-muted-foreground" />
                            {m.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {a.dueDate && (
                    <div className="mt-4 flex items-center text-[13px] text-muted-foreground">
                      <CalendarDays size={16} className="mr-2" />
                      Due Date:{" "}
                      <span className="ml-1 text-foreground">
                        {new Date(`${a.dueDate}T00:00:00`).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* A student's grade and a tutor's roster of submitters are the
                  same slot: what happened to this assignment. */}
                {a.grade != null && (
                  <div className="flex items-center justify-between border-t border-primary/30 pt-3">
                    <span className="text-[13px] uppercase tracking-wider text-muted-foreground">
                      Grade
                    </span>
                    <span className="text-[15px] text-primary">
                      {a.grade}
                      {a.maxPoints != null && ` / ${a.maxPoints}`}
                    </span>
                  </div>
                )}

                {submittersById && (
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    {submitters.length === 0 ? (
                      <span className="text-[13px] text-muted-foreground">Nobody has turned this in yet</span>
                    ) : (
                      <SubmitterStack people={submitters} />
                    )}

                    {onOpenSubmissions && submitters.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenSubmissions(a)}
                        className="text-[13px] font-medium text-primary hover:underline"
                      >
                        View submissions
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
