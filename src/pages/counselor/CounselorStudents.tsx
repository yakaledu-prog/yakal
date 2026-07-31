import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { Search, Users, Loader2, Mail, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getCounselorStudents, getStudentProfile } from "@/services/counselorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { dicebearUrl } from "@/utils/avatar";

// Components for tabs
import { StudentApplicationTracker } from "@/pages/student/StudentApplicationTracker";
import { StudentCollegeList } from "@/pages/student/StudentCollegeList";


export function CounselorStudents() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [query, setQuery] = useState("");

  const { data: students = [], isLoading: loading } = useQuery({
    queryKey: ['counselor-students', user?.id],
    queryFn: () => getCounselorStudents(user!.id),
    enabled: !!user?.id,
  });

  const activeId = id ?? students[0]?.id;

  const { data: profile, isLoading: detailLoading } = useQuery({
    queryKey: ['counselor-student-detail', user?.id, activeId],
    queryFn: () => getStudentProfile(activeId),
    enabled: !!user?.id && !!activeId,
  });

  useSetBreadcrumb(activeId, profile?.full_name);

  useEffect(() => {
    if (!id && students.length > 0) navigate(`/counselor/students/${students[0].id}`, { replace: true });
  }, [id, students, navigate]);

  const filtered = useMemo(
    () => students.filter((s) => s.full_name.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  );

  return (
    <div className="students-page flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Left pane */}
      <aside className="students-list w-full md:w-[300px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full">
        
        <div className="students-list__search px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search advisees..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-[15px] placeholder:text-[#697780] text-[#111] dark:text-white"
            />
          </div>
        </div>

        <div className="students-list__content flex-1 overflow-y-auto bg-white dark:bg-[#111b21]">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#1099A1]" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="mx-auto mb-3 opacity-30" size={32} />
              <p className="text-[14px] text-muted-foreground font-medium">No students found.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#e9edef] dark:divide-[#2a3942]">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/counselor/students/${s.id}`)}
                  className={cn(
                    "w-full text-left p-4 flex items-start gap-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors",
                    activeId === s.id && "bg-[#f0f2f5] dark:bg-[#2a3942]"
                  )}
                >
                  <img
                    src={s.avatar_url || dicebearUrl(s.full_name)}
                    alt={s.full_name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 border border-black/5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate pr-2">{s.full_name}</p>
                    </div>
                    <p className="text-[13px] text-[#667781] dark:text-[#8696a0] truncate">
                      {s.program_interest || "Undecided"}
                      {s.grade_level ? ` · ${s.grade_level}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Right pane */}
      <main className="students-detail flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a]">
        {activeId ? (
          detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#1099A1] w-8 h-8" />
            </div>
          ) : profile ? (
            <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-4 md:pt-8 custom-scrollbar">
              <StudentDetailView profile={profile} studentId={activeId} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
              Student not found.
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#8696a0]">
            <Users size={48} className="mb-4 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Advisees</h2>
            <p className="max-w-[300px]">Select a student from the list to view their progress.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "pb-3 px-1 text-[13px] font-normal uppercase tracking-wider transition-colors border-b-4 whitespace-nowrap",
        active ? "text-white border-white" : "text-white/60 border-transparent hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

function StudentDetailView({ profile, studentId }: { profile: any, studentId: string }) {
  const [activeTab, setActiveTab] = useState<"requirements" | "essays" | "documents" | "recommendations" | "colleges">("requirements");

  return (
    <div className="flex flex-col h-full pb-10">
      <div className="bg-[#1099A1] text-white pt-6 px-6 md:pt-8 md:px-8 -mx-4 md:-mx-8 -mt-4 md:-mt-8 relative overflow-hidden shrink-0">
        <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
          <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
        </svg>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{profile.full_name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/80 text-[13px] mt-1">
                {profile.email && <span className="flex items-center gap-1.5 truncate"><Mail size={13} /> {profile.email}</span>}
                {profile.grade_level && <span className="flex items-center gap-1.5"><GraduationCap size={13} /> {profile.grade_level}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 mt-8 border-b border-white/20 overflow-x-auto">
          <TabButton active={activeTab === 'requirements'} onClick={() => setActiveTab('requirements')} label="Requirements" />
          <TabButton active={activeTab === 'essays'} onClick={() => setActiveTab('essays')} label="Essays" />
          <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} label="Documents" />
          <TabButton active={activeTab === 'recommendations'} onClick={() => setActiveTab('recommendations')} label="Recommendations" />
          <TabButton active={activeTab === 'colleges'} onClick={() => setActiveTab('colleges')} label="College List" />
        </div>
      </div>

      <div className="w-full flex-1">
        {activeTab === "requirements" && (
          <div className="animate-in fade-in duration-300 -mx-4 md:-mx-8 bg-background min-h-[600px]">
            <StudentApplicationTracker studentId={studentId} embedded forcedTab="requirements" />
          </div>
        )}

        {activeTab === "essays" && (
          <div className="animate-in fade-in duration-300 -mx-4 md:-mx-8 bg-background min-h-[600px]">
            <StudentApplicationTracker studentId={studentId} embedded forcedTab="essays" />
          </div>
        )}

        {activeTab === "documents" && (
          <div className="animate-in fade-in duration-300 -mx-4 md:-mx-8 bg-background min-h-[600px]">
            <StudentApplicationTracker studentId={studentId} embedded forcedTab="documents" />
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="animate-in fade-in duration-300 -mx-4 md:-mx-8 bg-background min-h-[600px]">
            <StudentApplicationTracker studentId={studentId} embedded forcedTab="recommendations" />
          </div>
        )}
        
        {activeTab === "colleges" && (
          <div className="animate-in fade-in duration-300 -mx-4 md:-mx-8 bg-background min-h-[600px]">
            <StudentCollegeList studentId={studentId} embedded />
          </div>
        )}
        
      </div>
    </div>
  );
}
