import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Check, Clock, Loader2, Send, X } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import {
  applyForCourse,
  getMyApplications,
  getOpenCourses,
  withdrawApplication,
  type CourseApplication,
  type CourseSummary,
} from "@/services/courseApplicationService";

// ============================================================
// Courses a tutor could teach, and the ones they have asked for.
//
// Sits beside "Teaching" as tabs on the same page rather than as its own nav
// item. Open and Applied are two states of the same thing, and a nav entry
// that is empty most of the time teaches people to stop looking at it.
// ============================================================

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-[#CAA25F]/15 text-[#8a6a2a] dark:text-[#CAA25F]",
  accepted: "bg-[#1099A1]/12 text-[#1099A1]",
  rejected: "bg-muted text-muted-foreground",
  withdrawn: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting on a decision",
  accepted: "Accepted",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

function Thumb({ course }: { course: CourseSummary }) {
  return course.thumbnailUrl ? (
    <img
      src={course.thumbnailUrl}
      alt=""
      className="h-16 w-24 shrink-0 rounded-lg object-cover"
      loading="lazy"
    />
  ) : (
    <div className="grid h-16 w-24 shrink-0 place-items-center rounded-lg bg-[#1099A1]/10 text-[#1099A1]">
      <BookOpen size={20} />
    </div>
  );
}

function ApplyDialog({
  course,
  busy,
  onSubmit,
  onClose,
}: {
  course: CourseSummary;
  busy: boolean;
  onSubmit: (message: string) => void;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Apply to teach ${course.title}`}
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-[#182229] md:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">Apply to teach</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{course.title}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Why you are a good fit for this course (optional)"
          className="w-full resize-none rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-[#1099A1]"
        />
        <p className="mt-2 text-[12px] text-muted-foreground">
          Your profile, subjects and CV are sent with this, so there is no need to repeat them.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(message)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#0d7f86] disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Send application
          </button>
        </div>
      </div>
    </div>
  );
}

export function TutorCourseMarket({ mode }: { mode: "open" | "applied" }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [applying, setApplying] = useState<CourseSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: open = [], isLoading: loadingOpen } = useQuery({
    queryKey: ["open-courses", user?.id],
    queryFn: () => getOpenCourses(user!.id),
    enabled: !!user?.id && mode === "open",
  });

  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ["my-course-applications", user?.id],
    queryFn: () => getMyApplications(user!.id),
    enabled: !!user?.id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["open-courses"] });
    qc.invalidateQueries({ queryKey: ["my-course-applications"] });
  };

  async function submit(message: string) {
    if (!user || !applying) return;
    setBusy(true);
    const res = await applyForCourse({
      courseId: applying.id,
      tutorId: user.id,
      tutorName: profile?.full_name ?? "A tutor",
      courseTitle: applying.title,
      message,
    });
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not send that application.");
    toast.success("Application sent. You will hear back once it is reviewed.");
    setApplying(null);
    refresh();
  }

  async function withdraw(app: CourseApplication) {
    setBusy(true);
    const res = await withdrawApplication(app.id);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not withdraw that.");
    toast.success("Application withdrawn.");
    refresh();
  }

  const loading = mode === "open" ? loadingOpen : loadingApps;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-[#1099A1]" />
      </div>
    );
  }

  if (mode === "open") {
    return (
      <div className="mx-auto max-w-[1000px] p-6 md:p-8">
        {open.length === 0 ? (
          <Empty
            title="Nothing open right now"
            body="Courses without a tutor appear here. You are told when a new one is added."
          />
        ) : (
          <div className="space-y-3">
            {open.map((c) => (
              <article
                key={c.id}
                className="flex items-start gap-4 rounded-2xl border border-border bg-white p-4 dark:bg-[#182229]"
              >
                <Thumb course={c} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-foreground">{c.title}</h3>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">{c.subject}</p>
                  {c.description && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">
                      {c.description}
                    </p>
                  )}
                  {/* What the tutor is paid, not what the parent pays. The
                      other figure is not theirs and inviting the comparison
                      helps nobody. */}
                  {c.tutorPayoutCents != null && (
                    <p className="mt-2 text-[13px] font-medium text-[#1099A1]">
                      {money(c.tutorPayoutCents)} to you
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setApplying(c)}
                  className="shrink-0 rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d7f86]"
                >
                  Apply
                </button>
              </article>
            ))}
          </div>
        )}

        {applying && (
          <ApplyDialog
            course={applying}
            busy={busy}
            onSubmit={submit}
            onClose={() => setApplying(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] p-6 md:p-8">
      {applications.length === 0 ? (
        <Empty
          title="No applications yet"
          body="Anything you apply for shows up here with where it got to."
        />
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <article
              key={a.id}
              className="flex items-start gap-4 rounded-2xl border border-border bg-white p-4 dark:bg-[#182229]"
            >
              {a.course && <Thumb course={a.course} />}
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {a.course?.title ?? "A course"}
                </h3>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  {a.course?.subject}
                  {" - applied "}
                  {a.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </p>
                {a.message && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">
                    {a.message}
                  </p>
                )}
                {a.decisionNote && (
                  <p className="mt-1.5 text-[13px] text-foreground">{a.decisionNote}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
                    STATUS_STYLE[a.status]
                  )}
                >
                  {a.status === "pending" ? (
                    <Clock size={12} />
                  ) : a.status === "accepted" ? (
                    <Check size={12} />
                  ) : null}
                  {STATUS_LABEL[a.status]}
                </span>
                {a.status === "pending" && (
                  <button
                    onClick={() => void withdraw(a)}
                    disabled={busy}
                    className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-[#CAA25F] disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-16 text-center">
      <BookOpen size={32} className="mx-auto mb-3 text-[#aebac1]" />
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}
