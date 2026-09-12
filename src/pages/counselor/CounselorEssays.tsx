import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { getCounselorStudents } from "@/services/counselorService";
import { loadCatalog } from "@/services/collegeCatalogService";
import { getReviewQueue, type ReviewQueueItem } from "@/services/essayReviewService";
import { getAdmissionsPlans } from "@/services/admissionsService";
import { EssayReviewList } from "@/components/college/EssayReviewList";

// ============================================================
// Everything waiting on a counselor, across every student.
//
// The list itself is EssayReviewList, because a counselor sees the same list
// on one student's page and two screens that drift are worse than one with a
// prop. What is only here is the banner: the caseload as four figures, which
// is the question this page answers before any individual essay does.
// ============================================================

/** The four the banner reads, in the order a counselor cares about them. */
const HEADLINES = [
  { id: "waiting", label: "Waiting on me", match: (e: ReviewQueueItem) => e.status === "in_review" },
  { id: "drafting", label: "With the student", match: (e: ReviewQueueItem) => e.status === "drafting" || e.status === "todo" },
  { id: "done", label: "Finished", match: (e: ReviewQueueItem) => e.status === "done" },
] as const;

export function CounselorEssays() {
  const { user, profile } = useAuth();

  const { data: students = [] } = useQuery({
    queryKey: ["counselor-students", user?.id],
    queryFn: () => getCounselorStudents(user!.id),
    enabled: !!user?.id,
  });

  const studentIds = students.map((s) => s.id);

  const { data: essays = [], isLoading } = useQuery({
    queryKey: ["review-queue", studentIds.join(",")],
    queryFn: () => getReviewQueue(studentIds),
    enabled: studentIds.length > 0,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const { data: plans } = useQuery({
    queryKey: ["admissions-plans", studentIds.join(",")],
    queryFn: () => getAdmissionsPlans(studentIds),
    enabled: studentIds.length > 0,
  });

  const counts = useMemo(
    () =>
      Object.fromEntries(
        HEADLINES.map((h) => [h.id, essays.filter(h.match).length])
      ) as Record<(typeof HEADLINES)[number]["id"], number>,
    [essays]
  );

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background pb-12 dark:bg-[#111b21]">
        <header className="relative overflow-hidden bg-primary px-6 py-7 text-white md:px-10 md:py-9">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          </svg>

          <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Essays</h1>
              <p className="mt-1 text-[14px] text-white/80">
                {counts.waiting === 0
                  ? "Nothing is waiting on you."
                  : `${counts.waiting} waiting on you across ${students.length} ${students.length === 1 ? "student" : "students"}.`}
              </p>
            </div>

            {/* Read rather than clicked. A tab strip made you press one to find
                out how many were behind it; as figures they are legible at
                once, and the tags below are what actually filters. */}
            <div className="flex flex-wrap items-end gap-8 pb-1">
              {HEADLINES.map((h) => (
                <div key={h.id} className="text-left">
                  <p className="text-2xl font-bold leading-none tabular-nums">{counts[h.id]}</p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-wider text-white/70">
                    {h.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <EssayReviewList
              essays={essays}
              plans={plans}
              catalog={catalog}
              counselorId={user?.id}
              counselorName={profile?.full_name ?? undefined}
              students={students}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
