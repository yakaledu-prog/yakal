import { Trophy, Users } from "lucide-react";

import { cn } from "@/utils/cn";
import { EntryAccordion, Section, SectionEmpty, period } from "@/components/shared/ResumeParts";
import {
  MAX_ACTIVITIES,
  MAX_HONORS,
  type StudentActivity,
  type StudentHonor,
} from "@/services/collegeService";

// ============================================================
// What a student did outside class.
//
// The same shape as TutorResume, deliberately: a tutor's certifications and a
// student's activities are the same object on the screen, and a second list
// that almost matched would have drifted the first time either gained a field.
//
// Both sections carry the Common App cap. Past it the add link becomes the
// count, because an eleventh activity is one the student cannot submit and
// finding that out in January is worse than not being offered the box.
// ============================================================

export type StudentSection = "activities" | "honors";

/**
 * Role, organisation and hours on one line.
 *
 * Joined rather than three fixed slots, so a student who gave only the
 * organisation does not get a line of leading separators.
 */
function subtitle(parts: (string | undefined)[]): string | undefined {
  return parts.filter(Boolean).join(" \u00b7 ") || undefined;
}

/**
 * A page of entries that is not there yet, with an award on it.
 *
 * Drawn here rather than taken from the icon set, the same reasoning as the
 * document glyph in ResumePanel: this stands in for the content, so it wants
 * to read as a picture rather than as another interface icon at the weight of
 * the buttons around it. currentColor throughout, so it takes the theme.
 */
function NothingYet() {
  return (
    <svg
      width="128"
      height="104"
      viewBox="0 0 128 104"
      fill="none"
      aria-hidden="true"
      className="mx-auto text-muted-foreground"
    >
      <g className="text-muted-foreground" opacity="0.55">
        <rect
          x="20"
          y="10"
          width="62"
          height="80"
          rx="7"
          stroke="currentColor"
          strokeWidth="2"
        />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7">
          <path d="M33 30h36" />
          <path d="M33 42h36" />
          <path d="M33 54h22" />
        </g>
      </g>

      {/* The award, in the brand teal, so the drawing says what the section is
          for rather than just "a page". */}
      <g className="text-primary">
        <path
          d="M79 78l7-9 7 9-7 4-7-4Z"
          fill="currentColor"
          fillOpacity="0.25"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle
          cx="86"
          cy="58"
          r="17"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M86 49.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9 2.6-5.3Z"
          fill="currentColor"
          fillOpacity="0.55"
        />
      </g>
    </svg>
  );
}

export function StudentActivities({
  activities,
  honors,
  emptyText = "This student has not filled in their activities yet.",
  /** Given, each section offers a way to add to it and each entry to remove itself. */
  onAdd,
  onRemove,
  className,
}: {
  activities: StudentActivity[];
  honors: StudentHonor[];
  emptyText?: string;
  onAdd?: (section: StudentSection) => void;
  onRemove?: (section: StudentSection, index: number) => void;
  className?: string;
}) {
  // Somebody else's empty list is a sentence. Your own is two headings and two
  // ways to start filling them, because the point of the page is doing it.
  if (activities.length === 0 && honors.length === 0 && !onAdd) {
    return (
      <div className="py-14 text-center">
        <NothingYet />
        <p className="mt-5 text-[14px] text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  const activitiesFull = activities.length >= MAX_ACTIVITIES;
  const honorsFull = honors.length >= MAX_HONORS;

  return (
    <div className={cn("space-y-10", className)}>
      <Section
        icon={<Users size={18} />}
        title="Activities"
        addLabel="Add an activity"
        onAdd={onAdd && !activitiesFull ? () => onAdd("activities") : undefined}
        note={onAdd && activitiesFull ? `${MAX_ACTIVITIES} of ${MAX_ACTIVITIES}, the Common App limit` : undefined}
      >
        <div>
          {activities.length === 0 && <SectionEmpty />}
          {activities.map((a, i) => (
            <EntryAccordion
              key={i}
              when={period(a.from, a.to)}
              title={a.activity}
              subtitle={subtitle([a.role, a.organisation, a.hours])}
              body={a.summary}
              onRemove={onRemove && (() => onRemove("activities", i))}
            />
          ))}
        </div>
      </Section>

      <Section
        icon={<Trophy size={18} />}
        title="Honors and awards"
        addLabel="Add an honor"
        onAdd={onAdd && !honorsFull ? () => onAdd("honors") : undefined}
        note={onAdd && honorsFull ? `${MAX_HONORS} of ${MAX_HONORS}, the Common App limit` : undefined}
      >
        <div>
          {honors.length === 0 && <SectionEmpty />}
          {honors.map((h, i) => (
            <EntryAccordion
              key={i}
              when={h.year}
              title={h.title}
              subtitle={h.level}
              onRemove={onRemove && (() => onRemove("honors", i))}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}
