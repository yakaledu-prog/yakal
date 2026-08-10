import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import {
  Search, Users, Loader2, Mail, GraduationCap,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  getTutorStudents, getStudentDetail, getStudentAssignments, StudentDetail,
} from "@/services/tutorService";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { AssignmentList, type AssignmentItem } from "@/components/shared/AssignmentList";
import {
  PastSessions,
  UpcomingSessions,
  useSessionExtras,
  type SessionListItem,
} from "@/components/shared/SessionList";
import {
  RescheduleDialog,
  type ReschedulableSession,
} from "@/components/shared/RescheduleDialog";
import { dicebearUrl } from "@/utils/avatar";
import { ChatBody, useDirectConversation } from "@/components/messaging";
import { TutorStudentDiagnosticsTab } from "@/components/tutor/TutorStudentDiagnosticsTab";

export function TutorStudents() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  
  const [query, setQuery] = useState("");
  // One column at a time on a phone, both on a desktop.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();
  const [accepting, setAccepting] = useState(profile?.accepting_students !== false);

  useEffect(() => setAccepting(profile?.accepting_students !== false), [profile?.accepting_students]);

  const { data: students = [], isLoading: loading } = useQuery({
    queryKey: ['tutor-students', user?.id],
    queryFn: () => getTutorStudents(user!.id),
    enabled: !!user?.id,
  });

  const activeId = id ?? students[0]?.id;

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['tutor-student-detail', user?.id, activeId],
    queryFn: () => getStudentDetail(user!.id, activeId),
    enabled: !!user?.id && !!activeId,
  });

  useSetBreadcrumb(activeId, detail?.profile?.full_name);

  useEffect(() => {
    if (!id && students.length > 0) navigate(`/tutor/students/${students[0].id}`, { replace: true });
  }, [id, students, navigate]);

  const toggleAccepting = async () => {
    if (!user) return;
    const next = !accepting;
    setAccepting(next);
    const { error } = await supabase.from("profiles").update({ accepting_students: next }).eq("id", user.id);
    if (error) { setAccepting(!next); return toast.error("Couldn't update setting."); }
    await refreshProfile();
    toast.success(next ? "You're accepting new students." : "You're no longer accepting new students.");
  };

  const filtered = useMemo(
    () => students.filter((s) => s.full_name.toLowerCase().includes(query.toLowerCase())),
    [students, query]
  );

  return (
    <div className="students-page flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden">
      {/* Left pane */}
      <aside
        className={cn(
          "students-list w-full md:w-[300px] md:shrink-0 flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full",
          listClass
        )}
      >
        {/* Accepting-students toggle */}
        <div className="students-list__accepting flex items-center justify-between gap-3 p-3.5 border-b border-[#e9edef] dark:border-[#2a3942]">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#111] dark:text-white">Accepting new students</p>
            <p className="text-[12px] text-muted-foreground">Families can request you</p>
          </div>
          <button
            role="switch"
            aria-checked={accepting}
            onClick={toggleAccepting}
            className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", accepting ? "bg-primary" : "bg-gray-300 dark:bg-gray-600")}
          >
            <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", accepting ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </div>

        <div className="students-list__search px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
            <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students..."
              className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
            />
          </div>
        </div>

        <div className="students-list__items flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-8 px-4">{students.length === 0 ? "No students yet." : "No matches."}</p>
          ) : (
            filtered.map((s) => {
              const active = s.id === activeId;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    navigate(`/tutor/students/${s.id}`);
                    openDetail();
                  }}
                  className={cn("students-list__item w-full flex items-center gap-3 p-3 text-left border-l-2 transition-colors",
                    active ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]")}>
                  <img src={s.avatar_url || dicebearUrl(s.full_name)} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className={cn("text-[14px] font-semibold truncate", active ? "text-primary" : "text-[#111] dark:text-white")}>{s.full_name}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{s.sessionCount} sessions</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right pane: student detail */}
      <section
        className={cn(
          "student-detail flex-1 min-w-0 min-h-0 flex-col md:h-full overflow-y-auto p-4 md:p-8",
          detailClass
        )}
      >
        {students.length === 0 && !loading ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <Users size={48} className="text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No students yet</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">Students appear here once they book a session with you.</p>
          </div>
        ) : detailLoading ? (
          <div className="h-full flex justify-center items-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : !detail ? (
          <div className="p-8 text-center text-muted-foreground">Student not found.</div>
        ) : (
          <StudentDetailView detail={detail} onBack={closeDetail} />
        )}
      </section>
    </div>
  );
}

