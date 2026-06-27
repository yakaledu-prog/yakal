import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

interface Course {
  id: string;
  title: string;
  subject: string;
  progress: number;
  status: "In progress" | "Done" | "Pending";
  deadline: string;
}

const mockCourses: Course[] = [
  { id: "C-01", title: "Unit 3: Limits and Derivatives", subject: "AP Calculus AB", progress: 65, status: "In progress", deadline: "Oct 16, 2023" },
  { id: "C-02", title: "Module 2: Kinematics", subject: "AP Physics C", progress: 20, status: "In progress", deadline: "Oct 20, 2023" },
  { id: "C-03", title: "College Essay Drafting", subject: "College Advising", progress: 100, status: "Done", deadline: "Oct 10, 2023" },
  { id: "C-04", title: "SAT Math Practice Test 1", subject: "SAT Prep", progress: 0, status: "Pending", deadline: "Nov 01, 2023" },
];

export function StudentCourses() {
  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
            </div>
            <input
              type="text"
              placeholder="Search projects..."
              className="pl-9 pr-3 py-2 h-10 bg-white dark:bg-[#111b21] text-[#111] dark:text-white border border-[#e9edef] dark:border-[#2a3942] rounded-md focus:outline-none focus:border-primary w-full sm:w-[250px] text-[14px]"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="space-y-4">
          {mockCourses.map(course => (
            <div key={course.id} className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md overflow-hidden hover:shadow-sm transition-shadow">
              <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link to="/student/tasks" className="text-[18px] font-bold text-primary hover:underline">
                      {course.title}
                    </Link>
                    <Badge variant={course.status === 'Done' ? 'success' : course.status === 'In progress' ? 'secondary' : 'outline'} className="rounded-sm text-[11px] font-semibold px-2 py-0.5 uppercase tracking-wider">
                      {course.status}
                    </Badge>
                  </div>
                  <div className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
                    <span className="font-semibold text-[#111] dark:text-[#e9edef]">Subject:</span> {course.subject}
                  </div>
                </div>

                {/* Deadline & Progress */}
                <div className="w-full md:w-[250px] flex flex-col gap-2">
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
                        backgroundColor: course.progress === 100 ? '#38A169' : '#1099A1' // Yakal teal for in progress, green for done
                      }}
                    />
                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>
    </PageWrapper>
  );
}
