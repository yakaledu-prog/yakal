import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { Search, User, Video, CalendarRange, Loader2, FileText, ChevronDown, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { getStudentSessions } from "@/services/sessions";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";

interface StudentSessionRow {
  id: string;
  subject: string;
  tutor_name: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  mode: string;
  status: string;
  notes: string | null;
  zoom_meeting_id: string | null;
  zoom_link: string | null;
}

function formatTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
function formatDate(d?: string) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function getDateParts(d?: string) {
  if (!d) return { day: "", month: "" };
  const date = new Date(d + "T00:00:00");
  return {
    day: date.getDate(),
    month: date.toLocaleDateString(undefined, { month: "short" })
  };
}

export function StudentSessions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterText, setFilterText] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useSetBreadcrumb(selectedCourse ?? "All", selectedCourse ?? "All Sessions");

  const { data: sessions = [], isLoading: loading } = useQuery({
    queryKey: ["student-sessions", user?.id],
    queryFn: async () => {
      const { data } = await getStudentSessions(user!.id);
      return (data || []) as StudentSessionRow[];
    },
    enabled: !!user?.id,
  });

  const join = (s: StudentSessionRow) => {
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

  const filteredSessions = useMemo(() => {
    return courseSessions.filter((s) => {
      const isUpcoming = s.status === "upcoming";
      return activeTab === "upcoming" ? isUpcoming : !isUpcoming;
    });
  }, [courseSessions, activeTab]);

  const completedCount = courseSessions.filter((s) => s.status === "completed").length;
  const upcomingCount = courseSessions.filter((s) => s.status === "upcoming").length;

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
                <MinimalStat label="Upcoming" value={upcomingCount} />
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
          ) : filteredSessions.length === 0 ? (
            <div className="text-center py-16 border border-[#e9edef] dark:border-[#2a3942] rounded-md">
              <CalendarRange size={48} className="mx-auto text-[#aebac1] mb-4" />
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No {activeTab} sessions</h3>
              <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Book a session from the course catalog to get started.</p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {filteredSessions.map((s) => (
                <div key={s.id} className="pb-3 border-b border-border/50 last:border-0">
                  <div className="flex flex-col md:flex-row items-center gap-6 p-4">
                    {/* Date Column */}
                    <div className="flex flex-col items-center justify-center shrink-0 w-[60px]">
                      <span className="text-[24px] font-bold text-[#1099A1] leading-none tracking-tight">{getDateParts(s.date).day}</span>
                      <span className="text-[12px] font-bold text-[#1099A1] uppercase tracking-wider mt-1">{getDateParts(s.date).month}</span>
                    </div>

                    {/* Title & Time Column */}
                    <div className="flex flex-col justify-center flex-1 min-w-0 py-2 w-full md:w-auto text-center md:text-left border-l-2 border-transparent md:border-[#1099A1] md:pl-6">
                      <h2 className="text-[15px] md:text-[16px] font-medium text-[#111] dark:text-white leading-tight mb-1.5 truncate">{s.subject}</h2>
                      <span className="text-[13px] text-[#54656f] dark:text-[#aebac1] font-medium leading-tight flex items-center gap-1.5 md:justify-start justify-center">
                        <Clock size={14} /> {formatTime(s.start_time)} ({s.duration_minutes}m)
                      </span>
                    </div>

                    {/* Tutor Profile Column */}
                    <div className="flex items-center justify-center md:justify-start gap-3 shrink-0 w-full md:w-[220px]">
                      <div className="w-10 h-10 rounded-full bg-[#CAA25F]/10 flex items-center justify-center text-[#CAA25F] font-bold text-[15px] shrink-0 border border-white dark:border-[#2a3942]">
                        {s.tutor_name ? s.tutor_name.charAt(0).toUpperCase() : "T"}
                      </div>
                      <div className="flex flex-col justify-center gap-0.5 min-w-0 text-left">
                        <span className="text-[14.5px] font-normal text-[#111] dark:text-white leading-tight truncate">{s.tutor_name}</span>
                        <span className="text-[12.5px] font-normal text-[#54656f] dark:text-[#aebac1] leading-tight truncate">Tutor</span>
                      </div>
                    </div>

                    {/* Actions Column */}
                    <div className="flex items-center justify-center gap-3 w-full md:w-auto shrink-0">
                      {s.status === "upcoming" ? (
                        <div className="relative inline-flex flex-1 md:flex-none h-[40px] shadow-sm rounded-md">
                          <Button onClick={() => join(s)} className="flex-1 md:flex-none h-full px-4 text-[14px] font-normal flex items-center justify-center gap-2 bg-[#1099A1] hover:bg-[#0d848b] rounded-l-md rounded-r-none border-0 border-r border-[#0d848b] text-white">
                            <Video size={16} /> Join
                          </Button>
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === s.id ? null : s.id)}
                            className="h-full px-2 flex items-center justify-center bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-r-md transition-colors"
                          >
                            <ChevronDown size={16} />
                          </button>

                          {openDropdownId === s.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md shadow-lg z-50 py-1 overflow-hidden">
                                <button onClick={() => { setOpenDropdownId(null); join(s); }} className="w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-[#f8f9fa] dark:hover:bg-[#182329] text-[#1099A1] flex items-center gap-2 transition-colors border-b !border-[#1099A1]/10">
                                  <Video size={16} /> Join Meeting
                                </button>
                                <button onClick={() => { setOpenDropdownId(null); }} className="w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-[#f8f9fa] dark:hover:bg-[#182329] text-[#CAA25F] flex items-center gap-2 transition-colors">
                                  <CalendarRange size={16} /> Reschedule
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button variant="outline" className="flex-1 md:flex-none h-10 px-5 text-[14px] font-semibold flex items-center gap-2 rounded-md border-[#e9edef] dark:border-[#2a3942]">
                          <FileText size={16} /> View Notes
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Notes Section for completed sessions */}
                  {s.status !== "upcoming" && s.notes && (
                    <div className="px-4 pb-2 md:pl-[96px]">
                      <div className="text-[13px] text-foreground italic border-l-2 border-[#1099A1] pl-4 py-1 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: s.notes }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
