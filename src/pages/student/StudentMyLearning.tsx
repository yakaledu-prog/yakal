import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Link } from "react-router-dom";
import { Search, LayoutGrid, List, Loader2, BookOpen } from "lucide-react";
import { cn } from "@/utils/cn";
import { useAuth } from "@/contexts/AuthContext";
import { getStudentCourses } from "@/services/studentService";

export function StudentMyLearning() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [query, setQuery] = useState("");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["student-courses", user?.id],
    queryFn: () => getStudentCourses(user!.id),
    enabled: !!user?.id,
  });

  const visible = useMemo(
    () =>
      courses.filter((c) =>
        `${c.title} ${c.subject}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [courses, query]
  );

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
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Learning</h1>
                <p className="text-white/80 text-[15px] pt-1">
                  Track your progress and continue where you left off
                </p>
              </div>
            </div>

            {/* Controls Row inside header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-4 w-full sm:w-auto">
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

                <div className="relative flex-1 sm:w-[300px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-white/60" />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search enrolled courses..."
                    className="pl-9 pr-3 py-2 h-9 bg-black/10 text-white placeholder:text-white/60 border border-white/20 rounded-lg focus:outline-none focus:border-white w-full text-[13px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-4 md:p-8 w-full h-full">

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-[#1099A1]" size={26} />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen size={40} className="mx-auto text-[#aebac1] mb-3" />
            <p className="text-[15px] font-semibold text-foreground">
              {query ? "No course matches that" : "No courses yet"}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-sm mx-auto">
              {query
                ? "Try a different search."
                : "Courses appear here once a session has been booked for you."}
            </p>
          </div>
        ) : (
        /* Course List/Grid */
        <div className={cn(
          "grid gap-4",
          viewMode === "grid"
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1"
        )}>
          {visible.map(course => (
            <Link
              key={course.id}
              to={`/student/my-learning/${course.id}/overview`}
              className={cn(
                "group bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-[16px] overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-primary/50 flex flex-col",
                viewMode === "list" ? "sm:flex-row" : ""
              )}
            >
              {/* Thumbnail */}
              <div className={cn(
                "relative overflow-hidden shrink-0 border-[#e9edef] dark:border-[#2a3942]",
                viewMode === "grid" ? "w-full aspect-video border-b" : "w-full sm:w-[280px] aspect-video sm:h-full sm:border-r"
              )}>
                <img
                  src={course.thumbnailUrl ?? ""}
                  alt={course.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Info */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-[18px] font-bold text-[#111] dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                    {course.title}
                  </h3>
                  <Badge variant={course.status === 'Done' ? 'success' : course.status === 'In progress' ? 'secondary' : 'outline'} className="rounded-sm text-[11px] font-semibold px-2 py-0.5 uppercase tracking-wider shrink-0 mt-1">
                    {course.status}
                  </Badge>
                </div>

                <div className="text-[13px] text-[#54656f] dark:text-[#aebac1] mb-6 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <span className="font-semibold text-[#111] dark:text-[#e9edef]">Subject:</span> {course.subject}
                  </span>
                  {course.tutorName && (
                    <span>
                      <span className="font-semibold text-[#111] dark:text-[#e9edef]">Tutor:</span> {course.tutorName}
                    </span>
                  )}
                </div>

                {/* Deadline & Progress */}
                <div className="mt-auto w-full flex flex-col gap-2">
                  <div className="flex justify-between text-[12px] font-semibold">
                    <span className="text-[#54656f] dark:text-[#aebac1]">
                      {course.nextDue
                        ? `Next due ${course.nextDue.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                        : course.total === 0
                          ? "No assignments yet"
                          : "All caught up"}
                    </span>
                    <span className="text-[#111] dark:text-white">
                      {course.completed}/{course.total} - {course.progress}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-[#e9edef] dark:bg-[#2a3942] rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${course.progress}%`,
                        backgroundColor: course.progress === 100 ? '#38A169' : '#1099A1'
                      }}
                    />
                  </div>
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
