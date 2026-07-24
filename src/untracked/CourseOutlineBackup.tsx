import { useState } from "react";
import { Plus, Minus, Users, FileText } from "lucide-react";

export function CourseOutlineBackup({ course }: { course: any }) {
  const [expandedModules, setExpandedModules] = useState<number[]>([0]);

  const toggleModule = (index: number) => {
    setExpandedModules(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-[14px] text-[#54656f] dark:text-[#aebac1] mb-2">
        <span>{course.syllabus.length} sections • {course.syllabus.reduce((acc: any, s: any) => acc + s.sessions, 0)} sessions</span>
        <button
          onClick={() => setExpandedModules(expandedModules.length === course.syllabus.length ? [] : course.syllabus.map((_, i) => i))}
          className="text-[#1099A1] font-bold hover:underline"
        >
          {expandedModules.length === course.syllabus.length ? "Collapse all sections" : "Expand all sections"}
        </button>
      </div>

      <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden bg-white dark:bg-[#182329]">
        {course.syllabus.map((module: any, i: number) => (
          <div key={i} className="border-b border-[#e9edef] dark:border-[#2a3942] last:border-b-0">
            <button
              onClick={() => toggleModule(i)}
              className="w-full bg-[#f8f9fa] dark:bg-[#182329] hover:bg-[#e9edef]/50 dark:hover:bg-[#202c33] p-4 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 text-left">
                {expandedModules.includes(i) ? (
                  <Minus size={16} className="text-[#111] dark:text-white shrink-0" />
                ) : (
                  <Plus size={16} className="text-[#111] dark:text-white shrink-0" />
                )}
                <h3 className="text-[16px] font-bold text-[#111] dark:text-white">{module.title}</h3>
              </div>
              <div className="text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0">
                <span>{module.sessions} sessions • {module.time}</span>
              </div>
            </button>

            {expandedModules.includes(i) && (
              <div className="p-4 bg-white dark:bg-[#111b21]">
                <ul className="space-y-4">
                  {Array.from({ length: module.sessions > 3 ? 3 : module.sessions }).map((_, idx) => (
                    <li key={idx} className="flex items-start justify-between text-[14px] group cursor-pointer hover:bg-[#f8f9fa] dark:hover:bg-[#182329] p-2 rounded -mx-2">
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                        <span className="text-[#111] dark:text-white group-hover:text-[#1099A1] transition-colors">Session {idx + 1}: Introduction</span>
                      </div>
                      <span className="text-[#54656f] dark:text-[#aebac1]">12:4{idx}</span>
                    </li>
                  ))}
                  <li className="flex items-start justify-between text-[14px] group cursor-pointer hover:bg-[#f8f9fa] dark:hover:bg-[#182329] p-2 rounded -mx-2">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                      <span className="text-[#111] dark:text-white group-hover:text-[#1099A1] transition-colors">Reading Material & Quiz</span>
                    </div>
                    <span className="text-[#54656f] dark:text-[#aebac1]">5 min</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
