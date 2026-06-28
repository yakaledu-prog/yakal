import React from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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
    index: 0,
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
    index: 1,
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
    index: 2,
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

export function StudentTasks() {
  return (
    <PageWrapper>
      <div className="mx-auto w-full p-8 pb-12  dark:bg-[#111b21]">
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
              <div className="p-5 text-[#333] dark:text-[#e9edef]">
                {task.description}

                {/* Materials & Resources Box */}
                <div className="mt-6 bg-[#f8f9fa] dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded p-4 text-[13px]">
                  <div className="font-bold text-[#111] dark:text-white mb-2">Materials & Resources:</div>
                  <div className="flex flex-col gap-1.5">
                    {task.materials.map((mat, i) => (
                      <a key={i} href={mat.link} className="text-[#1099A1] hover:underline flex items-center gap-1.5 w-fit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                        {mat.title}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex items-center gap-3">
                  <Button
                    className="bg-[#111] hover:bg-black/80 text-white dark:bg-[#e9edef] dark:text-[#111] dark:hover:bg-white px-6 font-semibold"
                  >
                    {task.actionLabel}
                  </Button>
                  {task.status === 'Completed' && (
                    <span className="text-green-600 dark:text-green-400 text-[13px] font-bold flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                      Done
                    </span>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>
    </PageWrapper>
  );
}
