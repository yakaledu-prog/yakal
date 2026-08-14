import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { type AssignmentItem } from "@/components/shared/AssignmentList";
import { CourseAssignments, type LocalAssignment } from "@/components/shared/CourseAssignments";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseAssignments } from "@/services/studentService";
import { turnInAssignment, unsubmitAssignment } from "@/services/submissionService";

// ============================================================
// A student's work on one course.
//
// The definitions come from Google Classroom (read live, mirrored into native
// rows), but the turn-in is native: the student marks work done here rather
// than signing into Google to hand it in (P3, docs/architecture/
// google-classroom.md). The tutor's grade, when it lands, closes the row.
// ============================================================

export function StudentCourseTasks() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["course-assignments", user?.id, courseId],
    queryFn: () => getCourseAssignments(user!.id, courseId!),
    enabled: !!user?.id && !!courseId,
  });

  const assignments: LocalAssignment[] = data.map((a, i) => ({
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
    externalId: a.externalId,
  }));

  async function run(
    a: AssignmentItem,
    action: () => Promise<{ success: boolean; error?: string }>,
    ok: string
  ) {
    setBusyId(a.id);
    const res = await action();
    setBusyId(null);
    if (!res.success) return toast.error(res.error || "Something went wrong.");
    toast.success(ok);
    qc.invalidateQueries({ queryKey: ["course-assignments", user?.id, courseId] });
  }

  return (
    <div className="p-4 md:p-8">
      <CourseAssignments
        courseId={courseId!}
        localAssignments={assignments}
        isLoading={isLoading}
        emptyText="Nothing has been set for this course yet."
        busyId={busyId}
        onTurnIn={(a) => run(a, () => turnInAssignment(user!.id, a.id), "Turned in.")}
        onUnsubmit={(a) => run(a, () => unsubmitAssignment(user!.id, a.id), "Turn-in undone.")}
      />
    </div>
  );
}
