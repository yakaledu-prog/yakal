import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";

import { AssignmentList, type AssignmentItem } from "@/components/shared/AssignmentList";
import { useClassroomToken } from "@/hooks/useClassroomToken";
import { supabase } from "@/lib/supabase";
import {
  courseIdFromUrl,
  getCourseAssignments,
  getSubmissions,
} from "@/services/classroomService";
import { GoogleClassroom } from "@/components/icons/GoogleClassroom";

// ============================================================
// A student's work on one course.
//
// This page used to render six invented assignments about limits and
// derivatives, complete with grades nobody had given. Classroom is where the
// work actually lives, so it reads from there and shows nothing when there is
// nothing rather than filling the space.
//
// Read only: turning work in and marking it both happen in Classroom, and
// every card links out to exactly that.
// ============================================================

export function StudentCourseTasks() {
  const { courseId } = useParams();
  const { token, connect } = useClassroomToken();

  const { data: course } = useQuery({
    queryKey: ["course-classroom-url", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("title, google_classroom_url")
        .eq("id", courseId!)
        .maybeSingle();
      return data;
    },
    enabled: !!courseId,
  });

  const classroomId = course?.google_classroom_url
    ? courseIdFromUrl(course.google_classroom_url)
    : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["classroom-assignments", classroomId],
    queryFn: async () => {
      const assignments = await getCourseAssignments(token!, classroomId!);

      // One call per assignment, but scoped to this student by Classroom
      // itself: coursework.me only ever returns their own submission.
      const mine = await Promise.all(
        assignments.map(async (a) => {
          try {
            const subs = await getSubmissions(token!, classroomId!, a.id);
            return { id: a.id, submission: subs[0] ?? null };
          } catch {
            return { id: a.id, submission: null };
          }
        })
      );

      const byId = new Map(mine.map((m) => [m.id, m.submission]));
      return assignments.map<AssignmentItem>((a) => ({
        ...a,
        grade: byId.get(a.id)?.grade ?? null,
        isSubmitted: byId.get(a.id)?.isTurnedIn ?? false,
      }));
    },
    enabled: !!token && !!classroomId,
  });

  if (!course?.google_classroom_url) {
    return (
      <div className="p-4 md:p-8">
        <p className="py-16 text-center text-[14px] text-muted-foreground">
          This course is not linked to a Google Classroom yet, so there is no work to show.
        </p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-20 text-center">
        <GoogleClassroom className="h-10 w-10" />
        <p className="max-w-sm text-[14px] text-muted-foreground">
          Your assignments live in Google Classroom. Connect your Google account once and they
          will show here.
        </p>
        <button
          type="button"
          onClick={() => connect()}
          className="h-11 rounded-md bg-[#1099A1] px-6 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Connect Google Classroom
        </button>
        <a
          href={course.google_classroom_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[13px] font-medium text-[#1099A1] hover:underline"
        >
          <ExternalLink size={15} /> Or open the class directly
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-20 text-center">
        <p className="max-w-md text-[14px] text-muted-foreground">
          Google would not hand over this class: {(error as Error).message}
        </p>
        <button
          type="button"
          onClick={() => connect()}
          className="h-11 rounded-md border border-[#1099A1] px-6 text-[14px] font-medium text-[#1099A1] transition-colors hover:bg-[#1099A1]/10"
        >
          Connect again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <AssignmentList
        assignments={data ?? []}
        isLoading={isLoading}
        emptyText="Nothing has been set for this course yet."
      />
    </div>
  );
}
