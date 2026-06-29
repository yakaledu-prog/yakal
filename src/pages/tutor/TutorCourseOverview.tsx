import { useState } from "react";
import { PlayCircle, CheckCircle, FileText, CheckSquare, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

export function TutorCourseOverview() {
  const [expandedModules, setExpandedModules] = useState<number[]>([1]); // Default to module 1 (the active one)

  const toggleModule = (index: number) => {
    setExpandedModules(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const syllabus = [
    {
      title: "Module 1: Introduction",
      time: "2h 30m",
      status: "completed",
      items: [
        { title: "Welcome to the Course", type: "video", duration: "5:00", completed: true },
        { title: "Course Syllabus", type: "document", duration: "10 min read", completed: true },
      ]
    },
    {
      title: "Module 2: Core Concepts",
      time: "4h 15m",
      status: "active",
      items: [
        { title: "Understanding Variables", type: "video", duration: "15:30", completed: true },
        { title: "Variables Practice Worksheet", type: "task", duration: "30 mins", completed: false, active: true },
        { title: "Linear Equations", type: "video", duration: "20:00", completed: false },
      ]
    },
    {
      title: "Module 3: Advanced Topics",
      time: "6h 45m",
      status: "future",
      items: [
        { title: "Graphing Functions", type: "video", duration: "18:45", completed: false },
        { title: "Functions Assignment", type: "task", duration: "1 hour", completed: false },
      ]
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

      {/* Left Pane: Course Content */}
      <div className="space-y-4">

        <div className="space-y-4">
          {syllabus.map((module, i) => {
            const isActive = module.status === 'active';
            return (
              <div key={i} className={cn(
                "border border-[#e9edef] dark:border-[#2a3942] rounded overflow-hidden bg-white dark:bg-[#202c33] shadow-sm transition-opacity",
                module.status === 'completed' && "opacity-60 hover:opacity-100",
                isActive && "bg-[#1099A111] dark:bg-[#1099A111] border-[#1099A133]"
              )}>
                <button
                  onClick={() => toggleModule(i)}
                  className={cn(
                    "w-full p-4 md:p-5 flex items-center justify-between transition-colors",
                    isActive ? "bg-[#CAA25F11] dark:bg-[#CAA25F11]" : "hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"
                  )}
                >
                  <div className="flex items-center gap-4 text-left">
                    {expandedModules.includes(i) ? (
                      <Minus size={20} className={cn("shrink-0", isActive ? "text-primary" : "text-[#54656f] dark:text-[#aebac1]")} />
                    ) : (
                      <Plus size={20} className={cn("shrink-0", isActive ? "text-primary" : "text-[#54656f] dark:text-[#aebac1]")} />
                    )}
                    <h3 className="text-[16px] font-bold text-[#111] dark:text-white">{module.title}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] text-[#54656f] dark:text-[#aebac1] shrink-0">
                    <span>{module.time}</span>
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedModules.includes(i) && (
                  <div className={cn(
                    "border-t border-[#e9edef] dark:border-[#2a3942]",
                    isActive && "border-[#1099A133]"
                  )}>
                    {module.items.map((item, j) => (
                      <div
                        key={j}
                        className={cn(
                          "p-4 flex items-center gap-4 cursor-pointer transition-colors border-b last:border-0 border-[#e9edef] dark:border-[#2a3942]",
                          item.active ? "bg-white dark:bg-[#202c33]" : (isActive ? "" : "hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"),
                          isActive && !item.active && "hover:bg-[#1099A111]"
                        )}
                      >
                        <div className="shrink-0">
                          {item.completed ? (
                            <CheckCircle size={20} className="text-green-500" />
                          ) : item.type === "video" ? (
                            <PlayCircle size={20} className="text-[#54656f] dark:text-[#aebac1]" />
                          ) : item.type === "task" ? (
                            <CheckSquare size={20} className="text-[#54656f] dark:text-[#aebac1]" />
                          ) : (
                            <FileText size={20} className="text-[#54656f] dark:text-[#aebac1]" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "text-[15px]",
                            item.active ? "font-bold text-[#111] dark:text-white" : "font-medium text-[#54656f] dark:text-[#aebac1]"
                          )}>
                            {item.title}
                          </p>
                          <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] mt-0.5">{item.duration}</p>
                        </div>
                        <div className="shrink-0">
                          {!item.completed && (
                            <Button variant="outline" className={cn(
                              "h-8 text-[12px] bg-white",
                              item.active ? "border-[#e9edef] dark:border-[#2a3942]" : "border-[#e9edef] dark:border-[#2a3942]"
                            )}>
                              {item.type === 'task' ? 'Start Task' : 'View'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Pane: Overview Dashboard */}
      <div className="space-y-6">

        {/* Up Next Card */}
        <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-lg p-6 shadow-sm">
          <h3 className="text-[16px] font-bold text-[#111] dark:text-white mb-4">Up Next</h3>
          <div className="bg-[#1099A111] border border-[#1099A133] rounded-lg p-4">
            <p className="text-[14px] font-semibold text-primary mb-1">Variables Practice</p>
            <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mb-3">Due in 3 days</p>
            <Button className="w-full h-8 text-[12px] font-bold bg-primary hover:bg-primary/90 text-white">Continue Learning</Button>
          </div>
        </div>

        {/* Upcoming Sessions Card */}
        <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-lg p-6 shadow-sm">
          <h3 className="text-[16px] font-bold text-[#111] dark:text-white mb-4">Upcoming Sessions</h3>
          <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-lg p-4 bg-[#f8f9fa] dark:bg-[#182329]">
            <p className="text-[14px] font-semibold text-[#111] dark:text-white mb-1">1-on-1 Mentorship</p>
            <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mb-3">Scheduled for Friday, 4:00 PM</p>
            <Button variant="outline" className="w-full h-8 text-[12px] font-bold border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33]">View Details</Button>
          </div>
        </div>

      </div>

    </div>
  );
}
