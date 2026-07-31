import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Send,
  X,
} from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
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
// Courses a tutor can take on.
//
// Laid out like the parent's catalog, because it answers the same question:
// what is on offer. What it does not have is the parent's "available tutors"
// section. The tutor reading this is the tutor, and the payout matters where
// the parent's price would be.
//
// Separate from My Courses on purpose. That page is a workspace for teaching
// what you already have; this is a marketplace. Putting a marketplace inside
// the workspace sidebar made both cramped.
// ============================================================

const PER_PAGE = 6;

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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
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

export function TutorCourseCatalog() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showApplied, setShowApplied] = useState(false);
  const [applying, setApplying] = useState<CourseSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: open = [], isLoading } = useQuery({
    queryKey: ["open-courses", user?.id],
    queryFn: () => getOpenCourses(user!.id),
    enabled: !!user?.id,
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["my-course-applications", user?.id],
    queryFn: () => getMyApplications(user!.id),
    enabled: !!user?.id,
  });

  const pending = applications.filter((a) => a.status === "pending").length;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return open;
    return open.filter(
      (c) => c.title.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q)
    );
  }, [open, query]);

  const totalPages = Math.max(1, Math.ceil(matches.length / PER_PAGE));
  const start = (Math.min(page, totalPages) - 1) * PER_PAGE;
  const visible = matches.slice(start, start + PER_PAGE);

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

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background pb-12 dark:bg-[#111b21]">
        <div className="relative overflow-hidden bg-[#1099A1] px-4 pt-6 text-white md:px-8 md:pt-8">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 mx-auto max-w-[1440px]">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Find a course</h1>
            <p className="pt-1 text-[15px] text-white/80">
              Courses without a tutor. Apply for the ones you want to teach.
            </p>

            <div className="mt-6 flex flex-col gap-4 border-t border-white/20 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60"
                  />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search courses"
                    className="h-9 w-[220px] rounded-lg border border-white/25 bg-white/10 pl-9 pr-3 text-[13.5px] text-white outline-none transition-colors placeholder:text-white/60 focus:border-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowApplied((v) => !v)}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
                    showApplied
                      ? "border-white bg-white text-[#1099A1]"
                      : "border-white/25 text-white hover:bg-white/10"
                  )}
                >
                  My applications
                  {pending > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[11px] font-bold tabular-nums",
                        showApplied ? "bg-[#1099A1] text-white" : "bg-white/20"
                      )}
                    >
                      {pending}
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
                  {([
                    ["grid", LayoutGrid, "Grid view"],
                    ["list", List, "List view"],
                  ] as const).map(([v, Icon, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setView(v)}
                      aria-label={label}
                      aria-pressed={view === v}
                      className={cn(
                        "rounded-md p-1.5 transition-colors",
                        view === v ? "bg-white text-[#1099A1] shadow-sm" : "text-white hover:bg-white/20"
                      )}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {!showApplied && matches.length > 0 && (
                <div className="flex items-center gap-2 self-end lg:self-auto">
                  <span className="mr-2 text-[13px] text-white/80">
                    Showing {start + 1}-{Math.min(start + PER_PAGE, matches.length)} of{" "}
                    {matches.length}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    aria-label="Previous page"
                    className="rounded-lg border border-white/20 p-1.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                    className="rounded-lg border border-white/20 p-1.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1440px] p-4 md:p-8">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : showApplied ? (
            applications.length === 0 ? (
              <Empty
                title="No applications yet"
                body="Anything you apply for shows up here with where it got to."
              />
            ) : (
              <div className="space-y-3">
                {applications.map((a) => (
                  <article
                    key={a.id}
                    className="flex flex-wrap items-start gap-4 rounded-2xl border border-[#e9edef] bg-white p-4 dark:border-[#2a3942] dark:bg-[#202c33]"
                  >
                    <div className="min-w-[220px] flex-1">
                      <h3 className="text-[15px] font-semibold text-foreground">
                        {a.course?.title ?? "A course"}
                      </h3>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        {a.course?.subject}
                        {" - applied "}
                        {a.createdAt.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      {a.message && (
                        <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">
                          {a.message}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
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
            )
          ) : visible.length === 0 ? (
            <Empty
              title={query.trim() ? `Nothing matches "${query.trim()}"` : "Nothing open right now"}
              body={
                query.trim()
                  ? "Try a different subject or title."
                  : "Courses without a tutor appear here. You are told when a new one is added."
              }
            />
          ) : (
            <div
              className={cn(
                "grid gap-4 md:gap-6",
                view === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-1 lg:grid-cols-2"
              )}
            >
              {visible.map((course) => (
                <article
                  key={course.id}
                  className={cn(
                    "group flex flex-col overflow-hidden rounded-[16px] border border-[#e9edef] bg-white ring-2 ring-transparent transition-all duration-300 ease-in-out hover:border-primary/50 hover:ring-primary/50 dark:border-[#2a3942] dark:bg-[#202c33]",
                    view === "list" && "sm:flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "relative shrink-0 overflow-hidden",
                      view === "list"
                        ? "h-[180px] w-full sm:h-auto sm:w-[220px]"
                        : "aspect-video w-full"
                    )}
                  >
                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-[#1099A1]/10 text-[#1099A1]">
                        <BookOpen size={28} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-[12px] font-medium uppercase tracking-wider text-[#1099A1]">
                      {course.subject}
                    </p>
                    <h3 className="mt-1 text-[16px] font-semibold text-foreground">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="mt-1.5 line-clamp-2 text-[13px] text-muted-foreground">
                        {course.description}
                      </p>
                    )}

                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      {/* The payout, never what the parent pays. That figure is
                          not the tutor's, and inviting the comparison helps
                          nobody. */}
                      <div>
                        {course.tutorPayoutCents != null ? (
                          <>
                            <p className="text-[18px] font-bold text-foreground">
                              {money(course.tutorPayoutCents)}
                            </p>
                            <p className="text-[12px] text-muted-foreground">to you per session</p>
                          </>
                        ) : (
                          <p className="text-[13px] text-muted-foreground">Rate to be agreed</p>
                        )}
                      </div>
                      <button
                        onClick={() => setApplying(course)}
                        className="rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d7f86]"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {applying && (
        <ApplyDialog
          course={applying}
          busy={busy}
          onSubmit={submit}
          onClose={() => setApplying(null)}
        />
      )}
    </PageWrapper>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#e9edef] py-16 text-center dark:border-[#2a3942]">
      <BookOpen size={32} className="mx-auto mb-3 text-[#aebac1]" />
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}
