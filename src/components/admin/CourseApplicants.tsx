import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, FileText, Loader2, UserCheck, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { dicebearUrl } from "@/utils/avatar";
import { money } from "@/services/billingService";
import { cn } from "@/utils/cn";
import {
  acceptApplicant,
  getApplicants,
  rejectApplicant,
  type Applicant,
} from "@/services/courseApplicationService";

// ============================================================
// Who has asked to teach this course.
//
// This tab used to render three invented tutors with invented ratings, flags
// and quotes, so an admin could not act on it at all. These are the real
// applications.
//
// Accepting assigns the tutor and turns the others down in the same action: a
// course with two accepted applications is a state nobody should have to
// reason about, and being left waiting indefinitely is what people complain
// about.
// ============================================================

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Waiting", className: "text-[#8a6a2a] dark:text-[#CAA25F]" },
  accepted: { label: "Teaching this course", className: "text-[#1099A1]" },
  rejected: { label: "Not accepted", className: "text-muted-foreground" },
  withdrawn: { label: "Withdrawn", className: "text-muted-foreground" },
};

export function CourseApplicants({
  courseId,
  courseTitle,
  assignedTutorId,
  onAssigned,
}: {
  courseId: string;
  courseTitle: string;
  assignedTutorId: string | null;
  /** Lets the page refetch the course once its tutor changes. */
  onAssigned?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: applicants = [], isLoading } = useQuery({
    queryKey: ["course-applicants", courseId],
    queryFn: () => getApplicants(courseId),
    enabled: !!courseId,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["course-applicants", courseId] });
    onAssigned?.();
  };

  async function accept(a: Applicant) {
    if (!user) return;
    setBusyId(a.id);
    const res = await acceptApplicant({
      applicationId: a.id,
      courseId,
      tutorId: a.tutor.id,
      adminId: user.id,
      courseTitle,
    });
    setBusyId(null);
    if (!res.success) return toast.error(res.error ?? "Could not accept that application.");
    toast.success(`${a.tutor.name} is now teaching ${courseTitle}.`);
    await refresh();
  }

  async function reject(a: Applicant) {
    if (!user) return;
    setBusyId(a.id);
    const res = await rejectApplicant({
      applicationId: a.id,
      tutorId: a.tutor.id,
      adminId: user.id,
      courseTitle,
    });
    setBusyId(null);
    if (!res.success) return toast.error(res.error ?? "Could not update that application.");
    await refresh();
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-[#1099A1]" />
      </div>
    );
  }

  const pending = applicants.filter((a) => a.status === "pending");
  const decided = applicants.filter((a) => a.status !== "pending");

  return (
    <div className="animate-in fade-in duration-300">
      {!assignedTutorId && (
        <p className="mb-6 text-[13px] font-medium text-[#8a6a2a] dark:text-[#CAA25F]">
          No tutor assigned yet
        </p>
      )}

      {applicants.length === 0 ? (
        <div className="py-16 text-center">
          <UserCheck size={32} className="mx-auto mb-3 text-[#aebac1]" />
          <p className="text-[15px] font-medium text-[#111] dark:text-white">No applications yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
            Tutors see this course under Open and can apply for it.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...pending, ...decided].map((a) => (
            <article
              key={a.id}
              className={cn(
                "rounded-2xl border bg-white p-5 dark:bg-[#182329]",
                a.status === "accepted"
                  ? "border-[#1099A1]/40"
                  : "border-[#e9edef] dark:border-[#2a3942]",
                a.status === "rejected" || a.status === "withdrawn" ? "opacity-60" : ""
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <img
                    src={a.tutor.avatarUrl || dicebearUrl(a.tutor.name)}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-[#111] dark:text-white">
                      {a.tutor.name}
                    </h3>
                    {a.tutor.email && (
                      <p className="text-[12.5px] text-muted-foreground">{a.tutor.email}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                      {a.tutor.hourlyRate != null && (
                        <span className="font-medium text-[#1099A1]">
                          {money(a.tutor.hourlyRate * 100)}/hr
                        </span>
                      )}
                      {(a.tutor.subjects ?? []).length > 0 && (
                        <span>{(a.tutor.subjects ?? []).slice(0, 3).join(", ")}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        applied{" "}
                        {a.createdAt.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <span className={cn("shrink-0 text-[12.5px] font-medium", STATUS[a.status].className)}>
                  {STATUS[a.status].label}
                </span>
              </div>

              {a.tutor.bio && (
                <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
                  {a.tutor.bio}
                </p>
              )}

              {a.message && (
                <div className="mt-3 rounded-xl border border-[#e9edef] bg-muted/30 p-3.5 dark:border-[#2a3942]">
                  <p className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Why they applied
                  </p>
                  <p className="text-[13.5px] text-[#111] dark:text-white">{a.message}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e9edef] pt-3 dark:border-[#2a3942]">
                {a.tutor.resumeUrl && (
                  <a
                    href={a.tutor.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-[#e9edef] px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 dark:border-[#2a3942]"
                  >
                    <FileText size={14} /> View CV
                  </a>
                )}
                <div className="flex-1" />

                {a.status === "pending" && (
                  <>
                    <button
                      onClick={() => void reject(a)}
                      disabled={busyId === a.id}
                      className="flex items-center gap-1.5 rounded-xl border border-[#e9edef] px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-50 dark:border-[#2a3942]"
                    >
                      <X size={14} /> Not this one
                    </button>
                    <button
                      onClick={() => void accept(a)}
                      disabled={busyId === a.id || !!assignedTutorId}
                      title={
                        assignedTutorId
                          ? "This course already has a tutor. Unassign them first."
                          : undefined
                      }
                      className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
                    >
                      {busyId === a.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      Accept and assign
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
