import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { getCounselorDashboard } from "@/services/counselorService";
import { Users, FileClock, CalendarDays, Loader2, ChevronRight } from "lucide-react";
import { dicebearUrl } from "@/utils/avatar";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CounselorHome() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["counselor-dashboard", user?.id],
    queryFn: () => getCounselorDashboard(user!.id),
    enabled: !!user?.id,
  });

  const firstName = profile?.full_name?.split(" ")[0] || "Counselor";

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Header */}
        <div className="bg-[#1099A1] text-white">
          <div className="max-w-[1440px] mx-auto p-6 md:p-10 space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Welcome back, {firstName}!</h1>
              <p className="text-white/80 text-[15px] mt-1">Guide your students through their college journey.</p>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-lg">
              <HeaderStat icon={<Users size={18} />} label="Students" value={data?.totalStudents ?? "-"} />
              <HeaderStat icon={<FileClock size={18} />} label="Essays in review" value={data?.essaysInReview ?? "-"} />
              <HeaderStat icon={<CalendarDays size={18} />} label="Deadlines" value={data?.upcomingDeadlines.length ?? "-"} />
            </div>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto p-6 md:p-10 grid lg:grid-cols-3 gap-6">
          {/* Roster */}
          <div className="lg:col-span-2">
            <h2 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Your students</h2>
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#1099A1]" /></div>
            ) : (data?.students.length ?? 0) === 0 ? (
              <p className="text-[14px] text-[#667781] dark:text-[#8696a0] py-8">No students assigned yet.</p>
            ) : (
              <div className="space-y-2.5">
                {data!.students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/counselor/students/${s.id}`)}
                    className="w-full flex items-center gap-3 p-4 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl hover:shadow-sm transition text-left"
                  >
                    <img src={s.avatar_url || dicebearUrl(s.full_name)} alt={s.full_name} className="w-11 h-11 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate">{s.full_name}</p>
                      <p className="text-[12px] text-[#667781] dark:text-[#8696a0] truncate">
                        {s.program_interest || "Undecided"} · {s.stage || "research"}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-[#8696a0] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Deadlines */}
          <div>
            <h2 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Upcoming deadlines</h2>
            <div className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {(data?.upcomingDeadlines.length ?? 0) === 0 ? (
                <p className="p-5 text-[13px] text-[#667781] dark:text-[#8696a0]">No deadlines on file.</p>
              ) : (
                data!.upcomingDeadlines.map((d, i) => (
                  <div key={i} className="p-4 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">{d.school}</p>
                      <p className="text-[12px] text-[#667781] dark:text-[#8696a0] truncate">{d.student}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-[#1099A1] shrink-0">{fmtDate(d.deadline)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function HeaderStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-white/10 rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-white/80 text-[11px] font-medium uppercase tracking-wider mb-1">{icon}</div>
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-[12px] text-white/70 mt-1">{label}</p>
    </div>
  );
}
