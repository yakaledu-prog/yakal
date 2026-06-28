import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Task {
  id: string;
  index: number;
  title: string;
  type: "Mandatory" | "Optional Practice";
  description: React.ReactNode;
  materials: { title: string; link: string }[];
  actionLabel: string;
  status: 'Pending' | 'In Progress' | 'Completed';
}

const mockTasks: Task[] = [
  {
    id: "T-00",
    index: 1,
    title: "Limits and Continuity Review",
    type: "Mandatory",
    description: (
      <div className="space-y-4 text-[14px]">
        <p>Review the provided worksheet on limits and continuity. Your submission must include:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Completed exercises 1 through 15.</li>
          <li>A brief explanation of how you approached the indeterminate forms.</li>
        </ul>
      </div>
    ),
    materials: [
      { title: "limits_review_worksheet.pdf", link: "#" },
      { title: "lecture_notes_ch2.pdf", link: "#" }
    ],
    actionLabel: "Submit Worksheet",
    status: "Completed"
  },
  {
    id: "T-01",
    index: 2,
    title: "Derivatives Practice Set 1",
    type: "Mandatory",
    description: (
      <div className="space-y-4 text-[14px]">
        <p>Complete the first practice set on derivatives. You must use the power rule, product rule, and quotient rule.</p>
        <p>Show all your work step-by-step for full credit.</p>
      </div>
    ),
    materials: [
      { title: "derivatives_practice.pdf", link: "#" }
    ],
    actionLabel: "Submit Practice Set",
    status: "Pending"
  },
  {
    id: "T-02",
    index: 3,
    title: "Chain Rule Word Problems",
    type: "Optional Practice",
    description: (
      <div className="space-y-4 text-[14px]">
        <p>Apply the chain rule to solve the advanced word problems provided in the appendix.</p>
        <p>This task is optional but highly recommended for those aiming to master the subject.</p>
      </div>
    ),
    materials: [
      { title: "chain_rule_advanced.pdf", link: "#" }
    ],
    actionLabel: "Mark as Complete",
    status: "Pending"
  }
];

export function StudentCourseTasks() {
  const { courseId } = useParams();
  // Mock course title lookup
  const courseTitle = courseId === "C-01" ? "Unit 3: Limits and Derivatives" : "Course Name";

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-8 pb-12 dark:bg-[#111b21]">
        {/* Tasks List */}
        <div className="space-y-8">
          {mockTasks.map((task) => (
            <div key={task.id} className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md overflow-hidden shadow-sm">

              {/* Task Header */}
              <div className="bg-[#f8f9fa] dark:bg-[#182329] border-b border-[#e9edef] dark:border-[#2a3942] px-5 py-3 flex items-center justify-between">
                <h2 className="text-[18px] font-bold text-[#111] dark:text-white">
                  {task.index}. {task.title}
                </h2>
                <Badge
                  variant="outline"
                  className={`rounded-sm text-[11px] font-bold px-2 py-0.5 border ${task.type === 'Mandatory'
                    ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400'
                    : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                    }`}
                >
                  {task.type}
                </Badge>
              </div>

              {/* Task Body */}
              <div className="p-5 flex flex-col md:flex-row gap-6">
                <div className="flex-1 text-[#111] dark:text-[#e9edef]">
                  {task.description}

                  {/* Materials */}
                  <div className="mt-5">
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#54656f] dark:text-[#aebac1] mb-2">Materials</h4>
                    <div className="space-y-2">
                      {task.materials.map((mat, i) => (
                        <a
                          key={i}
                          href={mat.link}
                          className="flex items-center text-[14px] text-primary hover:underline font-medium"
                        >
                          <svg className="w-4 h-4 mr-2 text-[#54656f] dark:text-[#aebac1]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                          {mat.title}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Task Action & Status */}
                <div className="w-full md:w-[220px] flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#e9edef] dark:border-[#2a3942] pt-4 md:pt-0 md:pl-6">
                  <div>
                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#54656f] dark:text-[#aebac1] mb-1">Status</h4>
                    <div className="flex items-center">
                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${task.status === 'Completed' ? 'bg-[#38A169]' : task.status === 'In Progress' ? 'bg-[#1099A1]' : 'bg-[#54656f] dark:bg-[#aebac1]'}`}></span>
                      <span className="text-[14px] font-semibold text-[#111] dark:text-white">{task.status}</span>
                    </div>
                  </div>

                  <div className="mt-6 md:mt-0">
                    {task.status === 'Completed' ? (
                      <Button variant="outline" className="w-full h-10 border-[#e9edef] dark:border-[#2a3942] text-[#54656f] dark:text-[#aebac1]" disabled>
                        Done
                      </Button>
                    ) : (
                      <Button className="w-full h-10 bg-primary hover:bg-primary/90 text-white font-semibold">
                        {task.actionLabel}
                      </Button>
                    )}
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
