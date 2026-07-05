import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Search, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorCourses } from "@/services/tutorService";

interface Course {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
}

export function TutorCourses() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    getTutorCourses(user.id).then((c) => {
      setCourses(c as Course[]);
      setLoading(false);
    });
  }, [user]);

  const filtered = courses.filter(
    (c) => c.title.toLowerCase().includes(query.toLowerCase()) || c.subject.toLowerCase().includes(query.toLowerCase())
  );

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
              placeholder="Search courses..."
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
            <BookOpen size={48} className="mx-auto text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No courses yet</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">The admin hasn't assigned any courses to you.</p>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((course) => (
              <div key={course.id} className="group bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[16px] overflow-hidden hover:shadow-lg transition-all flex flex-col">
                <div className="relative w-full aspect-video overflow-hidden bg-[#f0f2f5] dark:bg-[#182329]">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><BookOpen size={40} className="text-[#aebac1]" /></div>
                  )}
                  <span className="absolute top-3 left-3 bg-primary/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">{course.subject}</span>
                  {!course.is_active && <span className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">Inactive</span>}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="text-[16px] font-bold text-[#111] dark:text-white leading-tight mb-2 line-clamp-2">{course.title}</h3>
                  {course.description && <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] line-clamp-3">{course.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
