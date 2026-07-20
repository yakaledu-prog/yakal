import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { CollegeProfilePanel } from "@/components/college/CollegeProfilePanel";
import { getApplication } from "@/services/collegeService";
import { supabase } from "@/lib/supabase";
import { GraduationCap, MessagesSquare } from "lucide-react";

export function StudentCollege() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Resolve the assigned counselor (if any) for the "Message counselor" button.
  const { data: counselor } = useQuery({
    queryKey: ["assigned-counselor", user?.id],
    queryFn: async () => {
      const app = await getApplication(user!.id);
      if (!app?.counselor_id) return null;
      const { data } = await supabase.from("profiles").select("id, full_name").eq("id", app.counselor_id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  if (!user) return null;

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21]">
        <div className="bg-[#1099A1] text-white p-6 md:p-10">
          <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><GraduationCap size={28} /> College</h1>
              <p className="text-white/80 text-[15px] mt-1">Track your applications, essays, and deadlines.</p>
            </div>
            {counselor && (
              <button
                onClick={() => navigate("/student/messages", { state: { openWith: counselor.id } })}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#1099A1] rounded-full text-[14px] font-semibold hover:bg-white/90 self-start"
              >
                <MessagesSquare size={16} /> Message {counselor.full_name?.split(" ")[0]}
              </button>
            )}
          </div>
        </div>

        <div className="max-w-[1100px] mx-auto p-6 md:p-10">
          <CollegeProfilePanel studentId={user.id} />
        </div>
      </div>
    </PageWrapper>
  );
}
