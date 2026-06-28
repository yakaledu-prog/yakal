import React, { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Link } from "react-router-dom";
import { Search, LayoutGrid, List } from "lucide-react";
import { cn } from "@/utils/cn";

interface Course {
  id: string;
  title: string;
  thumbnail: string;
  subject: string;
  progress: number;
  status: "In progress" | "Done" | "Pending";
  deadline: string;
}

const mockCourses: Course[] = [
  { id: "CAT-01", title: "Algebra Fundamentals", thumbnail: "https://picsum.photos/seed/algebra/400/225", subject: "Mathematics", progress: 65, status: "In progress", deadline: "Oct 16, 2023" },
  { id: "CAT-02", title: "Geometry Mastery", thumbnail: "https://picsum.photos/seed/geometry/400/225", subject: "Mathematics", progress: 20, status: "In progress", deadline: "Oct 20, 2023" },
  { id: "CAT-03", title: "Pre-Calculus Intensive", thumbnail: "https://picsum.photos/seed/precalc/400/225", subject: "Mathematics", progress: 100, status: "Done", deadline: "Oct 10, 2023" },
  { id: "CAT-04", title: "SAT Prep Complete", thumbnail: "https://picsum.photos/seed/sat/400/225", subject: "Test Prep", progress: 0, status: "Pending", deadline: "Nov 01, 2023" },
];

export function StudentMyLearning() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 md:p-8 h-full dark:bg-[#111b21]">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 bg-white dark:bg-[#111b21] p-4 rounded-xl border border-[#e9edef] dark:border-[#2a3942] shadow-sm">
          
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* View Toggles */}
            <div className="flex bg-[#f8f9fa] dark:bg-[#182329] p-1 rounded-lg border border-[#e9edef] dark:border-[#2a3942] shrink-0">
              <button 
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 rounded-md transition-colors", 
                  viewMode === "grid" ? "bg-white dark:bg-[#202c33] text-primary shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
                )}
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-2 rounded-md transition-colors", 
                  viewMode === "list" ? "bg-white dark:bg-[#202c33] text-primary shadow-sm" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
                )}
              >
                <List size={18} />
              </button>
            </div>
            
            {/* Search */}
            <div className="relative flex-1 sm:w-[300px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
              </div>
              <input
                type="text"
                placeholder="Search enrolled courses..."
                className="pl-9 pr-3 py-2 h-10 bg-[#f8f9fa] dark:bg-[#182329] text-[#111] dark:text-white border border-[#e9edef] dark:border-[#2a3942] rounded-lg focus:outline-none focus:border-primary w-full text-[14px]"
              />
            </div>
          </div>
        </div>

        {/* Course List/Grid */}
        <div className={cn(
          "grid gap-4",
          viewMode === "grid" 
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
            : "grid-cols-1"
        )}>
          {mockCourses.map(course => (
            <Link 
              key={course.id} 
              to={`/student/my-learning/${course.id}/tasks`}
              className={cn(
                "group bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-[16px] overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-primary/50 flex flex-col",
                viewMode === "list" ? "sm:flex-row" : ""
              )}
            >
              {/* Thumbnail */}
              <div className={cn(
                "relative overflow-hidden shrink-0",
                viewMode === "list" ? "w-full sm:w-[240px] aspect-video" : "w-full aspect-video"
              )}>
                <img 
                  src={course.thumbnail} 
                  alt={course.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
                
                <div className="text-[13px] text-[#54656f] dark:text-[#aebac1] mb-6">
                  <span className="font-semibold text-[#111] dark:text-[#e9edef]">Subject:</span> {course.subject}
                </div>

                {/* Deadline & Progress */}
                <div className="mt-auto w-full flex flex-col gap-2">
                  <div className="flex justify-between text-[12px] font-semibold">
                    <span className="text-[#54656f] dark:text-[#aebac1]">Deadline: {course.deadline}</span>
                    <span className="text-[#111] dark:text-white">{course.progress}%</span>
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

      </div>
    </PageWrapper>
  );
}
