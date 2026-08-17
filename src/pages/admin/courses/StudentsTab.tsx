import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { getCourseDetail } from "@/services/adminService";
import { getClassroomMembership, sendClassroomInvite } from "@/services/courseWork";
import { dicebearUrl } from "@/utils/avatar";

// ============================================================
// Who is on this course, and whether they can hand work in.
//
// This tab was a placeholder saying students could be managed here. Meanwhile
// the one thing an admin actually had to do was invisible: a student is
// invited to the Google class automatically when their parent pays, and when
// that fails, nothing anywhere said so. The invitation is the only part of a
// purchase that can silently not happen, because it is the only part that
// depends on Google.
//
// Membership is read live rather than stored. A student can accept an
// invitation, or be removed from the class, entirely inside Classroom, so a
// column we kept in our own database would be wrong within the day.
// ============================================================

function MembershipCell({
  state,
  onInvite,
  busy,
}: {
  state: "joined" | "invited" | "none" | undefined;
  onInvite: () => void;
  busy: boolean;
}) {
  if (state === "joined") {
    return <span className="text-[13px] text-primary">In the classroom</span>;
  }
  if (state === "invited") {
    return (
      <span className="flex items-center gap-3">
        <span className="text-[13px] text-muted-foreground">Invited, not accepted</span>
        <button
          type="button"
          onClick={onInvite}
          disabled={busy}
          className="text-[13px] font-medium text-primary hover:underline disabled:opacity-50"
        >
          Resend
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onInvite}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
    >
      {busy && <Loader2 size={13} className="animate-spin" />}
      Send invite
    </button>
  );
}

export function StudentsTab({
  courseId,
  hasClassroom,
}: {
  courseId: string;
  hasClassroom: boolean;
}) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["admin-course-detail", courseId],
    queryFn: () => getCourseDetail(courseId),
  });

  // Separate from the roster, and allowed to fail on its own. Google being
  // unreachable should cost the Classroom column, not the list of who paid.
  const { data: membership, error: membershipError } = useQuery({
    queryKey: ["course-classroom-membership", courseId],
    queryFn: () => getClassroomMembership(courseId),
    enabled: hasClassroom,
    retry: false,
  });

  const stateFor = (studentId: string) =>
    membership?.students.find((s) => s.studentId === studentId)?.membership;

  const invite = async (studentId: string, name: string) => {
    setBusyId(studentId);
    try {
      const res = await sendClassroomInvite(courseId, studentId);
      toast.success(
        res.alreadyThere
          ? `${name} has already been invited.`
          : `Invitation sent to ${res.email}.`
      );
      await queryClient.invalidateQueries({ queryKey: ["course-classroom-membership", courseId] });
    } catch (err: any) {
      toast.error(err.message || "Could not send that invitation.");
    } finally {
      setBusyId(null);
    }
  };

  const students = detail?.students ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Users className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <h3 className="mb-2 text-[16px] font-medium text-foreground">Nobody is enrolled yet</h3>
        <p className="max-w-sm text-[14px] text-muted-foreground">
          Students appear here once a parent has bought this course for them.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300">
      {membershipError != null && (
        <p className="mb-4 text-[13px] text-secondary">
          {(membershipError as Error).message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="border-b border-border text-left text-[12px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-3 font-medium">Student</th>
              <th className="pb-3 font-medium">Bought by</th>
              {hasClassroom && <th className="pb-3 font-medium">Google Classroom</th>}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={s.avatarUrl || dicebearUrl(s.name)}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-foreground">{s.name}</p>
                      <p className="truncate text-[12.5px] text-muted-foreground">
                        {s.email ?? s.gradeLevel ?? "No email"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3 text-[13px] text-muted-foreground">
                  {s.purchasedByName ?? "Themselves"}
                </td>
                {hasClassroom && (
                  <td className="py-3">
                    <MembershipCell
                      state={stateFor(s.id)}
                      busy={busyId === s.id}
                      onInvite={() => invite(s.id, s.name)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
