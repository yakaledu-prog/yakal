// ============================================================
// Turning the assignments the read-through already mapped into rows for the
// native assignments table, so a Classroom-defined piece of work has a local
// row a submission and a grade can point at (see the migration
// 20260814000100 and P2 in docs/architecture/google-classroom.md).
//
// Pure on purpose, and free of the googleapis client, so it can be checked
// without a network or a heavy import. api/_handlers/classroom.ts hands it the
// assignments it already shaped and the topics it read alongside them.
// ============================================================

export interface MappedAssignment {
  /** The Classroom courseWork id. Becomes assignments.external_id. */
  id: string;
  title: string;
  description: string | null;
  materials: { title: string; link: string | null }[];
  dueDate: string | null;
  maxPoints: number | null;
  link: string | null;
  topicId: string | null;
}

export interface AssignmentRow {
  course_id: string;
  // Not null: public.assignments requires a tutor, so the read-through only
  // mirrors a course that has one. A tutorless class shows its work through the
  // live read, it just gets no native row until a tutor is assigned.
  tutor_id: string;
  external_id: string;
  title: string;
  description: string | null;
  materials: { title: string; link: string | null }[];
  due_date: string | null;
  max_points: number | null;
  template_url: string | null;
  topic_id: string | null;
  topic_name: string | null;
  updated_at: string;
}

/**
 * One upsert row per assignment, keyed by external_id. The topic name is looked
 * up from the topics list so the native row can be grouped without a live read.
 */
export function assignmentUpsertRows(
  courseId: string,
  tutorId: string,
  assignments: MappedAssignment[],
  topics: { id: string; name: string }[],
  now: () => string = () => new Date().toISOString()
): AssignmentRow[] {
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const stamp = now();
  return assignments.map((a) => ({
    course_id: courseId,
    tutor_id: tutorId,
    external_id: a.id,
    title: a.title,
    description: a.description,
    materials: a.materials,
    due_date: a.dueDate,
    max_points: a.maxPoints,
    template_url: a.link,
    topic_id: a.topicId,
    topic_name: a.topicId ? topicName.get(a.topicId) ?? null : null,
    updated_at: stamp,
  }));
}
