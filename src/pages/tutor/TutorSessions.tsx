import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { Search, Video, CalendarRange, CheckCheck, X, Loader2, SquarePenIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTutorSessionsFull, completeSession, saveSessionNotes, SessionRow,
} from "@/services/tutorService";
import { TipTapEditor } from "@/components/ui/TipTapEditor";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";

function formatTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}
function getDateParts(d?: string) {
  if (!d) return { day: "", month: "" };
  const date = new Date(d + "T00:00:00");
  return {
    day: date.getDate(),
    month: date.toLocaleDateString(undefined, { month: "short" })
  };
}

export function TutorSessions() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterText, setFilterText] = useState("");
  const [notesFor, setNotesFor] = useState<SessionRow | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState("");
  const [inlineSaving, setInlineSaving] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedCourse, filterText]);

  useSetBreadcrumb(selectedCourse ?? "All", selectedCourse ?? "All Sessions");

  const { data: sessions = [], isLoading: loading } = useQuery({
    queryKey: ['tutor-sessions', user?.id],
    queryFn: () => getTutorSessionsFull(user!.id),
    enabled: !!user?.id,
  });

  const join = (s: SessionRow) => {
    if (s.zoom_meeting_id) {
      navigate(`/tutor/meeting/${s.id}`);
      return;
    }
    const link = s.zoom_link || profile?.zoom_link;
    if (link) window.open(link, "_blank");
    else toast.error("This session has no Zoom meeting or link attached.");
  };

  const saveInlineNotes = async (id: string) => {
    setInlineSaving(true);
    const ok = await saveSessionNotes(id, editingNotesText.trim());
    setInlineSaving(false);
    if (ok) {
      toast.success("Notes saved.");
      setEditingNotesId(null);
      queryClient.invalidateQueries({ queryKey: ['tutor-sessions', user?.id] });
    } else {
      toast.error("Something went wrong.");
    }
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

  const paginatedSessions = useMemo(() => {
    return filteredSessions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredSessions, currentPage]);
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);

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
              <div className="flex items-center justify-between xl:justify-end gap-6 sm:gap-12 w-full sm:w-auto">
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
              <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Sessions will appear here once students book with you.</p>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {paginatedSessions.map((s) => (
                <div key={s.id} className="pb-4 border-b border-border/50 last:border-0">
                  <div className="bg-white dark:bg-[#111b21] flex flex-col md:flex-row gap-6 p-4">
                    {/* Left Sidebar: Date & Time */}
                    <div className="flex flex-col items-center shrink-0 w-[80px]">
                      <span className="text-[28px] font-bold text-[#1099A1] leading-none tracking-tight">{getDateParts(s.date).day}</span>
                      <span className="text-[13px] font-bold text-[#1099A1] uppercase tracking-wider mt-1">{getDateParts(s.date).month}</span>
                      <div className="h-4" />
                      <span className="text-[12.5px] text-[#54656f] dark:text-[#aebac1] font-medium text-center leading-tight">{formatTime(s.start_time)}</span>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      {/* Row 1: Title and Status */}
                      <div className="flex items-start justify-between gap-4 mb-5">
                        <h2 className="text-[18px] md:text-[20px] font-medium text-[#111] dark:text-white leading-tight">{s.subject}</h2>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          {s.status === "completed" ? (
                            <button onClick={() => { setEditingNotesId(s.id); setEditingNotesText(s.notes || ""); }} className="text-[14px] font-semibold flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                              <SquarePenIcon size={18} /> {s.notes ? "Edit Notes" : "Add Notes"}
                            </button>
                          ) : s.status !== "upcoming" ? (
                            <Badge variant="destructive" className="rounded-sm text-[11px] uppercase font-bold tracking-wider px-2 py-0.5">
                              {s.status}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {/* Row 2: Student Details & Actions */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-4">
                            {s.student_avatar ? (
                              <img src={s.student_avatar} alt={s.student_name} className="w-11 h-11 rounded-full object-cover shrink-0 border border-white dark:border-[#2a3942] shadow-sm" />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[16px] shrink-0 border border-white dark:border-[#2a3942] shadow-sm">
                                {s.student_name ? s.student_name.charAt(0).toUpperCase() : "S"}
                              </div>
                            )}
                            <div className="flex flex-col justify-center">
                              <span className="text-[15px] font-bold text-[#111] dark:text-white leading-tight mb-0.5">{s.student_name}</span>
                              <span className="text-[13px] text-[#54656f] dark:text-[#aebac1] leading-tight">Student</span>
                            </div>
                          </div>

                          {editingNotesId === s.id ? (
                            <div className="mt-5 border border-border/50 rounded-lg overflow-hidden flex flex-col bg-[#f8f9fa] dark:bg-[#182329] shadow-sm">
                              <TipTapEditor
                                value={editingNotesText}
                                onChange={setEditingNotesText}
                                toolbarRight={
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => setEditingNotesId(null)} className="text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors px-2">Cancel</button>
                                    <Button size="sm" onClick={() => saveInlineNotes(s.id)} disabled={inlineSaving} className="!h-8 text-[12px] px-4 font-semibold bg-[#1099A1] hover:bg-[#0d848b] text-white border-0">
                                      {inlineSaving ? "Saving..." : "Save"}
                                    </Button>
                                  </div>
                                }
                              />
                            </div>
                          ) : s.notes && s.status === "completed" ? (
                            <div className="mt-5 text-[14px] text-muted-foreground italic border-l-2 border-[#1099A1] pl-4 py-1 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: s.notes }} />
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0">
                          {s.status === "upcoming" ? (
                            <>
                              <Button onClick={() => join(s)} className="flex-1 md:flex-none h-[42px] px-6 text-[14px] font-normal flex items-center justify-center gap-2 bg-[#1099A1] hover:bg-[#0d848b] rounded-md shadow-sm">
                                <Video size={16} /> Join
                              </Button>
                              <Button style={{ backgroundColor: '#CAA25F', color: 'white' }} className="flex-1 md:flex-none h-[42px] px-6 text-[14px] font-normal border-0 flex items-center justify-center gap-2 rounded-md hover:opacity-90 transition-opacity shadow-sm">
                                <CalendarRange size={16} /> Reschedule
                              </Button>
                            </>
                          ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-6 mt-8 pt-4">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="text-[14px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-[13px] text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="text-[14px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:hover:text-muted-foreground transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {notesFor && (
        <NotesModal
          session={notesFor}
          onClose={() => setNotesFor(null)}
          onSaved={() => { setNotesFor(null); queryClient.invalidateQueries({ queryKey: ['tutor-sessions', user?.id] }); }}
        />
      )}
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

function NotesModal({ session, onClose, onSaved }: { session: SessionRow; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState(session.notes || "");
  const [saving, setSaving] = useState(false);
  const isUpcoming = session.status === "upcoming";

  const submit = async () => {
    setSaving(true);
    const ok = isUpcoming
      ? await completeSession(session.id, notes.trim() || undefined)
      : await saveSessionNotes(session.id, notes.trim());
    setSaving(false);
    if (ok) {
      toast.success(isUpcoming ? "Session marked complete." : "Notes saved.");
      onSaved();
    } else {
      toast.error("Something went wrong.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
          <h2 className="text-[18px] font-bold text-[#111] dark:text-white">
            {isUpcoming ? "Complete session" : "Session notes"}
          </h2>
          <button onClick={onClose} className="p-1.5 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
            {session.subject} · {session.student_name}
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="What did you cover? Any follow-ups for next time?"
            className="w-full rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-transparent p-3 text-[14px] text-[#111] dark:text-white focus:outline-none focus:border-primary resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
          <Button variant="outline" onClick={onClose} className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
          <Button onClick={submit} disabled={saving} className="h-10 px-4 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold flex items-center gap-2">
            {isUpcoming && <CheckCheck size={16} />} <span>{saving ? "Saving..." : isUpcoming ? "Mark As Done" : "Save Notes"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
