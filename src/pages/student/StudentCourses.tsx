import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Search, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";

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

const catalogCourses: CatalogCourse[] = [
  {
    id: "CAT-01",
    title: "Algebra Fundamentals",
    thumbnail: "https://picsum.photos/seed/algebra/400/225",
    price: "$49.99",
    duration: "3 months",
    students: 1204,
    tutor: { name: "Abebe Kebede", avatar: "https://i.pravatar.cc/150?u=abebe" }
  },
  {
    id: "CAT-02",
    title: "Geometry Mastery",
    thumbnail: "https://picsum.photos/seed/geometry/400/225",
    price: "$89.00",
    duration: "6 months",
    students: 850,
    tutor: { name: "Dawit Hailu", avatar: "https://i.pravatar.cc/150?u=dawit" }
  },
  {
    id: "CAT-03",
    title: "Pre-Calculus Intensive",
    thumbnail: "https://picsum.photos/seed/precalc/400/225",
    price: "$29.50",
    duration: "2 months",
    students: 3400,
    tutor: { name: "Selamawit Tesfaye", avatar: "https://i.pravatar.cc/150?u=selamawit" }
  },
  {
    id: "CAT-04",
    title: "Calculus Deep Dive",
    thumbnail: "https://picsum.photos/seed/calculus/400/225",
    price: "$55.00",
    duration: "4 months",
    students: 5600,
    tutor: { name: "Tewodros Assefa", avatar: "https://i.pravatar.cc/150?u=tewodros" }
  },
  {
    id: "CAT-05",
    title: "Physics Mechanics & Thermodynamics",
    thumbnail: "https://picsum.photos/seed/physics/400/225",
    price: "$120.00",
    duration: "2 months",
    students: 430,
    tutor: { name: "Tirunesh Dibaba", avatar: "https://i.pravatar.cc/150?u=tirunesh" }
  },
  {
    id: "CAT-06",
    title: "SAT Prep Complete Guide",
    thumbnail: "https://picsum.photos/seed/sat/400/225",
    price: "$35.00",
    duration: "1.5 months",
    students: 2100,
    tutor: { name: "Kenenisa Bekele", avatar: "https://i.pravatar.cc/150?u=kenenisa" }
  },
  {
    id: "CAT-07",
    title: "ACT Prep Intensive",
    thumbnail: "https://picsum.photos/seed/act/400/225",
    price: "$65.00",
    duration: "5 months",
    students: 760,
    tutor: { name: "Derartu Tulu", avatar: "https://i.pravatar.cc/150?u=derartu" }
  },
  {
    id: "CAT-08",
    title: "AP Courses Mastery",
    thumbnail: "https://picsum.photos/seed/ap/400/225",
    price: "$40.00",
    duration: "2 months",
    students: 1120,
    tutor: { name: "Aster Aweke", avatar: "https://i.pravatar.cc/150?u=aster" }
  },
  {
    id: "CAT-09",
    title: "Writing Stellar College Essays",
    thumbnail: "https://picsum.photos/seed/college/400/225",
    price: "$30.00",
    duration: "1 month",
    students: 890,
    tutor: { name: "Mulatu Astatke", avatar: "https://i.pravatar.cc/150?u=mulatu" }
  },
];

export function StudentCourses() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 md:p-8 h-full dark:bg-[#111b21]">
        
        {/* Header Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4 bg-white dark:bg-[#111b21] p-4 rounded-xl border border-[#e9edef] dark:border-[#2a3942] shadow-sm">
          
          <div className="flex items-center gap-4 w-full lg:w-auto">
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
            <div className="relative flex-1 lg:w-[300px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
              </div>
              <input
                type="text"
                placeholder="Search courses..."
                className="pl-9 pr-3 py-2 h-10 bg-[#f8f9fa] dark:bg-[#182329] text-[#111] dark:text-white border border-[#e9edef] dark:border-[#2a3942] rounded-lg focus:outline-none focus:border-primary w-full text-[14px]"
              />
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <span className="text-[13px] text-[#54656f] dark:text-[#aebac1] mr-2">Showing 1-9 of 24</span>
            <button className="p-2 border border-[#e9edef] dark:border-[#2a3942] rounded-lg text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button className="p-2 border border-[#e9edef] dark:border-[#2a3942] rounded-lg text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

        </div>

        {/* Catalog Grid */}
        <div className={cn(
          "grid gap-6",
          viewMode === "grid" 
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
            : "grid-cols-1 lg:grid-cols-2"
        )}>
          {catalogCourses.map(course => (
            <Link 
              key={course.id} 
              to={`/student/courses/${course.id}`}
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
    </PageWrapper>
  );
}
