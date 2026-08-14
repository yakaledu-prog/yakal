import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { AssignmentList, type AssignmentItem } from "@/components/shared/AssignmentList";
import { LoadingPanel } from "@/components/shared/Spinner";
import { getCourseWorkFor } from "@/services/courseWork";
import { groupCourseWorkByTopic } from "@/utils/courseWorkTopics";

// ============================================================
// The work set on a course, wherever it was written.
//
// classroom-sync only ever pushed, from this database up to Google Classroom,
// and wrote the resulting page back to assignments.template_url. Nothing came
// the other way, so work written in Classroom itself, which is where a teacher
// writes it, existed nowhere this app could see.
//
// Read through our own server, not the browser. Reading it from here meant
// every viewer signing into Google first: a student needed an account, consent
// to Classroom scopes and membership of the class before they could see that
// homework existed, and a token that expired hourly. Now the server holds one
// credential for the account that owns the classes and checks who is asking.
// Booking a course is what grants access, which is the only thing a family
// should have to do.
//
// Shared by the admin, tutor and student course pages. The first version lived
// on the admin page alone, and two more pages needing it is how a third copy
// starts.
// ============================================================

export interface LocalAssignment extends AssignmentItem {
  /** The Classroom page the sync wrote back, when it has run for this row. */
  classroomUrl?: string | null;
}

export function CourseAssignments({
  courseId,
  localAssignments,
  isLoading = false,
  emptyText = "No work set on this course yet.",
}: {
  courseId: string;
  localAssignments: LocalAssignment[];
  isLoading?: boolean;
  emptyText?: string;
}) {
  const {
    data,
    isLoading: classroomLoading,
    error,
  } = useQuery({
    queryKey: ["course-classwork", courseId],
    queryFn: () => getCourseWorkFor(courseId),
    enabled: !!courseId,
    retry: false,
  });

  const classroom = data?.assignments ?? [];

  const merged = useMemo(() => {
    const fromClassroom = new Set(classroom.map((a) => a.link).filter(Boolean));
    // A local row the sync has already pushed is the same piece of work as the
    // Classroom entry it created, so only one of them belongs in the list.
    const localOnly = localAssignments.filter(
      (a) => !a.classroomUrl || !fromClassroom.has(a.classroomUrl)
    );
    return [...classroom, ...localOnly].map((a, i) => ({ ...a, index: i + 1 }));
  }, [classroom, localAssignments]);

  // The work grouped under its Classroom topic. Null when the class groups
  // nothing, in which case the render falls back to the flat merged list, so a
  // class that uses no topics reads exactly as it did before.
  const sections = useMemo(
    () => groupCourseWorkByTopic(merged, data?.topics ?? []),
    [data?.topics, merged]
  );

  // Only a tutor or admin is sent this, and only for a class that has students
  // on it. Undefined leaves the submitter row off entirely, which is what a
  // student and a parent see: their own state is on the assignment itself.
  const submitters = data?.submitters;

  if (isLoading || classroomLoading) {
    // Reading a class from Google is slower than a database read, and long
    // enough that a bare spinner leaves somebody wondering whether anything is
    // happening at all.
    return (
      <LoadingPanel
        label="Fetching the work set on this course"
        className="animate-in fade-in duration-300"
      />
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {data?.invalidLink && (
        <p className="mb-4 flex items-center gap-2 text-[13px] text-secondary">
          <TriangleAlert size={14} />
          That Google Classroom link is not a class URL, so nothing can be read from it.
        </p>
      )}

      {/* A failure here is worth naming rather than showing as an empty list:
          an empty list says the teacher set nothing, which is a different and
          much more reassuring claim than the truth. */}
      {error != null && (
        <p className="mb-4 flex items-center gap-2 text-[13px] text-secondary">
          <TriangleAlert size={14} />
          Google Classroom could not be reached, so anything set there is missing from this
          list.
        </p>
      )}

      {sections && sections.length > 0 ? (
        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.id}>
              <h4 className="mb-3 text-[15px] font-semibold text-foreground">{s.name}</h4>
              <AssignmentList assignments={s.items} emptyText="" submittersById={submitters} />
            </section>
          ))}
        </div>
      ) : (
        <AssignmentList assignments={merged} emptyText={emptyText} submittersById={submitters} />
      )}
    </div>
  );
}
