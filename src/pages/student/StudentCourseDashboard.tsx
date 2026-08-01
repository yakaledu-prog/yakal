
import { useParams, Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { CheckSquare, History, Search, MessagesSquareIcon, Loader2, ChevronLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getStudentCourses } from "@/services/studentService";

// The sidebar listed four invented courses while the page it was reached from
// listed the real ones, so the two disagreed with each other. It reads the
// student's enrolments now, and My Learning opens straight into it rather than
// through a catalog page that showed the same list again.

export function StudentCourseDashboard() {
  // One column at a time on a phone, both on a desktop.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();
  const { courseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: enrolled = [], isLoading } = useQuery({
    queryKey: ["student-courses", user?.id],
    queryFn: () => getStudentCourses(user!.id),
    enabled: !!user?.id,
  });

  const enrolledCourses = useMemo(
    () =>
      enrolled.map((c: any) => ({
        id: c.id,
        title: c.title,
        subject: c.subject,
        progress: c.progress ?? 0,
        totalTasks: c.total ?? 0,
        completedTasks: c.completed ?? 0,
      })),
    [enrolled]
  );

  // Land on the first course, so /student/my-learning is the workspace rather
  // than a list that has to be clicked through.
  useEffect(() => {
    if (!courseId && enrolledCourses.length > 0) {
      navigate(`/student/my-learning/${enrolledCourses[0].id}/tasks`, { replace: true });
    }
  }, [courseId, enrolledCourses, navigate]);

  const tabs = [
    { id: "tasks", label: "Assignments", icon: <CheckSquare size={16} /> },
    { id: "sessions", label: "Sessions", icon: <History size={16} /> },
    { id: "messages", label: "Messages", icon: <MessagesSquareIcon size={16} /> },
  ];


  const [filterText, setFilterText] = useState("");

  // The list is fetched now rather than a module constant, so the memo has to
  // depend on it. Without that it kept the empty array from the first render
  // and the sidebar stayed blank once the courses arrived.
  const filteredCourses = useMemo(
    () => enrolledCourses.filter((c) => c.title.toLowerCase().includes(filterText.toLowerCase())),
    [enrolledCourses, filterText]
  );

  const activeCourse = enrolledCourses.find(c => c.id === courseId) || enrolledCourses[0];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-[#1099A1]" />
      </div>
    );
  }

  if (enrolledCourses.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[15px] font-medium text-foreground">No courses yet</p>
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
          A course appears here once it has been booked for you.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:flex-row min-h-0 bg-background overflow-hidden">
      
      {/* Left Pane - Sidebar */}
      <aside
        className={cn(
          "w-full md:w-[300px] md:shrink-0 flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] md:h-full z-20 relative",
          listClass
        )}
      >
        <div className="px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search enrolled courses"
              className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredCourses.map((c) => {
            const isActive = c.id === courseId;
            return (
              <Link
                key={c.id}
                to={`/student/my-learning/${c.id}/tasks`}
                onClick={openDetail}
                className={cn(
                  "w-full flex flex-col p-4 text-left border-l-2 transition-colors",
                  isActive ? "bg-[#1099A1]/5 border-l-[#1099A1]" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]"
                )}
              >
                <p className={cn("text-[14px] font-semibold truncate", isActive ? "text-[#1099A1]" : "text-[#111] dark:text-white")}>{c.title}</p>
                <p className="text-[12px] text-muted-foreground truncate mt-0.5">{c.subject} • {c.progress}% done</p>
              </Link>
            );
          })}
        </div>
      </aside>

      {/* Main Right Side Area */}
      <div
        className={cn(
          "flex-1 min-w-0 min-h-0 h-full flex-col",
          detailClass
        )}
      >
        {/* Massive Teal Header */}
        <div className="bg-[#1099A1] text-white pt-6 px-6 md:pt-8 md:px-8 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div className="flex flex-1 items-start gap-3 min-w-0">
              {/* Only the phone needs this: on desktop the list is still
                  beside the course. */}
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Back"
                className="-ml-2 shrink-0 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{activeCourse.title}</h1>
              <p className="text-white/80 text-[14px] pt-1">
                {activeCourse.subject}
              </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 xl:gap-10 border-t border-white/20 xl:border-t-0 pt-4 xl:pt-0 shrink-0">
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">Progress</span>
                <span className="text-xl font-bold">{activeCourse.progress}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold text-white/70 uppercase tracking-wider">Completed</span>
                <span className="text-xl font-bold">{activeCourse.completedTasks}/{activeCourse.totalTasks}</span>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 flex items-center gap-6 mt-8 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = location.pathname.includes(`/${tab.id}`);
              return (
                <Link
                  key={tab.id}
                  to={`/student/my-learning/${courseId}/${tab.id}`}
                  className={cn(
                    "pb-3 text-[14px] font-normal flex items-center gap-2 border-b-[3px] transition-colors whitespace-nowrap",
                    isActive 
                      ? "border-white text-white" 
                      : "border-transparent text-white/70 hover:text-white"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Pane - Content */}
        <section className="flex-1 min-w-0 md:h-full md:overflow-y-auto flex flex-col bg-background dark:bg-[#111b21]">
          <div className={cn(
            "w-full flex-1 flex flex-col min-h-0 max-w-[1440px] mx-auto",
            !location.pathname.includes('/messages') && "p-4 md:p-8"
          )}>
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}
