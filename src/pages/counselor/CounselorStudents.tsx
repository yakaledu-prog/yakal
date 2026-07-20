import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCounselorStudents } from "@/services/counselorService";
import { Loader2, GraduationCap, ChevronRight } from "lucide-react";
import { dicebearUrl } from "@/utils/avatar";

export function CounselorStudents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["counselor-students", user?.id],
    queryFn: () => getCounselorStudents(user!.id),
    enabled: !!user?.id,
  });

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <div className="bg-[#1099A1] text-white p-6 md:p-10">
          <div className="max-w-[1440px] mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Students</h1>
            <p className="text-white/80 text-[15px] mt-1">Advisees and their college applications</p>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-6 md:p-10">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : students.length === 0 ? (
            <div className="text-center py-16 text-[#8696a0]">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-60" />
              <p className="text-[14px]">No students assigned to you yet.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/counselor/students/${s.id}`)}
                  className="flex items-center gap-3 p-5 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl hover:shadow-sm transition text-left"
                >
                  <img src={s.avatar_url || dicebearUrl(s.full_name)} alt={s.full_name} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate">{s.full_name}</p>
                    <p className="text-[12px] text-[#667781] dark:text-[#8696a0] truncate">
                      {s.program_interest || "Undecided"}
                      {s.grade_level ? ` · ${s.grade_level}` : ""}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-[#8696a0] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
