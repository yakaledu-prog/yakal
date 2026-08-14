import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useMasterDetail } from "@/hooks/useMasterDetail";
import { getStudentSessions } from "@/services/sessions";
import {
  PastSessions,
  UpcomingSessions,
  useSessionExtras,
  type SessionListItem,
} from "@/components/shared/SessionList";
import { Search, Loader2, Users, UserPlus, X, ChevronLeft, ShieldAlertIcon } from "lucide-react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { dicebearUrl } from "@/utils/avatar";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ManageChildrenPanel } from "@/components/shared/ManageChildrenPanel";
import {
  getLinkedChildren,
  getChildServices,
  getUpcomingSessionCounts,
} from "@/services/parentService";

export function ParentChildren() {
  // One column at a time on a phone, both on a desktop.
  const { openDetail, closeDetail, listClass, detailClass } = useMasterDetail();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [managing, setManaging] = useState(false);

  // Real linked children. This page used to render two invented ones and then
  // patch the second's id with a lookup of student@yakal.com, so it only ever
  // worked for the seeded demo account.
  const { data: linked = [], isLoading } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  const childIds = linked.map((c) => c.id);
  const { data: services = [] } = useQuery({
    queryKey: ["children-services", childIds.join(",")],
    queryFn: () => getChildServices(childIds),
    enabled: childIds.length > 0,
  });

  const { data: sessionCounts = {} } = useQuery({
    queryKey: ["children-session-counts", childIds.join(",")],
    queryFn: () => getUpcomingSessionCounts(childIds),
    enabled: childIds.length > 0,
  });

  const childrenData = useMemo(
    () =>
      linked.map((c) => ({
        id: c.id,
        name: c.full_name,
        avatar: c.avatar_url ?? "",
        grade: c.grade_level ?? "Grade not set",
        sessions: sessionCounts[c.id] ?? 0,
        active_services: services
          .filter((s) => s.student_id === c.id && s.is_active)
          .map((s) => s.service),
      })),
    [linked, services, sessionCounts]
  );

  const activeId = id ?? childrenData[0]?.id;

  const filtered = useMemo(
    () => childrenData.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query, childrenData]
  );

  const activeChild = childrenData.find(c => c.id === activeId);

  return (
    <PageWrapper className="!p-0">
      {/* No min-h-screen. This sits below the top bar, so a full viewport
          height ran exactly the bar's height past the bottom of the screen and
          pushed the chat footer out of view. h-full is the space there
          actually is, and min-h-0 lets the chat shrink into it. */}
      <div className="flex-1 bg-background dark:bg-[#111b21] flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden">

        {/* Left pane */}
        <aside
          className={cn(
            "w-full md:w-[300px] md:shrink-0 flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full bg-white dark:bg-[#111b21]",
            listClass
          )}
        >
          <div className="px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942]">
            <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-primary px-2 py-2 transition ease-in-out">
              <Search size={18} className="text-[#697780] group-focus-within:text-primary shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search children..."
                className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-primary" size={22} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Users size={28} className="mx-auto text-[#aebac1] mb-2" />
                <p className="text-[13.5px] font-medium text-foreground">
                  {query ? "No matches." : "No children linked yet"}
                </p>
                {!query && (
                  <p className="text-[12.5px] text-muted-foreground mt-1">
                    A child appears here once their account is linked to yours.
                  </p>
                )}
              </div>
            ) : (
              filtered.map((c) => {
                const active = c.id === activeId;
                return (
                  <button key={c.id} onClick={() => { openDetail(); navigate(`/parent/children/${c.id}`); }}
                    className={cn("w-full flex items-center gap-3 p-4 text-left border-l-2 transition-colors",
                      active ? "bg-primary/5 border-l-primary" : "border-l-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329]")}>
                    <img src={c.avatar || dicebearUrl(c.name)} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className={cn("text-[14px] font-semibold truncate", active ? "text-primary" : "text-[#111] dark:text-white")}>{c.name}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{c.grade}</p>
                    </div>
                  </button>
                );
              })
            )}

            {/* Sits at the end of the list rather than pinned to the bottom of
                the pane, so it reads as the next item after the children. */}
            {!isLoading && (
              <div className="p-3">
                <button
                  onClick={() => setManaging(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-primary/50 text-primary text-[13.5px] font-semibold hover:bg-primary/5 transition-colors"
                >
                  <UserPlus size={15} /> Add child
                </button>
              </div>
            )}
          </div>

        </aside>

        {/* Right pane */}
        <section
          className={cn(
            "flex-1 min-w-0 md:h-full overflow-y-auto md:overflow-hidden bg-white dark:bg-[#111b21] flex-col min-h-0",
            detailClass
          )}
        >
          {!activeChild ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 p-4 md:p-8">
              <Users size={48} className="text-[#aebac1] mb-4" />
              <p className="text-[16px] font-medium text-[#54656f] dark:text-[#aebac1] mb-2">No child selected</p>
            </div>
          ) : (
            <ChildDetailView child={activeChild} onBack={closeDetail} />
          )}
        </section>
      </div>
      {managing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#182229] rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5 md:p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-[18px] font-bold text-foreground">Manage children</h2>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Add a child by email, then choose which services they can use.
                </p>
              </div>
              <button
                onClick={() => setManaging(false)}
                aria-label="Close"
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <ManageChildrenPanel />
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

import { Lock } from "lucide-react";
import { ParentMessages } from "./ParentMessages";
import { AssignmentList, type AssignmentItem } from "@/components/shared/AssignmentList";
import { StudentCollegeList } from "@/pages/student/StudentCollegeList";
import { getAllAssignments } from "@/services/studentService";
import { getFlaggedStudentIds } from "@/services/reports";
import { StudentApplicationTracker } from "@/pages/student/StudentApplicationTracker";

function ChildDetailView({ child, onBack }: { child: any; onBack: () => void }) {
  // Whether the scan has picked anything out of this child's conversations, so
  // the Messages tab can say so without being opened first.
  const { data: flaggedStudents } = useQuery({
    queryKey: ["flagged-students", child.id],
    queryFn: () => getFlaggedStudentIds([child.id]),
    enabled: !!child.id,
  });
  const hasFlaggedChat = !!flaggedStudents?.has(child.id);

  const { data: assignmentRows = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["child-assignments", child.id],
    queryFn: () => getAllAssignments(child.id),
    enabled: !!child.id,
  });

  const childAssignments: AssignmentItem[] = assignmentRows.map((a, i) => ({
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

  // A parent watches rather than attends, so no join and no reschedule here:
  // the rows are there to be read.
  const { data: sessionRows = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["student-sessions", child.id],
    queryFn: async () => {
      const { data } = await getStudentSessions(child.id);
      return (data ?? []) as any[];
    },
    enabled: !!child.id,
  });

  const { data: sessionExtras } = useSessionExtras(sessionRows);

  const childSessions: SessionListItem[] = sessionRows.map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    durationMinutes: s.duration_minutes,
    status: s.status,
    title: s.subject,
    personName: s.tutor_name ?? null,
    personAvatarUrl: s.tutor_avatar ?? null,
    rating: sessionExtras?.ratings[s.id] ?? null,
    attendedMinutes: sessionExtras?.minutes[s.id] ?? null,
  }));

  // Sessions first: what is coming up is the question a parent opens this to
  // ask. Overview was a feed of invented activity, naming tutors and homework
  // that do not exist, so it is gone rather than moved.
  const [activeTab, setActiveTab] = useState<
    "sessions" | "assignments" | "applications" | "colleges" | "messages"
  >("sessions");

  const hasAdmissions = child.active_services?.includes('admissions');

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Massive Integrated Header with Inline Stats */}
      <div className={cn("bg-primary text-white pt-6 px-6 md:pt-8 md:px-8 relative overflow-hidden shrink-0", activeTab !== 'messages' ? "mb-8" : "mb-0")}>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Only the phone needs this: on desktop the list is still beside
                the record, so there is nothing to go back to. */}
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="-ml-2 shrink-0 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{child.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-white/80 text-[13px] mt-1">
                <span>{child.grade}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 xl:gap-10 border-t border-white/20 xl:border-t-0 pt-4 xl:pt-0 flex-1 justify-end">
            <div className="flex items-center justify-between xl:justify-end gap-6 sm:gap-12 w-full sm:w-auto">
              <MinimalStat label="Upcoming Sessions" value={child.sessions} />
              <MinimalStat label="Completed" value={12} />
              <MinimalStat label="Assignments Due" value={2} />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="relative z-10 flex items-center gap-6 mt-8 border-b border-white/20 overflow-x-auto">
          <TabButton active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} label="Sessions" />
          <TabButton active={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')} label="Assignments" />
          <TabButton active={activeTab === 'applications'} onClick={() => setActiveTab('applications')} label="Application Tracking" />
          {/* The college list is a plain list, so it sits here where the child
              is already chosen. The roadmap and the catalogue carry tabs and
              filter rails of their own, which is why those two are pages. */}
          {hasAdmissions && (
            <TabButton active={activeTab === 'colleges'} onClick={() => setActiveTab('colleges')} label="College List" />
          )}
          <TabButton active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} label="Messages" alert={hasFlaggedChat} />
        </div>
      </div>

      {/* min-h-0 is what lets this shrink inside the column. Without it the
          chat grew to its content height and pushed the composer off screen. */}
      <div
        className={cn(
          "mx-auto flex w-full flex-1 min-h-0 flex-col",
          activeTab !== 'messages' ? "px-4 md:px-8 pb-10 overflow-y-auto" : "overflow-hidden"
        )}
      >
        {activeTab === 'sessions' && (
          // The child's real sessions. What was here named tutors who do not
          // work here and lessons nobody booked, which is a worse answer to
          // "what has my child got on" than no answer at all.
          childSessions.length === 0 && !sessionsLoading ? (
            <p className="py-16 text-center text-[14px] text-muted-foreground">
              Nothing booked for {child.name} yet.
            </p>
          ) : (
            <>
              <UpcomingSessions sessions={childSessions} isLoading={sessionsLoading} hideIfEmpty />
              <PastSessions sessions={childSessions} hideIfEmpty />
            </>
          )
        )}
        {activeTab === 'assignments' && (
          // The child's real coursework, on the same cards the student and the
          // tutor read. What was here was two invented lines about Gatsby and
          // a physics chapter that nobody had set.
          <AssignmentList
            assignments={childAssignments}
            isLoading={assignmentsLoading}
            emptyText={`Nothing has been set for ${child.name} yet.`}
          />
        )}
        {activeTab === 'applications' && (
          <div className="space-y-6">
            {!hasAdmissions ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-muted/10 animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                  <Lock size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">College Admissions Locked</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  Upgrade to our College Admissions service to track {child.name}'s application progress, essays, and college list.
                </p>
                <Link to={'/parent/billing'} className="bg-[#111] dark:bg-white text-white dark:text-[#111] hover:opacity-80 px-6 py-2.5 rounded-xl font-bold transition-all">
                  Manage Services
                </Link>
              </div>
            ) : (
              /* The student's own requirements view, read only.
                 What was here before derived the ticks from the school's name:
                 anything containing "Hopkins" got six requirements, anything
                 containing "Maryland" got none. So it agreed with the student's
                 own tracker only by accident. Sharing the component means a
                 parent sees exactly what their child sees. */
              <div className="-mx-4 md:-mx-8">
                <StudentApplicationTracker
                  studentId={child.id}
                  embedded
                  canEdit={false}
                  forcedTab="requirements"
                />
              </div>
            )}
          </div>
        )}
        {activeTab === 'colleges' && (
          // Read only here. A parent adds from Explore, where the catalogue is.
          <StudentCollegeList studentId={child.id} embedded canEdit={false} />
        )}

        {activeTab === 'messages' && (
          <ParentMessages embedded childId={child.id} childName={child.name} childAvatarUrl={child.avatar} />
        )}

      </div>
    </div>
  );
}

function MinimalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col">
      <span className="text-white/70 text-[11px] font-bold uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  alert,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  /** Something in this tab needs looking at. */
  alert?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-1.5 pb-3 text-[14px] font-normal capitalize border-b-2 transition-colors whitespace-nowrap",
        active ? "border-white text-white" : "border-transparent text-white/60 hover:text-white hover:border-white/40")}
    >
      {label}
      {/* The same icon as the conversation it points at, so the tab and the
          row it leads to are recognisably the same warning. Not a count: how
          many messages were picked out is not the point, and a number invites
          reading it as unread mail. */}
      {alert && (
        <ShieldAlertIcon
          size={15}
          aria-label="Needs a look"
          className="shrink-0 animate-pulse"
        />
      )}
    </button>
  );
}
