import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Search, Users, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorStudents, TutorStudent } from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function TutorStudents() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<TutorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    getTutorStudents(user.id).then((s) => {
      setStudents(s);
      setLoading(false);
    });
  }, [user]);

  const filtered = students.filter((s) => s.full_name.toLowerCase().includes(query.toLowerCase()));

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 md:p-8 h-full dark:bg-[#111b21]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111] dark:text-white">My Students</h1>
            <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mt-1">Students who have booked sessions with you.</p>
          </div>
          <div className="relative w-full sm:w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
            </div>
            <input
              type="text"
              placeholder="Search students..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-3 py-2 h-10 bg-white dark:bg-[#182329] text-[#111] dark:text-white border border-[#e9edef] dark:border-[#2a3942] rounded-lg focus:outline-none focus:border-primary w-full text-[14px]"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl">
            <Users size={48} className="mx-auto text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No students yet</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Students will appear here once they book a session with you.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-4 mb-4">
                  <img src={s.avatar_url || dicebearUrl(s.full_name)} alt={s.full_name} className="w-14 h-14 rounded-full object-cover" />
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-bold text-[#111] dark:text-white truncate">{s.full_name}</h3>
                    {s.email && <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] truncate">{s.email}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#f8f9fa] dark:bg-[#182329] rounded-lg p-3">
                    <p className="text-[20px] font-bold text-[#111] dark:text-white leading-none">{s.sessionCount}</p>
                    <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mt-1">Sessions ({s.completedCount} done)</p>
                  </div>
                  <div className="bg-[#f8f9fa] dark:bg-[#182329] rounded-lg p-3">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white leading-tight">{formatDate(s.lastDate)}</p>
                    <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mt-1">Last session</p>
                  </div>
                </div>
                {s.subjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {s.subjects.map((sub) => (
                      <span key={sub} className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">{sub}</span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => navigate("/tutor/messages")}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[14px] font-semibold text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors"
                >
                  <MessageSquare size={15} /> Message
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