function StudentDetailView({
  detail,
  onBack,
}: {
  detail: StudentDetail;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { user, profile: me } = useAuth();
  const p = detail.profile;
  const { sessions, submissions } = detail;
  const [moving, setMoving] = useState<ReschedulableSession | null>(null);
  const { data: extras } = useSessionExtras(sessions);

  // The work set on this student's courses, with their own grade against it.
  const { data: assignmentRows = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["student-course-assignments", p?.id],
    queryFn: () => getStudentAssignments(p!.id),
    enabled: !!p?.id,
  });

  const studentAssignments: AssignmentItem[] = assignmentRows.map((a, i) => ({
    id: a.id,
    index: i + 1,
    title: a.title,
    description: a.description,
    materials: a.materials,
    dueDate: a.dueDate,
    maxPoints: a.maxPoints,
    link: a.link,
    grade: a.grade,
    isSubmitted: a.isSubmitted,
  }));

  const join = (id: string) => {
    const s = sessions.find((row) => row.id === id);
    if (!s) return;
    if (s.zoom_meeting_id) {
      navigate(`/tutor/meeting/${s.id}`);
      return;
    }
    const link = s.zoom_link || me?.zoom_link;
    if (link) window.open(link, "_blank");
    else toast.error("This session has no Zoom meeting or link attached.");
  };

  // This is the student's own page, so the person beside each session is the
  // student, not the tutor reading it.
  const sessionItems: SessionListItem[] = sessions.map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    durationMinutes: s.duration_minutes,
    status: s.status,
    title: s.subject,
    personName: p?.full_name ?? null,
    personAvatarUrl: p?.avatar_url ?? null,
    rating: extras?.ratings[s.id] ?? null,
    attendedMinutes: extras?.minutes[s.id] ?? null,
  }));
  const completed = sessions.filter((s) => s.status === "completed").length;
  const upcoming = sessions.filter((s) => s.status === "upcoming").length;
  const reviewed = submissions.filter((s) => s.status === "reviewed").length;

  // Sessions first: a tutor opening a student's record wants to know what is
  // next with them. The Overview tab that used to sit here only previewed the
  // other tabs, so it said everything twice and nothing first.
  const [activeTab, setActiveTab] = useState<"sessions" | "assignments" | "diagnostics" | "messages">("sessions");

  // The page already says whose record this is, so the Messages tab shows the
  // conversation on its own - no list, no second name in a header.
  const { conversation, send, isPeerTyping, notifyTyping } = useDirectConversation({
    userId: user?.id,
    peerId: detail.profile?.id,
    peerName: detail.profile?.full_name ?? undefined,
    peerRole: "student",
    peerAvatarUrl: detail.profile?.avatar_url,
  });

  if (!p) return <div className="p-8 text-center text-muted-foreground">Student not found.</div>;

  return (
    <div className={cn("flex flex-col h-full", activeTab !== 'messages' && "pb-10")}>
      {/* Massive Integrated Header with Inline Stats */}
      <div className="bg-[#1099A1] text-white pt-6 px-6 md:pt-8 md:px-8 -mx-4 md:-mx-8 -mt-4 md:-mt-8 mb-8 relative overflow-hidden shrink-0">
        {/* Subtle Background Texture/Graph */}
        <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
          <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
          <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
          <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
        </svg>

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Only the phone needs this: on desktop the list is still beside
                the record, so there is nothing to go back to. */}
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to students"
              className="-ml-2 shrink-0 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{p.full_name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/80 text-[13px] mt-1">
                {p.email && <span className="flex items-center gap-1.5 truncate"><Mail size={13} /> {p.email}</span>}
                {p.grade_level && <span className="flex items-center gap-1.5"><GraduationCap size={13} /> {p.grade_level}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 xl:gap-10 border-t border-white/20 xl:border-t-0 pt-4 xl:pt-0 flex-1 justify-end">
            <div className="flex items-center justify-between xl:justify-end gap-6 sm:gap-12 w-full sm:w-auto">
              <MinimalStat label="Sessions" value={sessions.length} />
              <MinimalStat label="Completed" value={completed} />
              <MinimalStat label="Upcoming" value={upcoming} />
              <MinimalStat label="Submissions" value={`${reviewed}/${submissions.length}`} />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="relative z-10 flex items-center gap-6 mt-8 border-b border-white/20 overflow-x-auto">
          <TabButton active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} label="Sessions" />
          <TabButton active={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')} label="Assignments" />
          <TabButton active={activeTab === 'diagnostics'} onClick={() => setActiveTab('diagnostics')} label="Diagnostics" />
          <TabButton active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} label="Messages" />
        </div>
      </div>

      <div className={cn("mx-auto flex flex-col", activeTab === 'messages' ? "flex-1 w-[calc(100%+32px)] md:w-[calc(100%+64px)] -mx-4 md:-mx-8 -mb-4 md:-mb-8 mt-[-32px]" : "w-full flex-1")}>
        {activeTab === "diagnostics" && (
          <TutorStudentDiagnosticsTab studentId={detail.profile?.id || ""} />
        )}

        {activeTab === "sessions" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* The same rows as everywhere else. The tab is already named
                Sessions, so a heading here would only say it twice. */}
            {sessionItems.length === 0 ? (
              <p className="py-16 text-center text-[14px] text-muted-foreground">No sessions yet.</p>
            ) : (
              <>
                <UpcomingSessions
              rescheduleAs="tutor"
                  sessions={sessionItems}
                  hideIfEmpty
                  onJoin={(s) => join(s.id)}
                  onReschedule={(s) => {
                    const row = sessions.find((r) => r.id === s.id);
                    setMoving({
                      id: s.id,
                      title: s.title,
                      date: s.date,
                      startTime: s.startTime,
                      tutorId: row?.tutor_id ?? user?.id ?? null,
                      studentId: row?.student_id ?? p?.id ?? null,
                    });
                  }}
                />
                <PastSessions sessions={sessionItems} hideIfEmpty />
              </>
            )}
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* The same cards the student sees, with their result in the
                footer. A tutor reading a student's record wants the work and
                the mark together, not a list of bare submission rows. */}
            <AssignmentList
              assignments={studentAssignments}
              isLoading={assignmentsLoading}
              emptyText="Nothing has been set on this student's courses yet."
            />
          </div>
        )}

        {activeTab === "messages" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex-1 flex flex-col min-h-[600px] bg-white dark:bg-[#111b21]">
            {conversation && (
              <ChatBody
                conversation={conversation}
                currentUserId={user?.id}
                onSendText={send}
                onTyping={notifyTyping}
                isPeerTyping={isPeerTyping}
              />
            )}
          </div>
        )}
      </div>

      {moving && <RescheduleDialog session={moving} askReason onClose={() => setMoving(null)} />}
    </div>
  );
}

function MinimalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-2.5">{label}</p>
      <p className="text-2xl font-bold leading-none">{value}</p>
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
