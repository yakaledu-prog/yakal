import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { money } from "@/services/billingService";
import { dicebearUrl } from "@/utils/avatar";
import { getCatalogCourses } from "@/services/courseApplicationService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Search, LayoutGrid, List, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { StarRating } from "@/components/ui/StarRating";
import { getTutorRatings } from "@/services/tutorService";

// ============================================================
// The course catalog.
//
// Six hardcoded cards before this, with invented ratings, student counts and
// tutor avatars pulled from pravatar, under ids like "CAT-01" that matched no
// row. Clicking any of them opened a booking page for a course that did not
// exist.
//
// Real courses now. A card shows the tutor if one has been approved, and says
// so plainly when none has, rather than promising three faces.
// ============================================================

export function ParentCourses() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const { data: catalogCourses = [], isLoading } = useQuery({
    queryKey: ["catalog-courses"],
    queryFn: getCatalogCourses,
  });

  // One lookup for every tutor in the catalog rather than one per card. The
  // ratings are the same view the tutor's own profile and the course detail
  // page read, so a card cannot disagree with the page it opens.
  const tutorIds = useMemo(
    () => catalogCourses.map((c) => c.tutor?.id).filter(Boolean) as string[],
    [catalogCourses]
  );
  const { data: ratings } = useQuery({
    queryKey: ["catalog-tutor-ratings", tutorIds],
    queryFn: () => getTutorRatings(tutorIds),
    enabled: tutorIds.length > 0,
  });

  const totalPages = Math.ceil(catalogCourses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleCourses = catalogCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Header */}
        <div className="bg-[#1099A1] text-white pt-6 md:pt-10 px-6 md:px-10 pb-6 md:pb-8 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-1">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Course Catalog</h1>
                <p className="text-white/80 text-[15px] pt-1">
                  Explore and enroll in new courses
                </p>
              </div>
            </div>

            {/* Controls Row inside header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-4 w-full lg:w-auto">
                {/* View Toggles */}
                <div className="flex bg-black/10 p-1 rounded-lg border border-white/20 shrink-0">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-white text-[#1099A1] shadow-sm" : "text-white hover:bg-white/20")}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-white text-[#1099A1] shadow-sm" : "text-white hover:bg-white/20")}
                  >
                    <List size={16} />
                  </button>
                </div>

                {/* Search */}
                <div className="relative flex-1 lg:w-[300px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-white/60" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search courses..."
                    className="pl-9 pr-3 py-2 h-9 bg-black/10 text-white placeholder:text-white/60 border border-white/20 rounded-lg focus:outline-none focus:border-white w-full text-[13px]"
                  />
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center gap-2 self-end lg:self-auto">
                <span className="text-[13px] text-white/80 mr-2">
                  Showing {catalogCourses.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, catalogCourses.length)} of {catalogCourses.length}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-4 md:p-8 w-full h-full">

          {/* Catalog Grid */}
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#1099A1]" />
            </div>
          ) : catalogCourses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#e9edef] dark:border-[#2a3942] py-16 text-center">
              <BookOpen size={32} className="mx-auto mb-3 text-[#aebac1]" />
              <p className="text-[15px] font-medium text-[#111] dark:text-white">No courses yet</p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#54656f] dark:text-[#aebac1]">
                Courses appear here as soon as they are published.
              </p>
            </div>
          ) : (
          <div className={cn(
            "grid gap-4 md:gap-6",
            viewMode === "grid"
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
              : "grid-cols-1 lg:grid-cols-2"
          )}>
            {visibleCourses.map(course => (
              <Link
                key={course.id}
                to={`/parent/courses/${course.id}`}
                className={cn(
                  "group bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[16px] overflow-hidden ring-2 ring-transparent hover:ring-primary/50 transition-all ease-in-out duration-300 hover:border-primary/50 flex flex-col",
                  viewMode === "list" && "sm:flex-row sm:h-[160px]"
                )}
              >
                {/* Thumbnail */}
                <div className={cn(
                  "relative overflow-hidden shrink-0",
                  viewMode === "list" ? "w-full h-[180px] sm:h-full sm:w-[220px]" : "w-full aspect-video"
                )}>
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center bg-[#1099A1]/10 text-[#1099A1]">
                      <BookOpen size={28} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Content */}
                <div className={cn(
                  "flex flex-col flex-1",
                  viewMode === "list" ? "p-4" : "p-5"
                )}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-[16px] font-bold text-[#111] dark:text-white leading-tight group-hover:text-primary transition-colors line-clamp-2 pr-2">
                      {course.title}
                    </h3>
                    <div className="text-right shrink-0 flex flex-col items-end">
                      {course.priceCents != null ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-[16px] font-bold text-[#111] dark:text-white leading-none">{money(course.priceCents)}</span>
                          <span className="text-[11px] text-[#54656f] dark:text-[#aebac1]">/session</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-[#54656f] dark:text-[#aebac1]">Price on request</span>
                      )}
                    </div>
                  </div>

                  <div className={cn(
                    "text-[12px] text-[#54656f] dark:text-[#aebac1] line-clamp-2",
                    viewMode === "list" ? "mb-2" : "mb-4 mt-auto"
                  )}>
                    {course.description ?? course.subject}
                  </div>

                  {/* Divider */}
                  <div className={cn(
                    "w-full h-px bg-[#e9edef] dark:bg-[#2a3942]",
                    viewMode === "list" ? "my-3 mt-auto" : "mb-4"
                  )} />

                  {/* Avatar Stack & Count */}
                  <div className="flex items-center gap-2.5">
                    {course.tutor ? (
                      <>
                        <img
                          className="w-8 h-8 rounded-full object-cover"
                          src={course.tutor.avatarUrl || dicebearUrl(course.tutor.name)}
                          alt=""
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#111] dark:text-white">
                            {course.tutor.name}
                          </p>
                          {/* Real, from the same view as everywhere else. The
                              six cards this replaced carried invented ones,
                              which is why stars were dropped at the time. */}
                          <StarRating
                            average={ratings?.get(course.tutor.id)?.averageStars}
                            count={ratings?.get(course.tutor.id)?.ratingCount ?? 0}
                            size={12}
                          />
                        </div>
                      </>
                    ) : (
                      <span className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
                        Tutor being assigned
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
