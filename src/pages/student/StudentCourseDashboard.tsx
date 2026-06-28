import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useParams, Link, Outlet, useLocation } from "react-router-dom";
import { BookOpen, CheckSquare, History, LayoutDashboard } from "lucide-react";
import { cn } from "@/utils/cn";

export function StudentCourseDashboard() {
  const { courseId } = useParams();
  const location = useLocation();

  const tabs = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
    { id: "tasks", label: "Tasks", icon: <CheckSquare size={16} /> },
    { id: "sessions", label: "Sessions", icon: <History size={16} /> },
  ];

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 md:p-8 dark:bg-[#111b21] max-w-[1400px]">
        
        {/* Custom Tabs Navigation */}
        <div className="flex items-center gap-6 border-b border-[#e9edef] dark:border-[#2a3942] mb-8 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = location.pathname.includes(`/${tab.id}`);
            return (
              <Link
                key={tab.id}
                to={`/student/my-learning/${courseId}/${tab.id}`}
                className={cn(
                  "pb-3 text-[15px] font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap",
                  isActive 
                    ? "border-primary text-primary" 
                    : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
                )}
              >
                {tab.icon}
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </PageWrapper>
  );
}
