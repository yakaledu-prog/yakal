import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { type AssignmentItem } from "@/components/shared/AssignmentList";
import { CourseAssignments } from "@/components/shared/CourseAssignments";
import { supabase } from "@/lib/supabase";
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

  // The class this course is linked to, so work written in Classroom shows up
  // here too rather than only what was set through Yakal.
  const { data: classroomUrl = null } = useQuery({
    queryKey: ["course-classroom-url", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("google_classroom_url")
        .eq("id", courseId!)
        .maybeSingle();
      return data?.google_classroom_url ?? null;
    },
    enabled: !!courseId,
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
      <CourseAssignments
        classroomUrl={classroomUrl}
        localAssignments={assignments}
        isLoading={isLoading}
        emptyText="Nothing has been set for this course yet."
      />
    </div>
  );
}
