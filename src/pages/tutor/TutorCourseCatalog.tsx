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
  Info,
  Mail,
  Pencil,
  Phone,
  Search,
  Send,
  X,
} from "lucide-react";

import { Link } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import { ResumePanel } from "@/components/shared/ResumePanel";
import { dicebearUrl } from "@/utils/avatar";
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

/** What a tutor wants to narrow the catalog down to. */
type Filter = "all" | "open" | "pending" | "accepted" | "rejected";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All courses" },
  { value: "open", label: "Not applied" },
  { value: "pending", label: "Applied" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Not accepted" },
];

function ApplyDialog({
  course,
  userId,
  profile,
  resumePath,
  busy,
  onSubmit,
  onClose,
}: {
  course: CourseSummary;
  userId: string;
  /** The tutor's own profile, which travels with the application. */
  profile: any;
  resumePath: string | null;
  busy: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const [cv, setCv] = useState(resumePath);
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
          <h2 className="text-[17px] font-medium text-foreground">{course.title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X size={18} />
          </button>
        </div>

        {/* What actually goes to the reviewer. Showing it beats asking a
            tutor to remember what their profile says, and a typo in a bio is
            worth catching before whoever decides reads it.

            No rate here: the admin prices a course, a tutor does not quote for
            it, so showing one would imply a negotiation that does not exist. */}
        <p className="mb-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Info size={14} className="shrink-0" />
          Sent with your application
        </p>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <img
              src={profile?.avatar_url || dicebearUrl(profile?.full_name ?? "Tutor")}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-medium text-foreground">
                {profile?.full_name ?? "Your name"}
              </p>
              <div className="mt-1 space-y-1 text-[12.5px] text-muted-foreground">
                {profile?.email && (
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail size={12} className="shrink-0" /> {profile.email}
                  </p>
                )}
                {profile?.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={12} className="shrink-0" /> {profile.phone}
                  </p>
                )}
              </div>
            </div>

            <Link
              to="/tutor/profile"
              title="Edit your profile"
              aria-label="Edit your profile"
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Pencil size={15} />
            </Link>
          </div>

          {/* Full width rather than tucked into the column beside the avatar:
              a bio is prose and reads badly in a narrow gutter. */}
          {profile?.bio && (
            <p className="mt-3 text-[13px] leading-relaxed text-foreground">{profile.bio}</p>
          )}

          {(profile?.subjects ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(profile?.subjects ?? []).map((subject: string) => (
                <span
                  key={subject}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground"
                >
                  {subject}
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="mb-2 mt-4 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Info size={14} className="shrink-0" />
          The CV from your onboarding
        </p>
        <ResumePanel userId={userId} resumePath={cv} onReplaced={setCv} />

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
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
  const [filter, setFilter] = useState<Filter>("all");
  const [applying, setApplying] = useState<CourseSummary | null>(null);
  const [withdrawing, setWithdrawing] = useState<{ app: CourseApplication; title: string } | null>(
    null
  );
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

  const counts = useMemo(() => {
    const state = (c: CourseSummary) => c.myApplication?.status ?? "open";
    return {
      all: open.length,
      open: open.filter((c) => state(c) === "open" || state(c) === "withdrawn").length,
      pending: open.filter((c) => state(c) === "pending").length,
      accepted: open.filter((c) => state(c) === "accepted").length,
      rejected: open.filter((c) => state(c) === "rejected").length,
    } as Record<Filter, number>;
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return open.filter((c) => {
      const state = c.myApplication?.status ?? "open";
      const inFilter =
        filter === "all"
          ? true
          : filter === "open"
            ? state === "open" || state === "withdrawn"
            : state === filter;
      if (!inFilter) return false;
      if (!q) return true;
      return c.title.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q);
    });
  }, [open, query, filter]);

  const totalPages = Math.max(1, Math.ceil(matches.length / PER_PAGE));
  const start = (Math.min(page, totalPages) - 1) * PER_PAGE;
  const visible = matches.slice(start, start + PER_PAGE);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["open-courses"] });
    qc.invalidateQueries({ queryKey: ["my-course-applications"] });
  };

  async function submit() {
    if (!user || !applying) return;
    setBusy(true);
    const res = await applyForCourse({
      courseId: applying.id,
      tutorId: user.id,
      tutorName: profile?.full_name ?? "A tutor",
      courseTitle: applying.title,
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
    setWithdrawing(null);
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

            {/* View, then search, then filter, then the count hard right.
                The controls used to run in a different order to the parent's
                catalog and sat on the banner's bottom edge. */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/20 pb-6 pt-4">
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

              <div className="relative min-w-[200px] flex-1 sm:max-w-[320px]">
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
                  placeholder="Search courses..."
                  className="h-9 w-full rounded-lg border border-white/25 bg-white/10 pl-9 pr-3 text-[13.5px] text-white outline-none transition-colors placeholder:text-white/60 focus:border-white"
                />
              </div>

              <Dropdown
                value={filter}
                onChange={(v) => {
                  setFilter(v);
                  setPage(1);
                }}
                options={FILTERS.map((f) => ({
                  value: f.value,
                  label: `${f.label} (${counts[f.value]})`,
                }))}
                tone="onDark"
                size="sm"
                ariaLabel="Filter courses"
                className="w-[190px]"
              />

              <div className="ml-auto flex items-center gap-2">
                {matches.length > 0 && (
                  <span className="text-[13px] text-white/80">
                    Showing {start + 1}-{Math.min(start + PER_PAGE, matches.length)} of{" "}
                    {matches.length}
                  </span>
                )}
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
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1440px] p-4 md:p-8">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
                    ) : visible.length === 0 ? (
            <Empty
              title={
                query.trim()
                  ? `Nothing matches "${query.trim()}"`
                  : filter === "all"
                    ? "Nothing open right now"
                    : `No courses under "${FILTERS.find((f) => f.value === filter)?.label}"`
              }
              body={
                query.trim() || filter !== "all"
                  ? "Try a different search or filter."
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

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      {course.myApplication?.status === "pending" && (
                        <button
                          onClick={() => {
                            const app = applications.find(
                              (a) => a.id === course.myApplication?.id
                            );
                            if (app) setWithdrawing({ app, title: course.title });
                          }}
                          disabled={busy}
                          className="text-[12.5px] font-medium text-[#d4183d] transition-colors hover:underline disabled:opacity-50"
                        >
                          Withdraw
                        </button>
                      )}
                      {/* The payout, never what the parent pays. That figure is
                          not the tutor's, and inviting the comparison helps
                          nobody. */}
                      {course.myApplication?.status !== "pending" &&
                        (course.tutorPayoutCents != null ? (
                          <p className="text-[18px] font-medium text-foreground">
                            {money(course.tutorPayoutCents)}
                            <span className="text-[12px] text-muted-foreground">/hr</span>
                          </p>
                        ) : (
                          <p className="text-[13px] text-muted-foreground">Rate to be agreed</p>
                        ))}
                      {/* An applied course keeps its place and says so. It
                          used to disappear from the list, which looked like
                          the click had failed. */}
                      {course.myApplication?.status === "pending" ? (
                        <span className="flex items-center gap-1.5 rounded-xl bg-[#CAA25F]/15 px-3 py-2 text-[12.5px] font-medium text-[#8a6a2a] dark:text-[#CAA25F]">
                          <Clock size={13} /> Applied
                        </span>
                      ) : course.myApplication?.status === "accepted" ? (
                        <span className="flex items-center gap-1.5 rounded-xl bg-[#1099A1]/12 px-3 py-2 text-[12.5px] font-medium text-[#1099A1]">
                          <Check size={13} /> Accepted
                        </span>
                      ) : (
                        <button
                          onClick={() => setApplying(course)}
                          className="rounded-xl bg-[#1099A1] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#0d7f86]"
                        >
                          {course.myApplication?.status === "rejected" ? "Apply again" : "Apply"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!withdrawing}
        title="Withdraw this application?"
        message={
          <>
            Your application to teach{" "}
            <span className="font-medium text-[#111] dark:text-white">{withdrawing?.title}</span> is
            taken out of the queue. You can apply again later, but the team will not see this one.
          </>
        }
        confirmLabel="Withdraw"
        destructive
        busy={busy}
        onConfirm={() => withdrawing && void withdraw(withdrawing.app)}
        onCancel={() => setWithdrawing(null)}
      />

      {applying && user && (
        <ApplyDialog
          course={applying}
          userId={user.id}
          profile={profile}
          resumePath={(profile as any)?.resume_url ?? null}
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
    <div className="py-20 text-center">
      <BookOpen size={32} className="mx-auto mb-3 text-[#aebac1]" />
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}
