import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Search, FileText, Video, Link as LinkIcon, Download, ExternalLink } from "lucide-react";
import { cn } from "@/utils/cn";

interface Resource {
  id: string;
  title: string;
  subject: string;
  category: string;
  type: "PDF" | "Video" | "Link";
  dateAdded: string;
  size?: string;
}

const mockResources: Resource[] = [
  { id: "R-01", title: "Calculus Formula Cheat Sheet", subject: "AP Calculus AB", category: "Math", type: "PDF", dateAdded: "Oct 10, 2023", size: "1.2 MB" },
  { id: "R-02", title: "Kinematics Equations Summary", subject: "AP Physics C", category: "Science", type: "PDF", dateAdded: "Oct 12, 2023", size: "2.4 MB" },
  { id: "R-03", title: "SAT Math Practice Test #1", subject: "SAT Prep", category: "Test Prep", type: "PDF", dateAdded: "Oct 01, 2023", size: "4.5 MB" },
  { id: "R-04", title: "How to structure the College Essay", subject: "College Advising", category: "Advising", type: "Video", dateAdded: "Sep 28, 2023" },
  { id: "R-05", title: "Desmos Graphing Calculator Demo", subject: "AP Calculus AB", category: "Math", type: "Link", dateAdded: "Sep 15, 2023" },
  { id: "R-06", title: "Physics Lab Data Template", subject: "AP Physics C", category: "Science", type: "PDF", dateAdded: "Oct 15, 2023", size: "0.5 MB" },
];

const categories = ["All", "Math", "Science", "Test Prep", "Advising"];

export function TutorResources() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [filterText, setFilterText] = useState("");

  const filteredResources = mockResources.filter(r => {
    const matchesCategory = activeCategory === "All" || r.category === activeCategory;
    const matchesSearch = r.title.toLowerCase().includes(filterText.toLowerCase()) || r.subject.toLowerCase().includes(filterText.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "PDF": return <FileText size={20} className="text-red-500" />;
      case "Video": return <Video size={20} className="text-blue-500" />;
      case "Link": return <LinkIcon size={20} className="text-primary" />;
      default: return <FileText size={20} />;
    }
  };

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 pb-12 h-full dark:bg-[#111b21]">

        {/* Header Section */}
        {/* Categories */}
        <div className="flex items-center gap-2 mb-6">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "whitespace-nowrap px-4 py-1.5 text-[13px] font-semibold rounded-full border transition-colors",
                activeCategory === cat
                  ? "bg-[#111] text-white border-[#111] dark:bg-white dark:text-[#111] dark:border-white"
                  : "bg-white dark:bg-[#111b21] text-[#54656f] dark:text-[#aebac1] border-[#e9edef] dark:border-[#2a3942] hover:border-[#111] dark:hover:border-white hover:text-[#111] dark:hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
          <div className="relative w-[60%] ml-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
            </div>
            <input
              type="text"
              placeholder="Search resources..."
              className="pl-9 pr-3 py-2 h-10 bg-white dark:bg-[#111b21] text-[#111] dark:text-white border-b-2 rounded-sm rounded-b-none border-[#e9edef] dark:border-[#2a3942] focus:outline-none focus:border-primary w-full text-[14px]"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>

        {/* Resource Grid */}
        {filteredResources.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md">
            <FileText size={48} className="mx-auto text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No resources found</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Try adjusting your search or category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map(resource => (
              <div key={resource.id} className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md p-4 flex flex-col justify-between hover:shadow-sm transition-shadow group">

                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-2.5 bg-[#f0f2f5] dark:bg-[#202c33] rounded-md">
                      {getIcon(resource.type)}
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-[#f8f9fa] dark:bg-[#182329]">
                      {resource.subject}
                    </Badge>
                  </div>

                  <h3 className="text-[15px] font-bold text-[#111] dark:text-white leading-tight mb-2 group-hover:text-primary transition-colors">
                    {resource.title}
                  </h3>

                  <div className="text-[12px] text-[#54656f] dark:text-[#aebac1] flex items-center gap-2">
                    <span>{resource.dateAdded}</span>
                    {resource.size && (
                      <>
                        <span>•</span>
                        <span>{resource.size}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#e9edef] dark:border-[#2a3942] flex items-center gap-2">
                  <Button variant="outline" className="w-full h-8 text-[12px] font-semibold flex items-center justify-center gap-1.5 border-[#e9edef] dark:border-[#2a3942]">
                    {resource.type === "PDF" ? (
                      <>
                        <Download size={14} /> Download
                      </>
                    ) : (
                      <>
                        <ExternalLink size={14} /> View {resource.type}
                      </>
                    )}
                  </Button>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  );
}
