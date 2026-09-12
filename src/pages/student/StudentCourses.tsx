import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StarRating } from "@/components/ui/StarRating";
import { useAuth } from "@/contexts/AuthContext";
import { money } from "@/services/billingService";
import {
  askParentForCourse,
  countLinkedParents,
  getCatalogCourses,
} from "@/services/courseApplicationService";
import { getTutorRatings } from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

// ============================================================
// The course catalog, for the person who cannot buy one.
//
// My Learning shows what a student is already enrolled in and its empty state
// said "Courses appear here after enrollment", which is a dead end: the
// student who most needs to see the catalogue is the one with nothing in it.
//
// So this is the parent's catalogue with the money taken out. Same read, same
// card, and no route behind it: everything on the parent side of a course card
// is picking a tutor, picking hours and paying, none of which is a student's
// to do. What a student gets instead is a way to point at one.
//
// The price is shown on purpose. Asking somebody to spend money without being
// told how much is worse than not asking, and seeing a price is not setting or
// paying one.
// ============================================================

const ITEMS_PER_PAGE = 6;

export function StudentCourses() {
  const { user, profile } = useAuth();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  // Session-local only. Nothing is stored, so this survives no reload; it is
  // here to stop a double tap sending twice, not to be a record.
  const [asked, setAsked] = useState<Set<string>>(new Set());

  const { data: catalogCourses = [], isLoading } = useQuery({
    queryKey: ["catalog-courses"],
    queryFn: getCatalogCourses,
  });

  // Read up front rather than on the click, so a student with nobody to ask is
  // told that instead of being given a button whose only outcome is an error.
  const { data: parentCount } = useQuery({
    queryKey: ["linked-parent-count", user?.id],
    queryFn: () => countLinkedParents(user!.id),
    enabled: !!user?.id,
  });
  const hasParent = (parentCount ?? 0) > 0;

  const tutorIds = useMemo(
    () => [...new Set(catalogCourses.flatMap((c) => c.tutors.map((t) => t.id)))],
    [catalogCourses]
  );
  const { data: ratings } = useQuery({
    queryKey: ["catalog-tutor-ratings", tutorIds],
    queryFn: () => getTutorRatings(tutorIds),
    enabled: tutorIds.length > 0,
  });

  // Wired, unlike the one on the parent catalogue, which is an input bound to
  // nothing. Title and subject: a student looks for "SAT" or "chemistry".
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalogCourses;
    return catalogCourses.filter((c) =>
      [c.title, c.subject, c.description].some((f) => (f ?? "").toLowerCase().includes(needle))
    );
  }, [catalogCourses, query]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const page = Math.min(currentPage, Math.max(1, totalPages));
  const startIndex = (page - 1) * ITEMS_PER_PAGE;
  const visibleCourses = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  async function ask(courseId: string, courseTitle: string, priceCents: number | null) {
    if (!user || !profile) return;
    setAsking(courseId);
    const res = await askParentForCourse({
      studentId: user.id,
      studentName: profile.full_name,
      courseId,
      courseTitle,
      price: priceCents != null ? `${money(priceCents)} a session` : "Price on request",
    });
    setAsking(null);
    if (!res.success) return toast.error(res.error || "Could not send that.");
    setAsked((s) => new Set(s).add(courseId));
    toast.success(
      res.asked && res.asked > 1 ? "Both your parents were asked." : "Your parent was asked."
    );
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background pb-12">
        <div className="relative shrink-0 overflow-hidden bg-primary px-6 pb-6 pt-6 text-white md:px-10 md:pb-8 md:pt-10">
          <svg className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 mx-auto flex max-w-[1440px] flex-col gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Find a course</h1>
              <p className="pt-1 text-[15px] text-white/80">
                {hasParent
                  ? "Ask a parent to book any of these."
                  : "What Yakal teaches."}
              </p>
            </div>

            <div className="flex flex-row items-center justify-between gap-3 border-t border-white/20 pt-4">
              <div className="flex min-w-0 flex-1 items-center gap-4 lg:w-auto lg:flex-none">
                <div className="hidden shrink-0 rounded-lg border border-white/20 bg-black/10 p-1 sm:flex">
                  <button
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                    className={cn("rounded-md p-1.5 transition-colors", viewMode === "grid" ? "bg-white text-primary shadow-sm" : "text-white hover:bg-white/20")}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    className={cn("rounded-md p-1.5 transition-colors", viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-white hover:bg-white/20")}
                  >
                    <List size={16} />
                  </button>
                </div>

                <div className="relative flex-1 lg:w-[300px]">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Search size={16} className="text-white/60" />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search courses..."
                    className="h-9 w-full rounded-lg border border-white/20 bg-black/10 py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-white/60 focus:border-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="mr-2 hidden text-[13px] text-white/80 sm:inline">
                  Showing {filtered.length === 0 ? 0 : startIndex + 1}-
                  {Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className="rounded-lg border border-white/20 p-1.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  aria-label="Next page"
                  className="rounded-lg border border-white/20 p-1.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto h-full w-full max-w-[1440px] p-4 md:p-8">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-[15px] font-medium text-foreground">
                {query ? "Nothing matches that" : "No courses yet"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
                {query
                  ? "Try the subject instead of the course name."
                  : "Courses appear here as soon as they are published."}
              </p>
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-4 md:gap-6",
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                  : "grid-cols-1 lg:grid-cols-2"
              )}
            >
              {visibleCourses.map((course) => (
                <article
                  key={course.id}
                  className={cn(
                    "flex flex-col overflow-hidden rounded-[16px] border border-border bg-card dark:bg-surface-raised",
                    viewMode === "list" && "sm:flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "relative shrink-0 overflow-hidden",
                      viewMode === "list" ? "h-[180px] w-full sm:h-auto sm:w-[200px]" : "aspect-video w-full"
                    )}
                  >
                    {course.thumbnailUrl ? (
                      <img src={course.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-primary/10 text-primary">
                        <BookOpen size={28} />
                      </div>
                    )}
                  </div>

                  <div className={cn("flex flex-1 flex-col", viewMode === "list" ? "p-4" : "p-5")}>
                    <div className="mb-2 flex items-start justify-between">
                      <h3 className="line-clamp-2 pr-2 text-[16px] font-medium leading-tight text-foreground">
                        {course.title}
                      </h3>
                      <div className="shrink-0 text-right">
                        {course.priceCents != null ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-[16px] font-medium leading-none text-foreground">
                              {money(course.priceCents)}
                            </span>
                            <span className="text-[11px] text-muted-foreground">/session</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-muted-foreground">Price on request</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-4 line-clamp-2 text-[12px] text-muted-foreground">
                      {course.description ?? course.subject}
                    </div>

                    <div className="mt-auto mb-4 h-px w-full bg-border" />

                    <div className="mb-4 flex items-center gap-2.5">
                      <div className="flex shrink-0 -space-x-2">
                        {course.tutors.slice(0, 3).map((t) => (
                          <img
                            key={t.id}
                            className="h-8 w-8 rounded-full object-cover ring-2 ring-card dark:ring-surface-raised"
                            src={t.avatarUrl || dicebearUrl(t.name)}
                            alt=""
                          />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {course.tutors.length === 1 ? course.tutors[0].name : `${course.tutors.length} tutors`}
                        </p>
                        {/* Only with one tutor. Averaging a roster would invent
                            a number, so a course with several says how many. */}
                        {course.tutors.length === 1 ? (
                          <StarRating
                            average={ratings?.get(course.tutors[0].id)?.averageStars}
                            count={ratings?.get(course.tutors[0].id)?.ratingCount ?? 0}
                            size={12}
                          />
                        ) : (
                          <p className="truncate text-[12px] text-muted-foreground">
                            Your parent picks who teaches
                          </p>
                        )}
                      </div>
                    </div>

                    {/* The only action on this page, and it buys nothing. */}
                    {!hasParent ? (
                      <p className="text-[13px] text-muted-foreground">
                        Link a parent to your account to ask for this.
                      </p>
                    ) : asked.has(course.id) ? (
                      <p className="flex items-center gap-1.5 text-[13px] text-primary">
                        <Check size={14} /> Waiting for parent to confirm
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => ask(course.id, course.title, course.priceCents)}
                        disabled={asking === course.id}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
                      >
                        {asking === course.id && <Loader2 size={14} className="animate-spin" />}
                        Ask a parent to book this
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {!isLoading && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[14px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="text-[13px] text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[14px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
