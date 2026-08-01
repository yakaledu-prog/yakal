import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import { Search, CalendarRange, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getStudentSessions } from "@/services/sessions";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import {
  PastSessions,
  UpcomingSessions,
  splitSessions,
  type SessionListItem,
} from "@/components/shared/SessionList";
import {
  RescheduleDialog,
  type ReschedulableSession,
} from "@/components/shared/RescheduleDialog";

interface StudentSessionRow {
  id: string;
  subject: string;
  tutor_id: string;
  tutor_name: string;
  tutor_avatar: string | null;
  date: string;
  start_time: string;
  duration_minutes: number;
  mode: string;
  status: string;
  notes: string | null;
  zoom_meeting_id: string | null;
  zoom_link: string | null;
}

export function StudentSessions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterText, setFilterText] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [moving, setMoving] = useState<ReschedulableSession | null>(null);

  useSetBreadcrumb(selectedCourse ?? "All", selectedCourse ?? "All Sessions");

  const { data: sessions = [], isLoading: loading } = useQuery({
    queryKey: ["student-sessions", user?.id],
    queryFn: async () => {
      const { data } = await getStudentSessions(user!.id);
      return (data || []) as StudentSessionRow[];
    },
    enabled: !!user?.id,
  });

  const join = (id: string) => {
    const s = sessions.find((row) => row.id === id);
    if (!s) return;
    // The in-app meeting whenever there is one; the raw link is the fallback
    // for a session booked before meetings were created for them.
    if (s.zoom_meeting_id) {
      navigate(`/student/meeting/${s.id}`);
      return;
    }
    if (s.zoom_link) window.open(s.zoom_link, "_blank");
  };

  const courses = useMemo(() => Array.from(new Set(sessions.map((s) => s.subject))), [sessions]);
  const filteredCourses = useMemo(
    () => courses.filter((c) => c.toLowerCase().includes(filterText.toLowerCase())),
    [courses, filterText]
  );

  const courseSessions = useMemo(
    () => sessions.filter((s) => (selectedCourse ? s.subject === selectedCourse : true)),
    [sessions, selectedCourse]
  );

  // One shape for the shared lists, whatever the page around them looks like.
  const items: SessionListItem[] = useMemo(
    () =>
      courseSessions.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.start_time,
        durationMinutes: s.duration_minutes,
        status: s.status,
        title: s.subject,
        personName: s.tutor_name,
        personAvatarUrl: s.tutor_avatar,
        note: s.notes,
      })),
    [courseSessions]
  );

  // The lists decide what is still to come by the clock, so the counts beside
  // the title have to agree with them rather than count the status column.
  const { upcoming, past } = useMemo(() => splitSessions(items), [items]);
  const completedCount = courseSessions.filter((s) => s.status === "completed").length;

  const toReschedulable = (s: SessionListItem): ReschedulableSession => ({
    id: s.id,
    title: s.title,
    date: s.date,
    startTime: s.startTime,
    tutorId: sessions.find((r) => r.id === s.id)?.tutor_id ?? null,
    studentId: user?.id ?? null,
  });

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden bg-background">
      {/* Left pane */}
      <aside className="w-full md:w-[300px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full">
        {/* Search bar */}
        <div className="px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search courses"
              className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <>
              <button
                onClick={() => setSelectedCourse(null)}
                className={cn("w-full flex items-center gap-3 p-4 text-left border-l-2 transition-colors",
                  selectedCourse === null ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]")}>
                <div className="min-w-0">
                  <p className={cn("text-[14px] font-semibold truncate", selectedCourse === null ? "text-primary" : "text-[#111] dark:text-white")}>All Sessions</p>
                  <p className="text-[12px] text-muted-foreground truncate">{sessions.length} sessions total</p>
                </div>
              </button>
              {filteredCourses.map((c) => {
                const active = c === selectedCourse;
                const cSessions = sessions.filter(s => s.subject === c);
                return (
                  <button key={c} onClick={() => setSelectedCourse(c)}
                    className={cn("w-full flex items-center gap-3 p-4 text-left border-l-2 transition-colors",
                      active ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]")}>
                    <div className="min-w-0">
                      <p className={cn("text-[14px] font-semibold truncate", active ? "text-primary" : "text-[#111] dark:text-white")}>{c}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{cSessions.length} sessions</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </aside>

      {/* Right pane */}
      <section className="flex-1 min-w-0 md:h-full md:overflow-y-auto flex flex-col">
        {/* Integrated Header */}
        <div className="bg-[#1099A1] text-white pt-6 px-6 md:pt-8 md:px-8 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{selectedCourse || "All Sessions"}</h1>
                <div className="flex flex-wrap items-center gap-4 text-white/80 text-[13px] mt-1">
                  <span className="flex items-center gap-1.5"><CalendarRange size={13} /> {courseSessions.length} Total Sessions</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 xl:gap-10 border-t border-white/20 xl:border-t-0 pt-4 xl:pt-0 flex-1 justify-end">
              <div className="flex items-center justify-between xl:justify-end gap-6 sm:gap-12 w-full xl:w-auto">
                <MinimalStat label="Total" value={courseSessions.length} />
                <MinimalStat label="Completed" value={completedCount} />
                <MinimalStat label="Upcoming" value={upcoming.length} />
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-6 mt-8 border-b border-white/20 overflow-x-auto">
            <TabButton active={activeTab === 'upcoming'} onClick={() => setActiveTab('upcoming')} label="Upcoming" />
            <TabButton active={activeTab === 'past'} onClick={() => setActiveTab('past')} label="Past Sessions" />
          </div>
        </div>

        <div className="p-4 md:p-8 w-full flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-primary h-8 w-8" />
            </div>
          ) : (activeTab === "upcoming" ? upcoming : past).length === 0 ? (
            <div className="text-center py-16 border border-[#e9edef] dark:border-[#2a3942] rounded-md">
              <CalendarRange size={48} className="mx-auto text-[#aebac1] mb-4" />
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No {activeTab} sessions</h3>
              <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Book a session from the course catalog to get started.</p>
            </div>
          ) : activeTab === "upcoming" ? (
            <UpcomingSessions
              sessions={items}
              onJoin={(s) => join(s.id)}
              onReschedule={(s) => setMoving(toReschedulable(s))}
            />
          ) : (
            <PastSessions sessions={items} />
          )}
        </div>

        {moving && <RescheduleDialog session={moving} onClose={() => setMoving(null)} />}
      </section>
    </div>
  );
}

function MinimalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xl font-bold leading-none">{value}</p>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("pb-3 px-1 text-[14px] font-medium transition-colors border-b-2 relative top-[1px] whitespace-nowrap outline-none",
        active ? "text-white border-white" : "text-white/60 border-transparent hover:text-white/90 hover:border-white/30")}
    >
      {label}
    </button>
  );
}
