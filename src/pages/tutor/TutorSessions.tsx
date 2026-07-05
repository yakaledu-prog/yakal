import { useState, useEffect } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { Search, Calendar, Clock, User, Video, FileText, CalendarRange, CheckCircle2, X } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTutorSessionsFull, completeSession, saveSessionNotes, SessionRow,
} from "@/services/tutorService";

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

export function TutorSessions() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterText, setFilterText] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesFor, setNotesFor] = useState<SessionRow | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setSessions(await getTutorSessionsFull(user.id));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const join = (s: SessionRow) => {
    const link = s.zoom_link || profile?.zoom_link;
    if (link) window.open(link, "_blank");
    else toast.error("No session link set. Add one in your profile.");
  };

  const filtered = sessions.filter((s) => {
    const isUpcoming = s.status === "upcoming";
    const matchesTab = activeTab === "upcoming" ? isUpcoming : !isUpcoming;
    const q = filterText.toLowerCase();
    const matches = s.subject.toLowerCase().includes(q) || (s.student_name || "").toLowerCase().includes(q);
    return matchesTab && matches;
  });

  return (
    <PageWrapper>
      <div className="w-full p-8 pb-12 h-full dark:bg-[#111b21]">
        {/* Search */}
        <div className="relative w-full mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
          </div>
          <input
            type="text"
            placeholder="Search sessions..."
            className="pl-9 pr-3 py-2 h-10 bg-white dark:bg-[#111b21] text-[#111] dark:text-white border border-[#e9edef] dark:border-[#2a3942] rounded-md focus:outline-none focus:border-primary w-full text-[14px]"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#e9edef] dark:border-[#2a3942] mb-6">
          {(["upcoming", "past"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-6 py-3 text-[14px] font-semibold border-b-2 transition-colors capitalize",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
              )}
            >
              {tab === "upcoming" ? "Upcoming" : "Past Sessions"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md">
            <CalendarRange size={48} className="mx-auto text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No {activeTab} sessions</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Sessions will appear here once students book with you.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md p-5 hover:shadow-sm transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-[18px] font-bold text-[#111] dark:text-white">{s.subject}</h2>
                      <Badge
                        variant={s.status === "completed" ? "success" : s.status === "cancelled" || s.status === "no-show" ? "destructive" : "secondary"}
                        className="rounded-sm text-[11px] font-semibold px-2 py-0.5 uppercase tracking-wider"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-[13px] text-[#54656f] dark:text-[#aebac1]">
                      <span className="flex items-center gap-1.5"><User size={14} /><span className="font-medium text-[#111] dark:text-[#e9edef]">{s.student_name}</span></span>
                      <span className="flex items-center gap-1.5"><Calendar size={14} />{formatDate(s.date)}</span>
                      <span className="flex items-center gap-1.5"><Clock size={14} />{formatTime(s.start_time)} ({s.duration_minutes} min)</span>
                    </div>
                    {s.notes && s.status === "completed" && (
                      <p className="mt-3 text-[13px] text-[#54656f] dark:text-[#aebac1] bg-[#f8f9fa] dark:bg-[#182329] rounded-md p-3 line-clamp-2">{s.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {s.status === "upcoming" ? (
                      <>
                        <Button onClick={() => join(s)} className="flex-1 md:flex-none h-9 text-[13px] font-semibold flex items-center gap-2 bg-[#1099A1] hover:bg-[#0d848b]">
                          <Video size={14} /> Join
                        </Button>
                        <Button variant="outline" onClick={() => setNotesFor(s)} className="flex-1 md:flex-none h-9 text-[13px] font-semibold border-[#e9edef] dark:border-[#2a3942] flex items-center gap-2">
                          <CheckCircle2 size={14} /> Mark Complete
                        </Button>
                      </>
                    ) : s.status === "completed" ? (
                      <Button variant="outline" onClick={() => setNotesFor(s)} className="w-full md:w-auto h-9 text-[13px] font-semibold border-[#e9edef] dark:border-[#2a3942] flex items-center gap-2">
                        <FileText size={14} /> {s.notes ? "Edit Notes" : "Add Notes"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notesFor && (
        <NotesModal
          session={notesFor}
          onClose={() => setNotesFor(null)}
          onSaved={() => { setNotesFor(null); load(); }}
        />
      )}
    </PageWrapper>
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
          <Button onClick={submit} disabled={saving} className="h-10 px-6 bg-[#1099A1] hover:bg-[#0d848b] text-white font-bold">
            {saving ? "Saving..." : isUpcoming ? "Mark Complete" : "Save Notes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
