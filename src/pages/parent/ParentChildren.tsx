import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { Search, Loader2, Users, UserPlus, X } from "lucide-react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { dicebearUrl } from "@/utils/avatar";
import { Button } from "@/components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { getCollegeProfile } from "@/services/collegeService";
import { useAuth } from "@/contexts/AuthContext";
import { ManageChildrenPanel } from "@/components/shared/ManageChildrenPanel";
import {
  getLinkedChildren,
  getChildServices,
  getUpcomingSessionCounts,
} from "@/services/parentService";

export function ParentChildren() {
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
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] flex flex-col md:flex-row h-full min-h-0 overflow-y-auto md:overflow-hidden">

        {/* Left pane */}
        <aside className="w-full md:w-[300px] shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[#e9edef] dark:border-[#2a3942] md:h-full bg-white dark:bg-[#111b21]">
          <div className="px-3 pt-5 pb-2 border-b border-[#e9edef] dark:border-[#2a3942]">
            <div className="flex items-center gap-2 border-b-2 border-transparent group focus-within:border-[#1099A1] px-2 py-2 transition ease-in-out">
              <Search size={18} className="text-[#697780] group-focus-within:text-[#1099A1] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search children..."
                className="bg-transparent text-[14px] text-[#111] dark:text-white placeholder:text-[#8696a0] flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 md:overflow-y-auto max-h-[34vh] md:max-h-none overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-[#1099A1]" size={22} />
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
                  <button key={c.id} onClick={() => navigate(`/parent/children/${c.id}`)}
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[#1099A1]/50 text-[#1099A1] text-[13.5px] font-semibold hover:bg-[#1099A1]/5 transition-colors"
                >
                  <UserPlus size={15} /> Add child
                </button>
              </div>
            )}
          </div>

        </aside>

        {/* Right pane */}
        <section className="flex-1 min-w-0 md:h-full md:overflow-y-auto bg-white dark:bg-[#111b21]">
          {!activeChild ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 p-4 md:p-8">
              <Users size={48} className="text-[#aebac1] mb-4" />
              <p className="text-[16px] font-medium text-[#54656f] dark:text-[#aebac1] mb-2">No child selected</p>
            </div>
          ) : (
            <ChildDetailView child={activeChild} />
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

import { Lock, FileText, CheckCircle2, Circle, ChevronDown, Check } from "lucide-react";
import { ParentMessages } from "./ParentMessages";

function ChildDetailView({ child }: { child: any }) {
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "assignments" | "messages" | "applications">("overview");

  const hasAdmissions = child.active_services?.includes('admissions');

  const { data: profile, isLoading } = useQuery({
    queryKey: ["college-profile", child.id],
    queryFn: () => getCollegeProfile(child.id),
    enabled: activeTab === 'applications' && hasAdmissions
  });

  const schools = profile?.schools || [];
  const standardReqs = ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores", "FAFSA", "CSS Profile"];

  return (
    <div className={cn("flex flex-col h-full", activeTab !== 'messages' && "pb-10")}>
      {/* Massive Integrated Header with Inline Stats */}
      <div className={cn("bg-[#1099A1] text-white pt-6 px-6 md:pt-8 md:px-8 relative overflow-hidden shrink-0", activeTab !== 'messages' ? "mb-8" : "mb-0")}>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
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
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" />
          <TabButton active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} label="Sessions" />
          <TabButton active={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')} label="Assignments" />
          <TabButton active={activeTab === 'applications'} onClick={() => setActiveTab('applications')} label="Application Tracking" />
          <TabButton active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} label="Messages" />
        </div>
      </div>

      <div className={cn("mx-auto flex flex-col w-full flex-1", activeTab !== 'messages' ? "px-4 md:px-8" : "")}>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Recent Activity for {child.name}</h3>
            <div className="space-y-0">
              <FeedItem text={`${child.name} submitted Math Homework #3`} time="2 hours ago" />
              <FeedItem text={`Dr. Alex graded ${child.name}'s Lab Report`} time="5 hours ago" />
              <FeedItem text="System processed your course enrollment for AP Calculus" time="Yesterday" />
            </div>
          </div>
        )}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Upcoming Sessions</h3>
            <div className="space-y-0">
              <FeedItem text="Algebra II Tutoring with Sarah J." time="Today, 4:00 PM" />
              <FeedItem text="Physics Exam Prep with Dr. Alex" time="Tomorrow, 5:30 PM" />
              <FeedItem text="College Essay Review" time="Oct 15, 6:00 PM" />
            </div>
          </div>
        )}
        {activeTab === 'assignments' && (
          <div className="space-y-6">
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Assignments & Homework</h3>
            <div className="space-y-0">
              <FeedItem text="Chapter 4 Physics Problems (Due: Tomorrow)" time="In Progress" />
              <FeedItem text="Read 'The Great Gatsby' Chapters 1-3" time="Not Started" />
            </div>
          </div>
        )}
        {activeTab === 'applications' && (
          <div className="space-y-6">
            {/* <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-4">Application Progress</h3> */}
            {!hasAdmissions ? (
              <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-muted/10 animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 bg-[#1099A1]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#1099A1]">
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
            ) : isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1099A1]" /></div>
            ) : schools.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p className="text-[14px]">No schools added yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {schools.map((s: any) => {
                  const reqs = s.requirements || [];
                  let schoolReqs: string[] = [];
                  if (s.notes && s.notes.startsWith("[")) {
                    try { schoolReqs = JSON.parse(s.notes); } catch (e) { }
                  } else {
                    schoolReqs = standardReqs.filter(r => {
                      if (s.school_name.includes("Hopkins")) return ["Application", "Essays", "Recs requested", "Recs received", "Transcript", "Test scores"].includes(r);
                      if (s.school_name.includes("Maryland")) return false;
                      if (s.school_name.includes("Michigan")) return ["Application", "Essays", "Test scores", "FAFSA", "CSS Profile"].includes(r);
                      return false;
                    });
                  }

                  const mockDoneCount = schoolReqs.length;
                  const currentStatus = s.status || "applying";

                  return (
                    <div key={s.id} className="border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#182229] rounded-lg p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-bold text-[18px] text-[#111] dark:text-white leading-tight">{s.school_name}</h3>
                          <span className="text-[14px] text-[#8696a0] font-medium">EA • {s.deadline ? s.deadline : "2026-11-01"}</span>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto">
                          <span className="text-[14px] font-bold text-[#54656f]">{mockDoneCount}/{Math.max(reqs.length, 8)}</span>

                          <div className="relative">
                            <div
                              className={cn(
                                "bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-full px-3 py-1.5 text-[13px] font-semibold flex items-center gap-1.5 cursor-default",
                                currentStatus === "accepted" ? "text-[#4FA86A]" :
                                  currentStatus === "waitlisted" ? "text-[#CAA25F]" :
                                    currentStatus === "denied" ? "text-[#CA5F5F]" :
                                      currentStatus === "enrolled" ? "text-[#1099A1]" : "text-[#54656f]"
                              )}
                            >
                              {currentStatus === "accepted" ? "Accepted" :
                                currentStatus === "waitlisted" ? "Waitlisted" :
                                  currentStatus === "denied" ? "Denied" :
                                    currentStatus === "enrolled" ? "Enrolled" :
                                      currentStatus === "considering" ? "Considering" :
                                        currentStatus === "applying" ? "Applying" :
                                          currentStatus === "submitted" ? "Submitted" :
                                            "Status..."}
                              {/* <ChevronDown size={14} className="opacity-50 ml-1" /> */}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {/* <div className={`${mockDoneCount > 0 ? 'scale-y-100' : 'scale-y-0'} transition ease-in-out duration-300 origin-left`}>
                        <div className={`h-2.5 w-full bg-[#f8f9fa] dark:bg-[#202c33] rounded-full overflow-hidden border border-[#e9edef] dark:border-[#2a3942]`}>
                          <div className="h-full bg-[#1099A1] rounded-full transition-all duration-500 ease-out" style={{ width: `${(mockDoneCount / Math.max(reqs.length, 8)) * 100}%` }} />
                        </div>
                        <div className={`${mockDoneCount > 0 ? 'h-5' : 'h-0'}`} />
                      </div> */}

                      <div className="w-full flex overflow-x-auto whitespace-nowrap gap-2 pb-1">
                        {standardReqs.map((req, i) => {
                          const isDone = schoolReqs.includes(req);
                          return isDone ? (
                            // <div key={i} className="bg-[#1099A1] text-white px-3.5 py-1.5 rounded-full text-[13px] flex items-center gap-1.5 shadow-sm cursor-default">
                            <div key={i} className="text-[#1099A1] border bg-white px-3.5 py-1.5 rounded-full text-[13px] flex items-center gap-1.5 shadow-none cursor-default">
                              <Check size={14} strokeWidth={3} /> {req}
                            </div>
                          ) : (
                            // <div key={i} className="bg-[#f8f9fa] dark:bg-[#202c33] text-[#8696a0] border border-[#e9edef] dark:border-[#2a3942] px-3.5 py-1.5 rounded-full text-[13px] cursor-default">
                            <div key={i} className="text-[#202c33] dark:bg-[#202c33] bg-[#8696a0]/0 border border-[#e9edef] dark:border-[#2a3942] px-3.5 py-1.5 rounded-full text-[13px] cursor-default">
                              {req}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {activeTab === 'messages' && (
          <ParentMessages />
          // <div className="flex-1 flex flex-col min-h-[500px] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden bg-background relative mt-6">
          //   <div className="absolute inset-0 opacity-[0.4] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-light_04fcacde539c58cca6745483d4858c52.png")' }} />
          //   <div className="relative z-10 flex-1 flex items-center justify-center p-6 text-center">
          //   </div>
          // </div>
        )}
      </div>
    </div>
  );
}

function FeedItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="group flex flex-col sm:flex-row sm:items-center justify-between py-5 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-default">
      <div className="flex items-center gap-4">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 group-hover:bg-[#1099A1] transition-colors" />
        <p className="text-[14px] md:text-[15px] font-medium text-foreground">{text}</p>
      </div>
      <span className="text-[12px] md:text-[13px] text-muted-foreground mt-2 sm:mt-0">{time}</span>
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

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn("pb-3 text-[14px] font-bold capitalize border-b-2 transition-colors whitespace-nowrap",
        active ? "border-white text-white" : "border-transparent text-white/60 hover:text-white hover:border-white/40")}
    >
      {label}
    </button>
  );
}
