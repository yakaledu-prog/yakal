import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Inbox, Archive, Trash2, Clock, Mail, ArrowLeftIcon, ArchiveXIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface Notification {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
  content: React.ReactNode;
  date: string;
  time: string;
  read: boolean;
  archived: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "N-01",
    sender: "Yakal System",
    subject: "New Student Assigned: Amen Worku",
    snippet: "A new student has been assigned to your caseload...",
    content: (
      <div className="space-y-4">
        <p>Hi there,</p>
        <p>A new student, <strong>Amen Worku</strong>, has been successfully assigned to your caseload. They are currently in their junior year and are interested in engineering programs.</p>
        <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-4 rounded-md font-medium text-[14px]">
          <div>Student: Amen Worku</div>
          <div>Grade: 11th Grade</div>
          <div>Track: Engineering</div>
        </div>
        <p>Please reach out to schedule an introductory session with them at your earliest convenience.</p>
        <Button className="mt-2">View Student Profile</Button>
      </div>
    ),
    date: "Oct 15",
    time: "2:30 PM",
    read: false,
    archived: false,
  },
  {
    id: "N-02",
    sender: "Amen Worku",
    subject: "Essay Draft Submitted",
    snippet: "Amen has submitted their Common App essay draft for review...",
    content: (
      <div className="space-y-4">
        <p>Hello,</p>
        <p><strong>Amen Worku</strong> has just submitted the first draft of their Common App personal statement.</p>
        <p>They left a note: <em>"I'm struggling a bit with the conclusion, any feedback would be super helpful!"</em></p>
        <Button variant="outline">Review Essay</Button>
      </div>
    ),
    date: "Oct 14",
    time: "10:15 AM",
    read: false,
    archived: false,
  },
  {
    id: "N-03",
    sender: "Yakal System",
    subject: "Upcoming Deadline: Early Action",
    snippet: "Several of your students have EA deadlines approaching...",
    content: (
      <div className="space-y-4">
        <p>This is an automated reminder that the Early Action deadline for several universities is approaching in 14 days.</p>
        <p>You have <strong>3 students</strong> with pending requirements for Early Action schools.</p>
        <Button variant="outline">View Dashboard</Button>
      </div>
    ),
    date: "Oct 10",
    time: "9:00 AM",
    read: true,
    archived: false,
  },
  {
    id: "N-04",
    sender: "Admin Team",
    subject: "Monthly Counselor Check-in",
    snippet: "Agenda for our upcoming team meeting...",
    content: (
      <div className="space-y-4">
        <p>Hi Team!</p>
        <p>Just sharing the agenda for our monthly counselor alignment meeting this Friday.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Caseload rebalancing</li>
          <li>New financial aid workshop rollout</li>
          <li>Q&A on the updated dashboard</li>
        </ul>
        <p>See you all there!</p>
      </div>
    ),
    date: "Sep 28",
    time: "4:00 PM",
    read: true,
    archived: true,
  }
];

function MinimalStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
    </div>
  );
}

