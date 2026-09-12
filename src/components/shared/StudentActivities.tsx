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
    return <p className="py-16 text-center text-[14px] text-muted-foreground">{emptyText}</p>;
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
