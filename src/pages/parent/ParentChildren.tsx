import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import { Search, Loader2, Users, CalendarDays, Clock } from "lucide-react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { dicebearUrl } from "@/utils/avatar";
import { Button } from "@/components/ui/Button";

// Mock children data
const MOCK_CHILDREN = [
  { id: "c1", name: "Brooklyn Student", avatar: "", grade: "10th Grade", sessions: 4 },
  { id: "c2", name: "Austin Student", avatar: "", grade: "8th Grade", sessions: 2 }
];

export function ParentChildren() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const activeId = id ?? MOCK_CHILDREN[0]?.id;
  
  const filtered = useMemo(
    () => MOCK_CHILDREN.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  const activeChild = MOCK_CHILDREN.find(c => c.id === activeId);

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
            {filtered.length === 0 ? (
              <p className="text-center text-[13px] text-muted-foreground py-8 px-4">No matches.</p>
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
          </div>
        </aside>

        {/* Right pane */}
        <section className="flex-1 min-w-0 md:h-full md:overflow-y-auto bg-white dark:bg-[#111b21]">
          {!activeChild ? (
             <div className="h-full flex flex-col items-center justify-center text-center py-20 p-4 md:p-8">
               <Users size={48} className="text-[#aebac1] mb-4" />
               <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No child selected</h3>
             </div>
          ) : (
             <ChildDetailView child={activeChild} />
          )}
        </section>
      </div>
    </PageWrapper>
  );
}

function ChildDetailView({ child }: { child: any }) {
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "assignments" | "messages">("overview");

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
        {activeTab === 'messages' && (
          <div className="flex-1 flex flex-row min-h-[500px] border-t border-[#e9edef] dark:border-[#2a3942] bg-[#efeae2] dark:bg-[#0b141a] relative">
            {/* Tutor Sidebar */}
            <div className="w-[200px] md:w-[250px] shrink-0 border-r border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] flex flex-col">
              <div className="p-2 border-b border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21]">
                <div className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5">
                  <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                  <input type="text" placeholder="Search tutors..." className="bg-transparent border-none outline-none text-[14px] w-full text-[#111] dark:text-[#e9edef] placeholder:text-[#54656f] dark:placeholder:text-[#8696a0]" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <button className="w-full flex items-center gap-3 p-3 bg-[#f0f2f5] dark:bg-[#2a3942] text-left">
                  <img src={dicebearUrl("Dr. Alex")} alt="" className="w-10 h-10 rounded-full shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">Dr. Alex</p>
                    <p className="text-[12px] text-muted-foreground truncate">Physics</p>
                  </div>
                </button>
                <button className="w-full flex items-center gap-3 p-3 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] text-left transition-colors">
                  <img src={dicebearUrl("Sarah J.")} alt="" className="w-10 h-10 rounded-full shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#111] dark:text-white truncate">Sarah J.</p>
                    <p className="text-[12px] text-muted-foreground truncate">Algebra II</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col relative min-w-0">
              {/* Subtle background pattern */}
              <div className="absolute inset-0 opacity-[0.4] dark:opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-light_04fcacde539c58cca6745483d4858c52.png")' }} />

              <header className="relative z-10 h-[60px] bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between px-4 border-b border-[#e9edef] dark:border-[#2a3942] shrink-0">
                <div className="flex items-center gap-3">
                  <img src={dicebearUrl("Dr. Alex")} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <h2 className="font-semibold text-[#111] dark:text-[#e9edef] text-[16px]">Dr. Alex</h2>
                    <p className="text-[13px] text-[#667781] dark:text-[#8696a0]">Chatting with {child.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5" title="Flag Conversation">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                  </button>
                </div>
              </header>

              <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex justify-center mb-6">
                  <span className="bg-white dark:bg-[#182229] shadow-sm text-[#54656f] dark:text-[#8696a0] text-[12.5px] uppercase font-medium px-3 py-1 rounded-lg">
                    Today
                  </span>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#202c33] text-[#111] dark:text-[#e9edef] p-3 rounded-lg rounded-tl-none max-w-[75%] shadow-sm relative">
                    <p className="text-[14px]">Hello {child.name}, don't forget to submit your lab report before 5 PM tomorrow.</p>
                    <span className="text-[10px] text-[#667781] dark:text-[#8696a0] float-right mt-2 ml-4">10:00 AM</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#1099A1] text-white p-3 rounded-lg rounded-br-none max-w-[75%] shadow-sm relative">
                    <p className="text-[14px]">Got it! I will upload it tonight.</p>
                    <span className="text-[10px] text-white/80 float-right mt-2 ml-4">10:05 AM</span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 bg-[#f0f2f5] dark:bg-[#202c33] p-3 px-4 flex items-center gap-2 border-t border-[#e9edef] dark:border-[#2a3942]">
                <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg px-4 py-3 text-[#54656f] dark:text-[#8696a0] text-[13px] sm:text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80">
                   Parents cannot send messages directly in this view.
                </div>
              </div>
            </div>
          </div>
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
