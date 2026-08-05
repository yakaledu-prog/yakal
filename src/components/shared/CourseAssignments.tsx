import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

import { AssignmentList, type AssignmentItem } from "@/components/shared/AssignmentList";
import { PaperRain } from "@/components/shared/PaperRain";
import { getCourseWorkFor } from "@/services/courseWork";

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

  if (isLoading || classroomLoading) {
    // Reading a class from Google is slower than a database read, and long
    // enough that a bare spinner leaves somebody wondering whether anything is
    // happening at all.
    return <PaperRain className="animate-in fade-in duration-300" />;
  }

  return (
    <div className="animate-in fade-in duration-300">
      {data?.invalidLink && (
        <p className="mb-4 flex items-center gap-2 text-[13px]" style={{ color: "#CAA25F" }}>
          <TriangleAlert size={14} />
          That Google Classroom link is not a class URL, so nothing can be read from it.
        </p>
      )}

      {/* A failure here is worth naming rather than showing as an empty list:
          an empty list says the teacher set nothing, which is a different and
          much more reassuring claim than the truth. */}
      {error != null && (
        <p className="mb-4 flex items-center gap-2 text-[13px]" style={{ color: "#CAA25F" }}>
          <TriangleAlert size={14} />
          Google Classroom could not be reached, so anything set there is missing from this
          list.
        </p>
      )}

      <AssignmentList assignments={merged} emptyText={emptyText} />
    </div>
  );
}
