import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import { Search, CheckCheck, X, Loader2, ChevronLeft } from "lucide-react";
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
  useSessionExtras,
  splitSessions,
  type SessionListItem,
} from "@/components/shared/SessionList";
import { SessionsBanner } from "@/components/shared/SessionsBanner";

export function CounselorSessions() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterText, setFilterText] = useState("");
  const [notesFor, setNotesFor] = useState<SessionRow | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);


  // One column at a time on a phone, both on a desktop.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();

  // Picking a course on a phone replaces the list with its sessions, the way
  // opening a conversation does.
  const openCourse = (course: string | null) => {
    setSelectedCourse(course);
    openDetail();
  };

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



  const courses = useMemo(() => Array.from(new Set(sessions.map((s) => s.subject))), [sessions]);
  const filteredCourses = useMemo(
    () => courses.filter((c) => c.toLowerCase().includes(filterText.toLowerCase())),
    [courses, filterText]
  );

  const courseSessions = useMemo(
    () => sessions.filter((s) => (selectedCourse ? s.subject === selectedCourse : true)),
    [sessions, selectedCourse]
  );

  const { data: extras } = useSessionExtras(courseSessions);

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
        rating: extras?.ratings[s.id] ?? null,
        attendedMinutes: extras?.minutes[s.id] ?? null,
      })),
    [courseSessions, extras]
  );

  const { upcoming } = useMemo(() => splitSessions(items), [items]);
  const completedCount = courseSessions.filter((s) => s.status === "completed").length;

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden bg-background">
      {/* Left pane */}
      <aside
        className={cn(
          "w-full md:w-[300px] md:shrink-0 flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full",
          listClass
        )}
      >
        {/* Search bar */}
        <div className="px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-primary px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-primary shrink-0" />
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
                onClick={() => openCourse(null)}
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
                  <button key={c} onClick={() => openCourse(c)}
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
      <section
        className={cn(
          "flex-1 min-w-0 min-h-0 md:h-full overflow-y-auto flex-col",
          detailClass
        )}
      >
        <SessionsBanner
          title={selectedCourse || "All Sessions"}
          total={courseSessions.length}
          completed={completedCount}
          upcoming={upcoming.length}
          tabs={[
            { id: "upcoming", label: "Upcoming" },
            { id: "past", label: "Past Sessions" },
          ]}
          activeTab={activeTab}
          onTab={(id) => setActiveTab(id as "upcoming" | "past")}
          leading={
            // Only the phone needs this: on desktop the list is still beside
            // the sessions, so there is nothing to go back to.
            <button
              type="button"
              onClick={closeDetail}
              aria-label="Back"
              className="-ml-2 shrink-0 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            >
              <ChevronLeft size={22} />
            </button>
          }
        />

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
          <Button onClick={submit} disabled={saving} className="h-10 px-4 bg-primary hover:bg-primary-hover text-white font-bold flex items-center gap-2">
            {isUpcoming && <CheckCheck size={16} />} <span>{saving ? "Saving..." : isUpcoming ? "Mark As Done" : "Save Notes"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
