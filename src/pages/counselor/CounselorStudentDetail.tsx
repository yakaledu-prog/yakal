import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getStudentProfile } from "@/services/counselorService";
import { CollegeProfilePanel } from "@/components/college/CollegeProfilePanel";
import { ArrowLeft, MessagesSquare, Loader2 } from "lucide-react";
import { dicebearUrl } from "@/utils/avatar";

export function CounselorStudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: student, isLoading } = useQuery({
    queryKey: ["student-profile", id],
    queryFn: () => getStudentProfile(id!),
    enabled: !!id,
  });

  if (!id) return null;

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        {/* Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-8">
          <div className="max-w-[1100px] mx-auto">
            <button onClick={() => navigate("/counselor/students")} className="flex items-center gap-1.5 text-white/80 hover:text-white text-[13px] font-semibold mb-4">
              <ArrowLeft size={16} /> Back to students
            </button>
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <div className="flex items-center gap-4">
                <img src={student?.avatar_url || dicebearUrl(student?.full_name || "S")} alt="" className="w-16 h-16 rounded-full object-cover ring-4 ring-white/20" />
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight truncate">{student?.full_name}</h1>
                  <p className="text-white/80 text-[14px]">{student?.grade_level || "Student"}{student?.email ? ` · ${student.email}` : ""}</p>
                </div>
                <button
                  onClick={() => navigate("/counselor/messages", { state: { openWith: id } })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-[#1099A1] rounded-full text-[13px] font-semibold hover:bg-white/90"
                >
                  <MessagesSquare size={15} /> Message
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto p-6 md:p-8">
          <CollegeProfilePanel studentId={id} canEditNotes />
        </div>
      </div>
    </PageWrapper>
  );
}
