import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";

import {
  AssignmentList,
  type AssignmentItem,
  type AssignmentSubmitter,
} from "@/components/shared/AssignmentList";
import { GoogleClassroom } from "@/components/icons/GoogleClassroom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Dropdown } from "@/components/ui/Dropdown";
import { useAuth } from "@/contexts/AuthContext";
import { useClassroomToken } from "@/hooks/useClassroomToken";
import { supabase } from "@/lib/supabase";
import {
  courseIdFromUrl,
  getCourseAssignments,
  getRoster,
  getSubmissions,
  type ClassroomStudent,
  type ClassroomSubmission,
} from "@/services/classroomService";
import { dicebearUrl } from "@/utils/avatar";

// ============================================================
// What a tutor's students have been set, and who has handed it in.
//
// Tutors do not write assignments here. They are created with the course, in
// Classroom, so this page reads: the same cards the student sees, plus the
// faces of everyone who has turned each one in and a way to look closer.
//
// Marking happens in Classroom too, so every route out of this page ends
// there rather than in a grade box of our own.
// ============================================================

function SubmissionsDialog({
  assignment,
  submissions,
  roster,
  onClose,
}: {
  assignment: AssignmentItem;
  submissions: ClassroomSubmission[];
  roster: Map<string, ClassroomStudent>;
  onClose: () => void;
}) {
  const turnedIn = submissions.filter((s) => s.isTurnedIn);
  const outstanding = submissions.filter((s) => !s.isTurnedIn);

  const Row = ({ s }: { s: ClassroomSubmission }) => {
    const person = roster.get(s.userId);
    const name = person?.name ?? "Student";
    return (
      <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
        <img
          src={person?.photoUrl || dicebearUrl(name)}
          alt=""
          className="h-9 w-9 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-foreground">{name}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {s.isTurnedIn
              ? s.updatedAt
                ? `Turned in ${new Date(s.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : "Turned in"
              : "Not turned in"}
            {s.late && " · Late"}
          </p>
        </div>
        {s.grade != null ? (
          <span className="shrink-0 text-[14px] text-[#1099A1]">
            {s.grade}
            {assignment.maxPoints != null && ` / ${assignment.maxPoints}`}
          </span>
        ) : (
          <span className="shrink-0 text-[12.5px] text-muted-foreground">Not marked</span>
        )}
        {s.link && (
          <a
            href={s.link}
            target="_blank"
            rel="noreferrer"
            title="Open in Classroom"
            className="shrink-0 text-muted-foreground transition-colors hover:text-[#1099A1]"
          >
            <ExternalLink size={15} />
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-popover shadow-xl">
        <div className="flex items-start justify-between border-b border-border p-5">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-semibold text-foreground">
              {assignment.title}
            </h3>
            <p className="text-[13px] text-muted-foreground">
              {turnedIn.length} of {submissions.length} turned in
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {turnedIn.map((s) => (
            <Row key={s.id} s={s} />
          ))}
          {outstanding.length > 0 && (
            <>
              <p className="pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Still waiting
              </p>
              {outstanding.map((s) => (
                <Row key={s.id} s={s} />
              ))}
            </>
          )}
        </div>

        {assignment.link && (
          <a
            href={assignment.link}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 border-t border-border py-3.5 text-[13.5px] font-medium text-[#1099A1] transition-colors hover:bg-muted/40"
          >
            <ExternalLink size={15} /> Mark this in Google Classroom
          </a>
        )}
      </div>
    </div>
  );
}

export function TutorAssignments() {
  const { user } = useAuth();
  const { token, connect } = useClassroomToken();
  const [courseId, setCourseId] = useState<string>("");
  const [openFor, setOpenFor] = useState<AssignmentItem | null>(null);

  // Only the tutor's own courses, and only the ones actually linked to a class.
  const { data: courses = [] } = useQuery({
    queryKey: ["tutor-classroom-courses", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, google_classroom_url")
        .eq("tutor_id", user!.id)
        .not("google_classroom_url", "is", null);
      return (data ?? []).filter((c) => !!courseIdFromUrl(c.google_classroom_url ?? ""));
    },
    enabled: !!user?.id,
  });

  const selected = courses.find((c) => c.id === courseId) ?? courses[0];
  const classroomId = selected ? courseIdFromUrl(selected.google_classroom_url ?? "") : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["tutor-classroom-work", classroomId],
    queryFn: async () => {
      const [assignments, students] = await Promise.all([
        getCourseAssignments(token!, classroomId!),
        // A missing roster costs faces, not the page.
        getRoster(token!, classroomId!).catch(() => [] as ClassroomStudent[]),
      ]);

      const submissions = await Promise.all(
        assignments.map(async (a) => {
          try {
            return { id: a.id, rows: await getSubmissions(token!, classroomId!, a.id) };
          } catch {
            return { id: a.id, rows: [] as ClassroomSubmission[] };
          }
        })
      );

      return {
        assignments,
        roster: new Map(students.map((s) => [s.userId, s])),
        submissions: new Map(submissions.map((s) => [s.id, s.rows])),
      };
    },
    enabled: !!token && !!classroomId,
  });

  const submittersById = useMemo(() => {
    const out: Record<string, AssignmentSubmitter[]> = {};
    if (!data) return out;
    for (const [assignmentId, rows] of data.submissions) {
      out[assignmentId] = rows
        .filter((r) => r.isTurnedIn)
        .map((r) => ({
          id: r.id,
          name: data.roster.get(r.userId)?.name ?? "Student",
          avatarUrl: data.roster.get(r.userId)?.photoUrl ?? null,
        }));
    }
    return out;
  }, [data]);

  if (!token) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center gap-4 px-4 py-24 text-center">
          <GoogleClassroom className="h-10 w-10" />
          <p className="max-w-sm text-[14px] text-muted-foreground">
            Assignments are set in Google Classroom when a course is created. Connect your Google
            account to see them and who has turned them in.
          </p>
          <button
            type="button"
            onClick={() => connect()}
            className="h-11 rounded-md bg-[#1099A1] px-6 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Connect Google Classroom
          </button>
        </div>
      </PageWrapper>
    );
  }

  if (courses.length === 0) {
    return (
      <PageWrapper>
        <p className="px-4 py-24 text-center text-[14px] text-muted-foreground">
          None of your courses is linked to a Google Classroom yet. An admin adds the link when the
          course is set up.
        </p>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Dropdown
            value={selected?.id ?? ""}
            onChange={setCourseId}
            options={courses.map((c) => ({ value: c.id, label: c.title }))}
            className="w-[260px]"
          />

          {selected?.google_classroom_url && (
            <a
              href={selected.google_classroom_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[13px] font-medium text-[#1099A1] hover:underline"
            >
              <ExternalLink size={15} /> Open the class
            </a>
          )}
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
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
        ) : isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#1099A1]" />
          </div>
        ) : (
          <AssignmentList
            assignments={data?.assignments ?? []}
            submittersById={submittersById}
            onOpenSubmissions={setOpenFor}
            emptyText="Nothing has been set for this course yet."
          />
        )}
      </div>

      {openFor && data && (
        <SubmissionsDialog
          assignment={openFor}
          submissions={data.submissions.get(openFor.id) ?? []}
          roster={data.roster}
          onClose={() => setOpenFor(null)}
        />
      )}
    </PageWrapper>
  );
}
