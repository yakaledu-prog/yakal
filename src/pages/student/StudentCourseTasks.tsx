import React from "react";
import { CheckCheck } from "lucide-react";
import { cn } from "@/utils/cn";

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
  return (
    <div className="space-y-8">
      {mockTasks.map((task) => (
        <div 
          key={task.id} 
          className={cn(
            "bg-white dark:bg-[#111b21] border rounded-md overflow-hidden transition-all",
            task.status === 'Completed' 
              ? "border-[#1099A1] ring-1 ring-[#1099A1]/20" 
              : "border-[#e9edef] dark:border-[#2a3942]"
          )}
        >
          <div className={cn(
            "border-b px-5 py-3 flex items-center justify-between",
            task.status === 'Completed'
              ? "bg-[#1099A1]/5 border-[#1099A1]/20"
              : "bg-[#f8f9fa] dark:bg-[#182329] border-[#e9edef] dark:border-[#2a3942]"
          )}>
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-semibold text-[#111] dark:text-white">
                {task.index}. {task.title}
              </h2>
            </div>
            {task.status === 'Completed' ? (
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1099A1]">
                <CheckCheck size={16} /> Completed
              </span>
            ) : (
              <button className="flex items-center gap-1.5 text-[13px] font-medium text-[#1099A1] hover:text-[#0d848b] transition-colors">
                <CheckCheck size={16} /> Mark As Done
              </button>
            )}
          </div>

          {/* Task Body */}
          <div className="p-5 flex flex-col gap-6">
            <div className="text-[#111] dark:text-[#e9edef]">
              {task.description}
              
              {/* Materials */}
              <div className="mt-5">
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#54656f] dark:text-[#aebac1] mb-2">Materials</h4>
                <div className="space-y-2">
                  {task.materials.map((mat, i) => (
                    <a
                      key={i}
                      href={mat.link}
                      className="flex items-center text-[14px] text-[#1099A1] hover:underline font-medium"
                    >
                      <svg className="w-4 h-4 mr-2 text-[#54656f] dark:text-[#aebac1]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                      {mat.title}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
