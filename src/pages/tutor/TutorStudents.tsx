import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorStudents, TutorStudent } from "@/services/tutorService";
import { StudentCard } from "@/components/feature/StudentCard";

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
        <div className="flex justify-end mb-6">
          <div className="relative w-full sm:w-[320px]">
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
              <StudentCard key={s.id} student={s} onMessage={(id) => navigate(`/tutor/messages?to=${id}`)} />
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
