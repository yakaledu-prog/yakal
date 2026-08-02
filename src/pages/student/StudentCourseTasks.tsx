import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { AssignmentList, type AssignmentItem } from "@/components/shared/AssignmentList";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseAssignments } from "@/services/studentService";

// ============================================================
// A student's work on one course.
//
// This page used to render three invented assignments about limits and
// derivatives, with a grade nobody had given. The same work is real now,
// written on the admin side and seeded so it survives a database reset.
//
// Read only: assignments are set by an admin and marked by a tutor, and each
// card links out to where the work is actually handed in.
// ============================================================

export function StudentCourseTasks() {
  const { courseId } = useParams();
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: ["course-assignments", user?.id, courseId],
    queryFn: () => getCourseAssignments(user!.id, courseId!),
    enabled: !!user?.id && !!courseId,
  });

  const assignments: AssignmentItem[] = data.map((a, i) => ({
    id: a.id,
    index: i + 1,
    title: a.title,
    description: a.description,
    materials: a.materials,
    dueDate: a.dueDate,
    maxPoints: a.maxPoints,
    link: a.link,
    grade: a.grade,
    isSubmitted: a.isSubmitted,
  }));

  return (
    <div className="p-4 md:p-8">
      <AssignmentList
        assignments={assignments}
        isLoading={isLoading}
        emptyText="Nothing has been set for this course yet."
      />
    </div>
  );
}
