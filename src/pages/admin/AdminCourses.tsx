import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { AdminHeader } from "./AdminHeader";
import { getCourses, updateCourse, type AdminCourse } from "@/services/adminService";
import { money } from "@/services/billingService";
import { Loader2, Check, Pencil } from "lucide-react";
import { cn } from "@/utils/cn";

export function AdminCourses() {
  const qc = useQueryClient();
  const { data: courses = [], isLoading } = useQuery({ queryKey: ["admin-courses"], queryFn: getCourses });
  const [editing, setEditing] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");

  const active = courses.filter((c) => c.is_active).length;
  const priced = courses.filter((c) => c.price_cents != null).length;

  function startEdit(c: AdminCourse) {
    setEditing(c.id);
    setPriceInput(c.price_cents != null ? (c.price_cents / 100).toString() : "");
  }

  async function savePrice(c: AdminCourse) {
    const dollars = parseFloat(priceInput);
    const cents = Number.isFinite(dollars) && dollars >= 0 ? Math.round(dollars * 100) : null;
    const res = await updateCourse(c.id, { price_cents: cents });
    if (!res.success) return toast.error(res.error || "Could not save.");
    toast.success("Price updated.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  }

  async function toggleActive(c: AdminCourse) {
    const res = await updateCourse(c.id, { is_active: !c.is_active });
    if (!res.success) return toast.error(res.error || "Could not update.");
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  }

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
          <p className="text-[13px] text-muted-foreground mb-5">
            Set the parent-facing price for each course. This is independent of the tutor's pay rate - the difference
            is the platform margin. Tutors never see this price.
          </p>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : courses.length === 0 ? (
            <p className="text-center py-16 text-[14px] text-muted-foreground">No courses yet.</p>
          ) : (
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">{c.title}</p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      {c.subject}{c.tutor_name ? ` - ${c.tutor_name}` : ""}
                    </p>
                  </div>

                  {editing === c.id ? (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">$</span>
                        <input
                          autoFocus
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && savePrice(c)}
                          placeholder="0.00"
                          className="pl-6 pr-2 h-9 w-28 bg-white dark:bg-[#1a2730] border border-[#e9edef] dark:border-[#2a3942] rounded-lg text-[14px] outline-none focus:border-[#1099A1]"
                        />
                      </div>
                      <button onClick={() => savePrice(c)} className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-[#1099A1] text-white text-[12px] font-semibold hover:bg-[#0d848b]">
                        <Check size={14} /> Save
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(c)} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#111] dark:text-white hover:text-[#1099A1]">
                      {c.price_cents != null ? money(c.price_cents) : <span className="text-muted-foreground">Set price</span>}
                      <Pencil size={13} className="text-muted-foreground" />
                    </button>
                  )}

                  <button
                    onClick={() => toggleActive(c)}
                    className={cn("w-9 h-5 rounded-full relative transition-colors shrink-0", c.is_active ? "bg-[#1099A1]" : "bg-muted-foreground/30")}
                    title={c.is_active ? "Active" : "Inactive"}
                  >
                    <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all", c.is_active ? "right-0.5" : "left-0.5")} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
