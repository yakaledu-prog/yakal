import { useMemo } from "react";

import { CourseAssignments, type LocalAssignment } from "@/components/shared/CourseAssignments";
import { LoadingPanel } from "@/components/shared/Spinner";

// ============================================================
// One person's work, across every course they are on.
//
// The tutor's view of a student and the parent's view of a child asked the same
// question and answered it from the database alone, so anything written in
// Google Classroom, which is where a teacher actually writes it, was missing
// from both. Meanwhile the three course pages read Classroom properly. The same
// student's homework therefore looked different depending on which page you
// opened, and the page a parent uses was the one telling the smaller truth.
//
// Reading Classroom is per class, so this groups by course and hands each group
// to CourseAssignments. That component already merges the local rows with the
// class, groups by topic, and answers to whoever is asking: a parent reads as
// their child and sees their grades, a tutor reads as staff and sees who turned
// in. None of that is decided here, which is the point of routing both pages
// through it.
// ============================================================

/**
 * Index is deliberately absent: CourseAssignments renumbers the merged list
 * once Google's work is folded in, so any position set here would be discarded
 * and only mislead whoever set it.
 */
export interface CourseworkRow extends Omit<LocalAssignment, "index"> {
  courseId: string;
  courseTitle: string;
}

export function StudentCoursework({
  rows,
  isLoading = false,
  emptyText = "No work has been set yet.",
}: {
  rows: CourseworkRow[];
  isLoading?: boolean;
  emptyText?: string;
}) {
  // Course order follows first appearance, and the rows arrive sorted by
  // deadline, so the course with the next thing due comes first.
  const courses = useMemo(() => {
    const byCourse = new Map<string, { id: string; title: string; rows: LocalAssignment[] }>();
    for (const row of rows) {
      const item: LocalAssignment = { ...row, index: 0 };
      const existing = byCourse.get(row.courseId);
      if (existing) existing.rows.push(item);
      else byCourse.set(row.courseId, { id: row.courseId, title: row.courseTitle, rows: [item] });
    }
    return [...byCourse.values()];
  }, [rows]);

  if (isLoading) {
    return <LoadingPanel label="Fetching the work set on these courses" />;
  }

  if (courses.length === 0) {
    return <p className="py-16 text-center text-[14px] text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-10">
      {courses.map((course) => (
        <section key={course.id}>
          {/* Named even when there is only one, because this list spans courses
              and an unlabelled group would read as the whole of their work. */}
          <h3 className="mb-4 text-[15px] font-semibold text-foreground">{course.title}</h3>
          <CourseAssignments
            courseId={course.id}
            localAssignments={course.rows}
            emptyText="No work set on this course yet."
          />
        </section>
      ))}
    </div>
  );
}
