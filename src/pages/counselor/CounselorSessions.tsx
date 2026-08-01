import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { Search, CalendarRange, CheckCheck, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCounselorSessionsFull, completeSession, saveSessionNotes, SessionRow,
} from "@/services/counselorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import {
  PastSessions,
  UpcomingSessions,
  isAwaitingConfirmation,
  splitSessions,
  type SessionListItem,
} from "@/components/shared/SessionList";

export function CounselorSessions() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterText, setFilterText] = useState("");
  const [notesFor, setNotesFor] = useState<SessionRow | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  const [completing, setCompleting] = useState<string | null>(null);

  useSetBreadcrumb(selectedCourse ?? "All", selectedCourse ?? "All Sessions");

  const { data: sessions = [], isLoading: loading } = useQuery({
    queryKey: ['counselor-sessions', user?.id],
    queryFn: () => getCounselorSessionsFull(user!.id),
    enabled: !!user?.id,
  });

  const join = (id: string) => {
    const s = sessions.find((row) => row.id === id);
    if (!s) return;
    if (s.zoom_meeting_id) {
      navigate(`/counselor/meeting/${s.id}`);
      return;
    }
    const link = s.zoom_link || profile?.zoom_link;
    if (link) window.open(link, "_blank");
    else toast.error("This session has no Zoom meeting or link attached.");
  };

  const openNotes = (id: string) => {
    const s = sessions.find((row) => row.id === id);
    if (s) setNotesFor(s);
  };

  // Advising sessions are confirmed the same way tutoring ones are. Counselors
  // are not paid per session, so this only settles what happened.
  const markDone = async (id: string) => {
    setCompleting(id);
    const ok = await completeSession(id);
    setCompleting(null);
    if (ok) {
      toast.success("Session confirmed.");
      queryClient.invalidateQueries({ queryKey: ['counselor-sessions', user?.id] });
    } else {
      toast.error("Could not confirm that session.");
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

  // Counselors advise students, so the named person is the student.
  const items: SessionListItem[] = useMemo(
    () =>
      courseSessions.map((s) => ({
        id: s.id,
        date: s.date,
        startTime: s.start_time,
        durationMinutes: s.duration_minutes,
        status: s.status,
        title: s.subject,
        personName: s.student_name ?? null,
        personAvatarUrl: s.student_avatar,
        note: s.notes,
      })),
    [courseSessions]
  );

  const { upcoming } = useMemo(() => splitSessions(items), [items]);
  const completedCount = courseSessions.filter((s) => s.status === "completed").length;

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
          {activeTab === "upcoming" ? (
            <UpcomingSessions
              sessions={items}
              isLoading={loading}
              emptyText="Nothing booked yet."
              onJoin={(s) => join(s.id)}
            />
          ) : (
            <PastSessions
              sessions={items}
              isLoading={loading}
              emptyText="No past sessions."
              renderAction={(s) =>
                isAwaitingConfirmation(s) ? (
                  <button
                    type="button"
                    onClick={() => markDone(s.id)}
                    disabled={completing === s.id}
                    className="h-10 rounded-md bg-[#1099A1] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {completing === s.id ? "Confirming..." : "Mark as done"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openNotes(s.id)}
                    className="h-10 rounded-md border border-border px-5 text-[14px] font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {s.note ? "Edit note" : "Add note"}
                  </button>
                )
              }
            />
          )}
        </div>
      </section>

      {notesFor && (
        <NotesModal
          session={notesFor}
          onClose={() => setNotesFor(null)}
          onSaved={() => { setNotesFor(null); queryClient.invalidateQueries({ queryKey: ['counselor-sessions', user?.id] }); }}
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
