import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ExternalLink,
  Loader2,
  Pencil,
  Users,
  Wallet,
} from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { CourseApplicants } from "@/components/admin/CourseApplicants";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { money } from "@/services/billingService";
import { getCourse, getCourseDetail, updateCourse } from "@/services/adminService";
import { getApplicants } from "@/services/courseApplicationService";

// ============================================================
// One course, for an admin.
//
// The old page was a marketing layout: a hero banner, centred cards, and tabs
// for Students and Sessions that each rendered a paragraph describing what
// they would one day contain. It is kept at /admin/courses/:id/classic.
//
// This is a dashboard. The job an admin comes here to do is decide who teaches
// the course, so the applicants are the page rather than a tab inside it, and
// the numbers that bear on that decision sit above them. Students and sessions
// are real rows now.
//
// Applicants stay here rather than moving to /admin/applicants. That page
// answers "should this person tutor on Yakal at all", decided once per person.
// This answers "who should teach this course", which is a comparison between
// the people who applied to it. Splitting them would lose the comparison.
// ============================================================

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={13} />
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-1.5 text-[22px] font-medium leading-none text-foreground">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function AdminCourseDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: course, isLoading } = useQuery({
    queryKey: ["admin-course", id],
    queryFn: () => getCourse(id!),
    enabled: !!id,
  });

  const { data: detail } = useQuery({
    queryKey: ["admin-course-detail", id],
    queryFn: () => getCourseDetail(id!),
    enabled: !!id,
  });

  const { data: applicants = [] } = useQuery({
    queryKey: ["course-applicants", id],
    queryFn: () => getApplicants(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex justify-center py-24">
          <Loader2 className="animate-spin text-[#1099A1]" />
        </div>
      </PageWrapper>
    );
  }

  if (!course) {
    return (
      <PageWrapper>
        <div className="py-24 text-center text-muted-foreground">Course not found.</div>
      </PageWrapper>
    );
  }

  const pending = applicants.filter((a) => a.status === "pending").length;
  const assigned = !!course.tutor_id;

  async function toggleActive() {
    if (!course) return;
    setBusy(true);
    const res = await updateCourse(course.id, { is_active: !course.is_active });
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not update that course.");
    toast.success(course.is_active ? "Course hidden from the catalog" : "Course published");
    qc.invalidateQueries({ queryKey: ["admin-course", id] });
  }

  return (
    <PageWrapper>
      <div className="mx-auto max-w-[1100px] space-y-6">
        {/* A compact strip rather than a banner: an admin arrives knowing which
            course this is, and wants the state of it. */}
        <div>
          <Link
            to="/admin/courses"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft size={15} /> All courses
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              {course.thumbnail_url && (
                <img
                  src={course.thumbnail_url}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0">
                <h1 className="text-[22px] font-medium text-foreground">{course.title}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[12px] text-muted-foreground">
                    {course.subject}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[12px] font-medium",
                      course.is_active
                        ? "bg-[#1099A1]/12 text-[#1099A1]"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {course.is_active ? "Published" : "Hidden"}
                  </span>
                  {!assigned && (
                    <span className="rounded-full bg-[#CAA25F]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#8a6a2a] dark:text-[#CAA25F]">
                      {pending > 0
                        ? `${pending} applicant${pending === 1 ? "" : "s"} waiting`
                        : "No tutor yet"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => void toggleActive()}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {course.is_active ? "Hide" : "Publish"}
              </button>
              <Link
                to={`/admin/courses/${course.id}/classic`}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60"
              >
                <Pencil size={14} /> Edit
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={Users}
            label="Students"
            value={detail?.students.length ?? 0}
            hint={assigned ? undefined : "Bookable once a tutor is assigned"}
          />
          <Stat icon={CalendarDays} label="Sessions" value={detail?.sessions.length ?? 0} />
          <Stat
            icon={Wallet}
            label="Revenue"
            value={money(detail?.revenueCents ?? 0)}
            hint={course.price_cents != null ? `${money(course.price_cents)} per session` : undefined}
          />
          <Stat
            icon={Wallet}
            label="Owed to tutor"
            value={money(detail?.unpaidPayoutCents ?? 0)}
            hint={
              (detail?.unpaidPayoutCents ?? 0) > 0
                ? "Paid by hand, then marked settled"
                : "Nothing outstanding"
            }
          />
        </div>

        {/* The decision this page exists for. */}
        <div className="rounded-xl border border-border bg-card p-5">
          {assigned ? (
            <>
              <h2 className="mb-4 text-[15px] font-medium text-foreground">Tutor</h2>
              <AssignedTutor
                courseId={course.id}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: ["admin-course", id] });
                  qc.invalidateQueries({ queryKey: ["admin-course-detail", id] });
                }}
              />
            </>
          ) : (
            <CourseApplicants
              courseId={course.id}
              courseTitle={course.title}
              assignedTutorId={null}
              onAssigned={() => {
                qc.invalidateQueries({ queryKey: ["admin-course", id] });
                qc.invalidateQueries({ queryKey: ["admin-course-detail", id] });
              }}
            />
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[15px] font-medium text-foreground">
              Enrolled students
              {(detail?.students.length ?? 0) > 0 && (
                <span className="ml-2 text-[13px] text-muted-foreground">
                  {detail?.students.length}
                </span>
              )}
            </h2>

            {(detail?.students.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                Nobody has enrolled yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {detail!.students.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <img
                      src={s.avatarUrl || dicebearUrl(s.name)}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">{s.name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {s.gradeLevel ?? "Grade not set"}
                        {s.purchasedByName && ` - paid by ${s.purchasedByName}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {new Date(s.enrolledAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-[15px] font-medium text-foreground">
              Sessions
              {(detail?.sessions.length ?? 0) > 0 && (
                <span className="ml-2 text-[13px] text-muted-foreground">
                  {detail?.sessions.length}
                </span>
              )}
            </h2>

            {(detail?.sessions.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">
                No sessions booked yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {detail!.sessions.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <div className="w-14 shrink-0">
                      <p className="text-[13px] font-medium text-foreground">{fmtDate(s.date)}</p>
                      <p className="text-[11.5px] text-muted-foreground">{fmtTime(s.startTime)}</p>
                    </div>
                    <p className="min-w-0 flex-1 truncate text-[13.5px] text-foreground">
                      {s.studentName ?? "A student"}
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-[12px] font-medium capitalize",
                        s.status === "upcoming" ? "text-[#1099A1]" : "text-muted-foreground"
                      )}
                    >
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {course.description && (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-2 text-[15px] font-medium text-foreground">Description</h2>
            <p className="text-[14px] leading-relaxed text-muted-foreground">{course.description}</p>
            {course.google_classroom_url && (
              <a
                href={course.google_classroom_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[#1099A1] hover:underline"
              >
                Google Classroom <ExternalLink size={13} />
              </a>
            )}
          </section>
        )}
      </div>
    </PageWrapper>
  );
}

/**
 * The tutor teaching this course, with a way to take them off it.
 *
 * Unassigning clears courses.tutor_id and reopens the course, which is the
 * only route back to the applicant list once somebody has been accepted.
 */
function AssignedTutor({ courseId, onChanged }: { courseId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const { data: applicants = [] } = useQuery({
    queryKey: ["course-applicants", courseId],
    queryFn: () => getApplicants(courseId),
  });

  const accepted = applicants.find((a) => a.status === "accepted");
  const turnedDown = applicants.filter((a) => a.status === "rejected").length;

  async function unassign() {
    setBusy(true);
    const res = await updateCourse(courseId, { tutor_id: null } as never);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not unassign that tutor.");
    toast.success("Course reopened for applications.");
    onChanged();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <img
          src={accepted?.tutor.avatarUrl || dicebearUrl(accepted?.tutor.name ?? "Tutor")}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-foreground">
            {accepted?.tutor.name ?? "Assigned"}
          </p>
          {accepted?.tutor.email && (
            <p className="text-[12.5px] text-muted-foreground">{accepted.tutor.email}</p>
          )}
          {accepted?.tutor.subjects?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {accepted.tutor.subjects.slice(0, 4).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          onClick={() => void unassign()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[13px] font-medium transition-colors hover:bg-muted/60 disabled:opacity-50"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          Unassign
        </button>
      </div>

      {turnedDown > 0 && (
        <p className="mt-4 border-t border-border pt-3 text-[12.5px] text-muted-foreground">
          {turnedDown} other applicant{turnedDown === 1 ? " was" : "s were"} turned down for this
          course.
        </p>
      )}
    </div>
  );
}