export function CounselorNotifications() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [activeTab, setActiveTab] = useState<"inbox" | "unread" | "archived">("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter Logic
  const filteredList = notifications.filter(n => {
    let matchesTab = false;
    if (activeTab === "inbox") matchesTab = !n.archived;
    if (activeTab === "unread") matchesTab = !n.read && !n.archived;
    if (activeTab === "archived") matchesTab = n.archived;

    return matchesTab;
  });

  const activeNotification = notifications.find(n => n.id === selectedId);

  // Actions
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    markAsRead(id);
  };

  const toggleArchive = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, archived: !n.archived } : n));
    setSelectedId(null);
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    setSelectedId(null);
  };

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 !h-[100vh] bg-background dark:bg-[#111b21] flex flex-col">

        {/* Massive Integrated Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 relative overflow-hidden shrink-0">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="max-w-[1440px] mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Notifications</h1>
                <p className="text-white/80 text-[15px]">Stay updated with your latest alerts</p>
              </div>
              <div className="flex items-center gap-8">
                <MinimalStat label="Unread" value={notifications.filter(n => !n.read && !n.archived).length} />
                <MinimalStat label="Total" value={notifications.filter(n => !n.archived).length} />
              </div>
            </div>
          </div>
        </div>

        {/* Email Layout Container */}
        <div className="flex-1 max-w-[1440px] mx-auto w-full bg-white dark:bg-[#111b21] border-x border-[#e9edef] dark:border-[#2a3942] overflow-hidden flex flex-col md:flex-row min-h-0 shadow-sm">

          {/* Left Pane: List */}
          <div className={cn(
            "w-full md:w-[350px] lg:w-[400px] border-r border-[#e9edef] dark:border-[#2a3942] flex flex-col flex-shrink-0 h-full",
            selectedId !== null ? "hidden md:flex" : "flex"
          )}>
            {/* Tabs */}
            <div className="flex border-b border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] flex-shrink-0">
              <button
                onClick={() => { setActiveTab("inbox"); setSelectedId(null); }}
                className={cn("flex-1 py-3 text-[13px] font-semibold transition-colors border-b-2", activeTab === "inbox" ? "border-primary text-primary" : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
              >
                Inbox
              </button>
              <button
                onClick={() => { setActiveTab("unread"); setSelectedId(null); }}
                className={cn("flex-1 py-3 text-[13px] font-semibold transition-colors border-b-2", activeTab === "unread" ? "border-primary text-primary" : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
              >
                Unread
              </button>
              <button
                onClick={() => { setActiveTab("archived"); setSelectedId(null); }}
                className={cn("flex-1 py-3 text-[13px] font-semibold transition-colors border-b-2", activeTab === "archived" ? "border-primary text-primary" : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
              >
                Archived
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#54656f] dark:text-[#aebac1]">
                  <Inbox size={32} className="mb-3 opacity-50" />
                  <p className="text-[14px]">No {activeTab} notifications.</p>
                </div>
              ) : (
                filteredList.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleSelect(n.id)}
                    className={cn(
                      "p-4 border-b border-[#e9edef] dark:border-[#2a3942] cursor-pointer transition-colors hover:bg-[#f0f2f5] dark:hover:bg-[#202c33]",
                      selectedId === n.id ? "bg-[#e8f4f8] dark:bg-[#1c2e36]" : "",
                      !n.read ? "bg-white dark:bg-[#111b21]" : "bg-[#fafafa] dark:bg-[#152026]"
                    )}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={cn("text-[14px] truncate pr-2", !n.read ? "font-bold text-[#111] dark:text-white" : "font-medium text-[#54656f] dark:text-[#aebac1]")}>
                        {n.sender}
                      </span>
                      <span className={cn("text-[11px] flex-shrink-0", !n.read ? "font-bold text-primary" : "text-[#8696a0]")}>
                        {n.date}
                      </span>
                    </div>
                    <div className={cn("text-[13px] mb-1 truncate", !n.read ? "font-bold text-[#111] dark:text-white" : "text-[#111] dark:text-[#e9edef]")}>
                      {n.subject}
                    </div>
                    <div className="text-[12px] text-[#54656f] dark:text-[#8696a0] truncate">
                      {n.snippet}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Pane: Reading Area */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0 bg-white dark:bg-[#111b21] h-full",
            selectedId === null ? "hidden md:flex" : "flex"
          )}>
            {activeNotification ? (
              <>
                {/* Reading Content */}
                <div className="overflow-y-auto p-6 md:p-8 flex-1">
                  <h2 className="text-2xl font-bold text-[#111] dark:text-white mb-6">
                    {activeNotification.subject}
                  </h2>

                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#e9edef] dark:border-[#2a3942]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                        {activeNotification.sender.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-[14px] text-[#111] dark:text-white">{activeNotification.sender}</div>
                        <div className="text-[12px] text-[#54656f] dark:text-[#8696a0]">to me</div>
                      </div>
                    </div>
                    <div className="text-[12px] text-[#54656f] dark:text-[#8696a0] flex items-center gap-1.5">
                      <Clock size={12} />
                      {activeNotification.date}, {activeNotification.time}
                    </div>
                  </div>

                  <div className="text-[#333] dark:text-[#e9edef] text-[15px] leading-relaxed max-w-3xl">
                    {activeNotification.content}
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="border-t border-[#e9edef] dark:border-[#2a3942] p-4 bg-[#fafafa] dark:bg-[#152026] flex items-center justify-end gap-2 mt-auto flex-shrink-0">
                  <button
                    onClick={() => toggleArchive(activeNotification.id)}
                    className="text-[#54656f] dark:text-[#aebac1] !w-[40px] !h-[40px] !min-w-[40px] !min-h-[40px] !p-0 rounded-md hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] transition-colors flex items-center justify-center shrink-0"
                    title={activeNotification.archived ? "Move to Inbox" : "Archive"}
                  >
                    {activeNotification.archived ? (
                      <Inbox size={18} />
                    ) : (
                      <Archive size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => deleteNotification(activeNotification.id)}
                    className="text-[#54656f] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 !w-[40px] !h-[40px] !min-w-[40px] !min-h-[40px] !p-0 rounded-md transition-colors flex items-center justify-center shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center !h-full min-h-[400px] text-[#54656f] dark:text-[#aebac1]">
                <Mail size={48} className="mb-4 opacity-20" />
                <p className="text-[15px]">Select a notification to read</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </PageWrapper>
  );
}
