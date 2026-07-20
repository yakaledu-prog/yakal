import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { CollegeProfilePanel } from "@/components/college/CollegeProfilePanel";
import { getLinkedChildren } from "@/services/parentService";
import { GraduationCap, Loader2, Eye } from "lucide-react";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";

export function ParentCollege() {
  const { user } = useAuth();
  const { data: children = [], isLoading } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const [childId, setChildId] = useState<string>("");
  useEffect(() => {
    if (!childId && children.length > 0) setChildId(children[0].id);
  }, [children, childId]);

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <div className="bg-[#1099A1] text-white p-6 md:p-10">
          <div className="max-w-[1100px] mx-auto">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><GraduationCap size={28} /> College</h1>
            <p className="text-white/80 text-[15px] mt-1 flex items-center gap-1.5"><Eye size={15} /> Read-only view of your child's applications.</p>

            {children.length > 1 && (
              <div className="flex gap-2 mt-5 flex-wrap">
                {children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChildId(c.id)}
                    className={cn("flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors",
                      childId === c.id ? "bg-white text-[#1099A1]" : "bg-white/15 text-white hover:bg-white/25")}
                  >
                    <img src={c.avatar_url || dicebearUrl(c.full_name)} alt="" className="w-6 h-6 rounded-full object-cover" />
                    {c.full_name.split(" ")[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto p-6 md:p-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : children.length === 0 ? (
            <div className="text-center py-16 text-[#8696a0]">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-60" />
              <p className="text-[14px]">No linked children found.</p>
            </div>
          ) : childId ? (
            <CollegeProfilePanel studentId={childId} readOnly />
          ) : null}
        </div>
      </div>
    </PageWrapper>
  );
}
