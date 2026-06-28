import { useState } from "react";
import { Search, LayoutGrid, List, FileText, Video, Link as LinkIcon, Download, ExternalLink } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";

export function StudentCourseResources() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [activeFilter, setActiveFilter] = useState("all");

  const resources = [
    { id: 1, title: "Algebra Chapter 1 Textbook", type: "pdf", size: "2.4 MB", module: "Module 1", date: "Oct 10, 2023" },
    { id: 2, title: "Variables Practice Worksheet", type: "pdf", size: "1.1 MB", module: "Module 2", date: "Oct 15, 2023" },
    { id: 3, title: "Interactive Graphing Calculator", type: "link", url: "https://desmos.com", module: "Module 3", date: "Oct 22, 2023" },
    { id: 4, title: "Supplemental Video: Linear Equations", type: "video", duration: "14:20", module: "Module 2", date: "Oct 18, 2023" },
    { id: 5, title: "Functions Cheat Sheet", type: "pdf", size: "0.5 MB", module: "Module 3", date: "Oct 25, 2023" },
    { id: 6, title: "Khan Academy: Polynomials", type: "link", url: "https://khanacademy.org", module: "Module 4", date: "Oct 28, 2023" },
  ];

  const filteredResources = activeFilter === "all" ? resources : resources.filter(r => r.type === activeFilter);

  const filters = [
    { id: "all", label: "All Resources" },
    { id: "pdf", label: "PDF Documents" },
    { id: "video", label: "Videos" },
    { id: "link", label: "External Links" },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-8">
      
      {/* Left Sidebar: Filters */}
      <div className="w-full md:w-64 shrink-0 space-y-6">
        <div>
          <h2 className="text-[16px] font-bold text-[#111] dark:text-white mb-4">Filters</h2>
          <div className="space-y-1">
            {filters.map(filter => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-[14px] font-medium transition-colors",
                  activeFilter === filter.id
                    ? "bg-primary text-primary-foreground"
                    : "text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#182329]"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Resources List */}
      <div className="flex-1 space-y-6">
        
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-[#aebac1]" size={18} />
            <input 
              type="text" 
              placeholder="Search resources..." 
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33] text-[14px] focus:outline-none focus:border-primary dark:text-white"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-1 shrink-0">
            <button 
              onClick={() => setViewMode("list")}
              className={cn("p-2 rounded-lg transition-colors", viewMode === "list" ? "bg-[#f8f9fa] dark:bg-[#111b21] text-[#111] dark:text-white" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
            >
              <List size={18} />
            </button>
            <button 
              onClick={() => setViewMode("grid")}
              className={cn("p-2 rounded-lg transition-colors", viewMode === "grid" ? "bg-[#f8f9fa] dark:bg-[#111b21] text-[#111] dark:text-white" : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>

        {/* Resources Grid/List */}
        <div className={cn(
          "gap-4",
          viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col"
        )}>
          {filteredResources.map((resource) => (
            <div 
              key={resource.id} 
              className={cn(
                "bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden hover:border-primary/50 transition-colors group flex",
                viewMode === "grid" ? "flex-col" : "flex-row items-center p-4"
              )}
            >
              <div className={cn(
                "flex items-center justify-center shrink-0 bg-[#f8f9fa] dark:bg-[#182329]",
                viewMode === "grid" ? "h-32 w-full border-b border-[#e9edef] dark:border-[#2a3942]" : "h-12 w-12 rounded-lg mr-4"
              )}>
                {resource.type === 'pdf' ? (
                  <FileText size={viewMode === "grid" ? 48 : 24} className="text-[#54656f] dark:text-[#aebac1]" />
                ) : resource.type === 'video' ? (
                  <Video size={viewMode === "grid" ? 48 : 24} className="text-[#54656f] dark:text-[#aebac1]" />
                ) : (
                  <LinkIcon size={viewMode === "grid" ? 48 : 24} className="text-[#54656f] dark:text-[#aebac1]" />
                )}
              </div>
              
              <div className={cn(
                "flex-1 min-w-0",
                viewMode === "grid" ? "p-4" : ""
              )}>
                <h3 className="text-[15px] font-bold text-[#111] dark:text-white truncate">{resource.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-[13px] text-[#54656f] dark:text-[#aebac1]">
                  <span>{resource.module}</span>
                  <span>•</span>
                  <span>{resource.type === 'pdf' ? resource.size : resource.type === 'video' ? resource.duration : 'External'}</span>
                </div>
              </div>
              
              <div className={cn(
                "shrink-0",
                viewMode === "grid" ? "px-4 pb-4" : "ml-4"
              )}>
                <Button variant="outline" className="w-full h-8 text-[12px] border-[#e9edef] dark:border-[#2a3942]">
                  {resource.type === 'link' ? (
                    <><ExternalLink size={14} className="mr-2" /> Open</>
                  ) : resource.type === 'video' ? (
                    <><Video size={14} className="mr-2" /> Watch</>
                  ) : (
                    <><Download size={14} className="mr-2" /> Download</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
