import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getCourses, updateCourse, createCourse, type AdminCourse } from "@/services/adminService";
import { money } from "@/services/billingService";
import { Loader2, Plus, Pencil, ExternalLink, Star, Search, LayoutGrid, List } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";
import { AdminCourseModal } from "./courses/AdminCourseModal";

export function AdminCourses() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: courses = [], isLoading } = useQuery({ queryKey: ["admin-courses"], queryFn: getCourses });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const active = courses.filter((c) => c.is_active).length;
  const priced = courses.filter((c) => c.price_cents != null).length;

  async function toggleActive(c: AdminCourse) {
    const res = await updateCourse(c.id, { is_active: !c.is_active });
    if (!res.success) return toast.error(res.error || "Could not update.");
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  }

  const handleModalSubmit = async (patch: Partial<AdminCourse>) => {
    setIsSubmitting(true);
    try {
      let res;
      if (editingCourse) {
        res = await updateCourse(editingCourse.id, patch);
      } else {
        res = await createCourse(patch);
      }

      if (!res.success) {
        toast.error(res.error || `Failed to ${editingCourse ? "update" : "create"} course`);
        return;
      }
      toast.success(`Course ${editingCourse ? "updated" : "created"} successfully!`);
      qc.invalidateQueries({ queryKey: ["admin-courses"] });
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCreateModal = () => {
    setEditingCourse(null);
    setIsModalOpen(true);
  };

  const openEditModal = (c: AdminCourse) => {
    setEditingCourse(c);
    setIsModalOpen(true);
  };

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <AdminHeader
          title="Courses"
          subtitle="Set parent-facing prices and availability"
          stats={[
            { label: "Courses", value: courses.length },
            { label: "Active", value: active },
            { label: "Priced", value: priced },
          ]}
        />

        <div className="max-w-[1440px] mx-auto p-6 md:p-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="relative w-full sm:w-[480px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-[#182329]/50 border border-[#e9edef] dark:border-[#2a3942] rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-[#182329] transition-all placeholder:text-muted-foreground/60"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex bg-gray-100 dark:bg-[#182329] p-1 rounded-lg border border-[#e9edef] dark:border-[#2a3942]">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-white dark:bg-[#202c33] shadow-sm" : "text-muted-foreground hover:text-[#111] dark:hover:text-white")}
                >
                  <List size={18} />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-white dark:bg-[#202c33] shadow-sm" : "text-muted-foreground hover:text-[#111] dark:hover:text-white")}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>

              <Button onClick={openCreateModal} className="gap-2 shrink-0">
                <Plus size={16} /> Create Course
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
          ) : filteredCourses.length === 0 ? (
            <p className="text-center py-16 text-[14px] text-muted-foreground">No courses found matching "{searchTerm}".</p>
          ) : (
            <div className={cn(viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-6")}>
              {filteredCourses.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/admin/courses/${c.id}`)}
                  className={cn("bg-white dark:bg-[#111b21] cursor-pointer rounded-xl border border-[#e9edef] dark:border-[#2a3942] flex overflow-hidden w-full transition-all ring-2 ring-primary/0 hover:ring-primary/30 hover:border-primary/30", viewMode === "grid" ? "flex-col" : "flex-col md:flex-row")}
                >
                  {/* Thumbnail */}
                  <div className={cn("bg-gray-100 dark:bg-[#202c33] shrink-0 relative", viewMode === "grid" ? "w-full h-[220px]" : "w-full md:w-[28%] lg:w-[25%] h-[200px] md:h-auto")}>
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.title} className={cn("w-full h-full object-cover", viewMode === "grid" ? "" : "md:absolute inset-0")} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <span className="text-sm font-medium">No Thumbnail</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-6 md:p-8 flex flex-col justify-between">
                    <div>
                      {/* Top Row: Title and Price */}
                      <div className={cn("flex justify-between items-start gap-4 mb-2", viewMode === "grid" ? "flex-col" : "flex-row")}>
                        <h3 className={cn("text-xl md:text-2xl font-bold tracking-tight text-[#111] dark:text-white leading-tight truncate w-full flex items-center", viewMode === "grid" ? "justify-between" : "gap-3")}>
                          <span>{c.title}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActive(c);
                            }}
                            className={cn("w-10 h-5 rounded-full relative transition-colors", c.is_active ? "bg-primary" : "bg-gray-300 dark:bg-gray-700")}
                            title={c.is_active ? "Deactivate course" : "Activate course"}
                          >
                            <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm", c.is_active ? "left-[22px]" : "left-0.5")} />
                          </button>
                        </h3>
                        {/* Pricing as Text */}
                        <div className={cn("flex", viewMode === "grid" ? "w-full flex-row items-end justify-between" : "flex-col gap-1 text-right")}>
                          <div className="text-[18px] md:text-xl font-bold text-[#111] dark:text-white flex items-center gap-1">
                            {c.price_cents != null ? money(c.price_cents) : "—"} <span className="text-[13px] font-normal text-muted-foreground tracking-normal">parent</span>
                          </div>
                          {c.tutor_payout_cents != null && <div className="text-[13px] font-medium text-primary">
                            {money(c.tutor_payout_cents)} <span className="text-muted-foreground">tutor</span>
                          </div>}
                        </div>
                      </div>

                      {/* Mocked Rating & Students & Classroom */}
                      <div className={cn("flex items-center gap-2.5 text-[14px] text-muted-foreground font-medium flex-wrap", viewMode === "grid" ? "mt-4" : "")}>
                        <div className="flex items-center gap-1 text-[#111] dark:text-white">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span>4.8</span>
                          <span className="text-muted-foreground font-normal">(320)</span>
                        </div>
                        <span className="text-[#e9edef] dark:text-[#2a3942]">•</span>
                        <span>1,204 Students</span>
                        {c.google_classroom_url && (
                          <>
                            <span className="text-[#e9edef] dark:text-[#2a3942]">•</span>
                            <a
                              href={c.google_classroom_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[13px] text-primary hover:underline flex items-center gap-1 font-medium"
                            >
                              <ExternalLink size={13} /> Classroom
                            </a>
                          </>
                        )}
                      </div>

                      {/* Course Description */}
                      {c.description && (
                        <div
                          className="mt-3 text-[13px] text-muted-foreground line-clamp-2 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: c.description }}
                        />
                      )}
                    </div>

                    <div className="my-4 border-t border-[#e9edef] dark:border-[#2a3942]" />

                    {/* Bottom Row: Tutors and Admin Actions */}
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {/* Mocking Tutor Avatars */}
                          {[1, 2, 3].map(i => (
                            <img key={i} src={`https://api.dicebear.com/7.x/notionists/svg?seed=tutor${i}`} alt="tutor" className="w-8 h-8 rounded-full border-2 border-white dark:border-[#111b21] bg-gray-100" />
                          ))}
                        </div>
                        <span className="text-[14px] text-primary font-medium">
                          + 9 available tutors
                        </span>
                      </div>

                      {/* Admin Actions */}
                      <div className="flex items-center gap-5 ml-auto">
                        <Button
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(c);
                          }}
                          className="h-9 px-4 text-[13px] gap-2 rounded-lg font-medium border-gray-300 dark:border-gray-700 hover:bg-gray-50"
                        >
                          <Pencil size={14} /> Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminCourseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingCourse}
        onSubmit={handleModalSubmit}
        isSubmitting={isSubmitting}
      />
    </PageWrapper>
  );
}
