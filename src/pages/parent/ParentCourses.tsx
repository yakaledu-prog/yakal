import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Search, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";

import imgMath from "@/assets/images/subject-math.png";
import imgEla from "@/assets/images/subject-ela.png";
import imgPhysics from "@/assets/images/subject-physics-new.png";
import imgStandardized from "@/assets/images/subject-standardized.png";
import imgAp from "@/assets/images/subject-ap.png";
import imgEssays from "@/assets/images/subject-essays.png";

interface CatalogCourse {
  id: string;
  title: string;
  thumbnail: string;
  price: string;
  coursePrice: string;
  students: number;
  tutorsCount: number;
  rating: number;
  reviewers: number;
}

const baseCourses = [
  { id: "CAT-01", title: "K-12 Math", thumbnail: imgMath, price: "$49.99", coursePrice: "$199.96", students: 1204, tutorsCount: 12, rating: 4.8, reviewers: 320 },
  { id: "CAT-02", title: "K-12 ELA", thumbnail: imgEla, price: "$89.00", coursePrice: "$249.00", students: 850, tutorsCount: 8, rating: 4.7, reviewers: 210 },
  { id: "CAT-03", title: "Physics", thumbnail: imgPhysics, price: "$29.50", coursePrice: "$149.50", students: 3400, tutorsCount: 15, rating: 4.9, reviewers: 1024 },
  { id: "CAT-04", title: "Standardized Testing", thumbnail: imgStandardized, price: "$55.00", coursePrice: "$199.00", students: 5600, tutorsCount: 22, rating: 4.6, reviewers: 450 },
  { id: "CAT-05", title: "AP Courses", thumbnail: imgAp, price: "$120.00", coursePrice: "$399.00", students: 430, tutorsCount: 5, rating: 5.0, reviewers: 89 },
  { id: "CAT-06", title: "College Essays", thumbnail: imgEssays, price: "$35.00", coursePrice: "$99.00", students: 2100, tutorsCount: 10, rating: 4.8, reviewers: 530 },
];

export function ParentCourses() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  const catalogCourses: CatalogCourse[] = baseCourses.map((c) => ({
    ...c,
  }));

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
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
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
                      <div className="flex items-baseline gap-1">
                        <span className="text-[16px] font-bold text-[#111] dark:text-white leading-none">{course.coursePrice}</span>
                        <span className="text-[11px] text-[#54656f] dark:text-[#aebac1]">/course</span>
                      </div>
                      <div className="text-[10px] text-[#54656f] dark:text-[#aebac1] mt-0.5">
                        or from <span className="font-medium text-[#111] dark:text-white">{course.price}</span>/hr
                      </div>
                    </div>
                  </div>

                  <div className={cn(
                    "flex items-center gap-3 text-[12px] text-[#54656f] dark:text-[#aebac1]",
                    viewMode === "list" ? "mb-2" : "mb-4 mt-auto"
                  )}>
                    <span className="flex items-center gap-1">
                      <span className="text-yellow-500 flex items-center">
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/></svg>
                      </span>
                      <strong className="text-[#111] dark:text-[#e9edef] font-bold">{course.rating}</strong>
                      <span>({course.reviewers})</span>
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[#e9edef] dark:bg-[#2a3942]" />
                    <span>{course.students.toLocaleString()} Students</span>
                  </div>

                  {/* Divider */}
                  <div className={cn(
                    "w-full h-px bg-[#e9edef] dark:bg-[#2a3942]",
                    viewMode === "list" ? "my-3 mt-auto" : "mb-4"
                  )} />

                  {/* Avatar Stack & Count */}
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      <img className="w-8 h-8 rounded-full border-2 border-white dark:border-[#202c33] object-cover" src={`https://i.pravatar.cc/150?u=${course.id}1`} alt="Tutor avatar" />
                      <img className="w-8 h-8 rounded-full border-2 border-white dark:border-[#202c33] object-cover" src={`https://i.pravatar.cc/150?u=${course.id}2`} alt="Tutor avatar" />
                      <img className="w-8 h-8 rounded-full border-2 border-white dark:border-[#202c33] object-cover" src={`https://i.pravatar.cc/150?u=${course.id}3`} alt="Tutor avatar" />
                    </div>
                    <span className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
                      + {course.tutorsCount - 3} available tutors
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
