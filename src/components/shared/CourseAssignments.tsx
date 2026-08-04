import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGoogleLogin } from "@react-oauth/google";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AssignmentList, type AssignmentItem } from "@/components/shared/AssignmentList";
import {
  CLASSROOM_SCOPES,
  CLASSROOM_TOKEN_KEY,
  courseIdFromUrl,
  exchangeGoogleToken,
  getCourseAssignments as getClassroomCourseWork,
} from "@/services/classroomService";

// ============================================================
// The work set on a course, wherever it was written.
//
// classroom-sync only ever pushed, from this database up to Google Classroom,
// and wrote the resulting page back to assignments.template_url. Nothing came
// the other way, so work written in Classroom itself, which is where a teacher
// writes it, existed nowhere this app could see. Both the admin course page
// and the tutor's showed an empty list over a class full of assignments.
//
// Shared rather than written twice. The first version of this lived only on
// the admin page, and the tutor's needing the same thing is exactly how two
// copies start.
// ============================================================

export interface LocalAssignment extends AssignmentItem {
  /** The Classroom page the sync wrote back, when it has run for this row. */
  classroomUrl?: string | null;
}

export function CourseAssignments({
  classroomUrl,
  localAssignments,
  isLoading = false,
  emptyText = "No work set on this course yet.",
}: {
  classroomUrl: string | null;
  localAssignments: LocalAssignment[];
  isLoading?: boolean;
  emptyText?: string;
}) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(CLASSROOM_TOKEN_KEY)
  );

  const classroomCourseId = classroomUrl ? courseIdFromUrl(classroomUrl) : null;

  const connect = useGoogleLogin({
    flow: "auth-code",
    scope: CLASSROOM_SCOPES,
    onSuccess: async ({ code }) => {
      try {
        const data = await exchangeGoogleToken(code);
        localStorage.setItem(CLASSROOM_TOKEN_KEY, data.access_token);
        setToken(data.access_token);
        toast.success("Connected to Google Classroom");
      } catch (err: any) {
        toast.error(err.message || "Could not connect to Google");
      }
    },
    onError: () => toast.error("Google login failed"),
  });

  const {
    data: classroom = [],
    isLoading: classroomLoading,
    error: classroomError,
  } = useQuery({
    queryKey: ["classroom-coursework", classroomCourseId, token],
    queryFn: () => getClassroomCourseWork(token!, classroomCourseId!),
    enabled: !!token && !!classroomCourseId,
    retry: false,
  });

  // Google expires these, and the only useful answer is to offer the button
  // again rather than leave a stale token failing quietly on every visit.
  useEffect(() => {
    const message = (classroomError as any)?.message ?? "";
    if (/401|unauthor|credential/i.test(message)) {
      localStorage.removeItem(CLASSROOM_TOKEN_KEY);
      setToken(null);
    }
  }, [classroomError]);

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
    return (
      <div className="flex justify-center py-16 animate-in fade-in duration-300">
        <Loader2 className="animate-spin text-[#1099A1]" size={22} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {classroomUrl && !classroomCourseId && (
        <p className="mb-4 flex items-center gap-2 text-[13px]" style={{ color: "#CAA25F" }}>
          <TriangleAlert size={14} />
          That Google Classroom link is not a class URL, so nothing can be read from it.
        </p>
      )}

      {classroomCourseId && !token && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#CAA25F]/40 bg-[#CAA25F]/5 px-4 py-3">
          <p className="text-[13.5px] text-[#111] dark:text-white">
            This course is linked to a Google Classroom. Connect to read the work set there.
          </p>
          <button
            onClick={() => connect()}
            className="shrink-0 rounded-xl bg-[#1099A1] px-5 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86]"
          >
            Connect Google Classroom
          </button>
        </div>
      )}

      {!classroomUrl && (
        <p className="mb-4 text-[13px] text-muted-foreground">
          Not linked to a Google Classroom. Only work set through Yakal appears here.
        </p>
      )}

      <AssignmentList assignments={merged} emptyText={emptyText} />
    </div>
  );
}
