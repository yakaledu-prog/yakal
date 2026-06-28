import { PlayCircle, Clock, Calendar, Video } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";

export function StudentCourseSessions() {
  const sessions = [
    {
      title: "Module 1: Introduction",
      items: [
        { title: "Course Orientation", type: "video", duration: "45:00", completed: true, date: "Oct 10, 2023" },
      ]
    },
    {
      title: "Module 2: Core Concepts",
      items: [
        { title: "Understanding Variables (Recording)", type: "video", duration: "1:15:30", completed: false, active: true, date: "Oct 15, 2023" },
        { title: "Linear Equations (Recording)", type: "video", duration: "1:20:00", completed: false, date: "Oct 20, 2023" },
      ]
    },
    {
      title: "Module 3: Advanced Topics",
      items: [
        { title: "Graphing Functions (Recording)", type: "video", duration: "58:45", completed: false, date: "Oct 25, 2023" },
      ]
    }
  ];

  return (
    <div className="flex flex-col md:flex-row w-full gap-4 rounded">

      {/* Left/Main Content: Player */}
      <div className="flex-1 flex flex-col h-full border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] overflow-y-auto">
        <div className="w-full aspect-video bg-black relative flex items-center justify-center">
          <PlayCircle size={64} className="text-white opacity-80 cursor-pointer hover:opacity-100 transition-opacity hover:scale-110" />
          <div className="absolute bottom-4 left-4 text-white font-semibold">Understanding Variables (Recording)</div>
          <div className="absolute bottom-4 right-4 text-white text-[13px]">1:15:30</div>
        </div>

        <div className="p-8">
          <h1 className="text-[24px] font-bold text-[#111] dark:text-white mb-4">Understanding Variables (Recording)</h1>
          <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mb-8">Recorded on Oct 15, 2023</p>

          <h3 className="text-[16px] font-bold text-[#111] dark:text-white mb-2">About this session</h3>
          <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] leading-relaxed">
            In this recorded live session, we went over the basics of algebraic variables and solved several examples from the textbook. Students asked great questions regarding constant coefficients.
          </p>
        </div>
      </div>

      {/* Right Sidebar: Upcoming Sessions & Past Recordings */}
      <div className="w-full md:w-[380px] h-full flex flex-col bg-white dark:bg-[#202c33] shrink-0">

        {/* Upcoming Sessions */}
        <div className="p-4 border-b border-[#e9edef] dark:border-[#2a3942] bg-primary/5">
          <h2 className="text-[16px] font-bold text-[#111] dark:text-white mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-primary" /> Upcoming Sessions
          </h2>
          <div className="space-y-3">
            <div className="bg-white dark:bg-[#182329] p-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
              <p className="text-[14px] font-bold text-[#111] dark:text-white">1-on-1 Mentorship</p>
              <div className="flex items-center gap-4 mt-2 text-[12px] text-[#54656f] dark:text-[#aebac1]">
                <span className="flex items-center gap-1"><Calendar size={14} /> Friday</span>
                <span className="flex items-center gap-1"><Clock size={14} /> 4:00 PM</span>
              </div>
              <Button className="w-full mt-3 h-8 text-[12px] font-bold">Join Meeting</Button>
            </div>
            <div className="bg-white dark:bg-[#182329] p-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
              <p className="text-[14px] font-bold text-[#111] dark:text-white">Group Review: Module 3</p>
              <div className="flex items-center gap-4 mt-2 text-[12px] text-[#54656f] dark:text-[#aebac1]">
                <span className="flex items-center gap-1"><Calendar size={14} /> Next Monday</span>
                <span className="flex items-center gap-1"><Clock size={14} /> 6:00 PM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33]">
          <h2 className="text-[16px] font-bold text-[#111] dark:text-white flex items-center gap-2">
            <Video size={18} /> Past Recordings
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.map((module, i) => (
            <div key={i} className="border-b border-[#e9edef] dark:border-[#2a3942]">
              <div className="p-4 bg-[#f8f9fa] dark:bg-[#182329] sticky top-0 z-10 border-b border-[#e9edef] dark:border-[#2a3942]">
                <h3 className="text-[14px] font-bold text-[#111] dark:text-white">{module.title}</h3>
              </div>
              <div>
                {module.items.map((item, j) => (
                  <button
                    key={j}
                    className={cn(
                      "w-full p-4 flex items-start gap-3 text-left hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] transition-colors",
                      item.active && "bg-primary/5 dark:bg-primary/10 border-l-4 border-primary"
                    )}
                  >
                    <div className="pt-0.5 shrink-0">
                      <PlayCircle size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-[14px] truncate",
                        item.active ? "font-bold text-[#111] dark:text-white" : "text-[#54656f] dark:text-[#aebac1]"
                      )}>
                        {item.title}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[12px] text-[#54656f] dark:text-[#aebac1]">{item.duration}</p>
                        <p className="text-[11px] text-[#54656f] dark:text-[#aebac1]">{item.date}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
