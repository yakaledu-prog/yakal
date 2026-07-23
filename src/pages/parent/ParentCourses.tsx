import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Search, LayoutGrid, List, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

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
  duration: string;
  students: number;
  tutor: {
    name: string;
    avatar: string;
  };
}

const baseCourses = [
  { id: "CAT-01", title: "K-12 Math", thumbnail: imgMath, price: "$49.99", duration: "3 months", students: 1204 },
  { id: "CAT-02", title: "K-12 ELA", thumbnail: imgEla, price: "$89.00", duration: "6 months", students: 850 },
  { id: "CAT-03", title: "Physics", thumbnail: imgPhysics, price: "$29.50", duration: "2 months", students: 3400 },
  { id: "CAT-04", title: "Standardized Testing", thumbnail: imgStandardized, price: "$55.00", duration: "4 months", students: 5600 },
  { id: "CAT-05", title: "AP Courses", thumbnail: imgAp, price: "$120.00", duration: "2 months", students: 430 },
  { id: "CAT-06", title: "College Essays", thumbnail: imgEssays, price: "$35.00", duration: "1.5 months", students: 2100 },
];

export function ParentCourses() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["tutors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("role", "tutor");
      if (error) throw error;
      return data;
    }
  });

  const catalogCourses: CatalogCourse[] = baseCourses.map((c, i) => {
    const tutor = tutors.length > 0 ? tutors[i % tutors.length] : { full_name: "Loading...", avatar_url: "" };
    return {
      ...c,
      tutor: {
        name: tutor.full_name || "Unknown Tutor",
        avatar: tutor.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(tutor.full_name || "T")}`
      }
    };
  });

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
                <span className="text-[13px] text-white/80 mr-2">Showing 1-6 of 6</span>
                <button className="p-1.5 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <button className="p-1.5 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-4 md:p-8 w-full h-full">

        {/* Catalog Grid */}
        <div className={cn(
           "grid gap-6",
           viewMode === "grid" 
             ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
             : "grid-cols-1 lg:grid-cols-2"
        )}>
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
          ) : catalogCourses.map(course => (
            <Link 
              key={course.id} 
              to={`/parent/courses/${course.id}`}
              className={cn(
                "group bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[16px] overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-primary/50 flex flex-col",
                viewMode === "list" && "sm:flex-row"
              )}
            >
              {/* Thumbnail */}
              <div className={cn(
                "relative overflow-hidden",
                viewMode === "list" ? "sm:w-[240px] shrink-0" : "w-full aspect-video"
              )}>
                <img 
                  src={course.thumbnail} 
                  alt={course.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col flex-1">
                <h3 className="text-[16px] font-bold text-[#111] dark:text-white leading-tight mb-4 group-hover:text-primary transition-colors line-clamp-2">
                  {course.title}
                </h3>
                
                <div className="flex items-center gap-4 text-[13px] text-[#54656f] dark:text-[#aebac1] mb-6 mt-auto">
                  <span><strong className="text-[#111] dark:text-[#e9edef]">{course.price}</strong></span>
                  <span className="w-1 h-1 rounded-full bg-[#e9edef] dark:bg-[#2a3942]" />
                  <span>Time: {course.duration}</span>
                  <span className="w-1 h-1 rounded-full bg-[#e9edef] dark:bg-[#2a3942]" />
                  <span>{course.students} Std.</span>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-[#e9edef] dark:bg-[#2a3942] mb-4" />

                {/* Tutor */}
                <div className="flex items-center gap-3">
                  <img 
                    src={course.tutor.avatar} 
                    alt={course.tutor.name} 
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-[#111b21]"
                  />
                  <span className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
                    {course.tutor.name}
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
