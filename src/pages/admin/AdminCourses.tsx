import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getCourses, updateCourse, createCourse, type AdminCourse } from "@/services/adminService";
import { money } from "@/services/billingService";
import { Loader2, Plus, Pencil, ExternalLink } from "lucide-react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";
import { AdminCourseModal } from "./courses/AdminCourseModal";

export function AdminCourses() {
  const qc = useQueryClient();
  const { data: courses = [], isLoading } = useQuery({ queryKey: ["admin-courses"], queryFn: getCourses });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AdminCourse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <div className="flex justify-between items-center mb-5">
            <p className="text-[13px] text-muted-foreground max-w-2xl">
              Manage courses, their pricing, tutor assignments, and Google Classroom links.
            </p>
            <Button onClick={openCreateModal} className="gap-2">
              <Plus size={16} /> Create Course
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : courses.length === 0 ? (
            <p className="text-center py-16 text-[14px] text-muted-foreground">No courses yet.</p>
          ) : (
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {courses.map((c) => (
                <div key={c.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-[#182329] transition-colors">
                  <div className="w-16 h-12 bg-gray-200 dark:bg-[#202c33] rounded overflow-hidden shrink-0">
                    {c.thumbnail_url ? (
                      <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">No Img</div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">{c.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[12px] text-muted-foreground truncate">
                        {c.subject}{c.tutors && c.tutors.length > 0 ? ` • ${c.tutors.map(t => t.full_name).join(", ")}` : ""}
                      </p>
                      {c.google_classroom_url && (
                        <a href={c.google_classroom_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#1099A1] hover:underline inline-flex items-center gap-1">
                          <ExternalLink size={10} /> Classroom
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Parent</p>
                      <p className="text-[14px] font-medium text-[#111] dark:text-white">
                        {c.price_cents != null ? money(c.price_cents) : "—"}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Tutor</p>
                      <p className="text-[14px] font-medium text-[#111] dark:text-white">
                        {c.tutor_payout_cents != null ? money(c.tutor_payout_cents) : "—"}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleActive(c)}
                      className={cn("w-10 h-5 rounded-full relative transition-colors", c.is_active ? "bg-[#1099A1]" : "bg-gray-300 dark:bg-gray-700")}
                    >
                      <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm", c.is_active ? "left-[22px]" : "left-0.5")} />
                    </button>

                    <Button variant="ghost" onClick={() => openEditModal(c)} className="h-8 px-3 text-[13px] gap-2">
                      <Pencil size={14} /> Edit
                    </Button>
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
