import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Inbox, Archive, Trash2, Clock, Mail, ArrowLeftIcon, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";

function MinimalStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-white/70 text-[11px] font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-2xl font-medium">{value}</p>
    </div>
  );
}

export function ParentNotifications() {
  const [notifications, setNotifications] = useState([
    {
      id: "n1",
      sender: "Yakal System",
      subject: "Feature Unlock Request",
      snippet: "Brooklyn has requested access to College Admissions.",
      childName: "Brooklyn",
      time: "10:00 AM",
      date: "Today",
      read: false,
      archived: false,
      status: "pending"
    }
  ]);
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

  const handleApprove = (id: string) => {
    toast.success("Access granted! The service has been unlocked for your child.");
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "approved" } : n));
  };

  const handleDeny = (id: string) => {
    toast.error("Request denied.");
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: "denied" } : n));
  };

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] flex flex-col">
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
                <p className="text-white/80 text-[15px]">Manage your alerts and requests from your children.</p>
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
            "w-full md:w-[350px] lg:w-[400px] border-r border-[#e9edef] dark:border-[#2a3942] flex flex-col flex-shrink-0",
            selectedId !== null ? "hidden md:flex" : "flex"
          )}>
            {/* Tabs */}
            <div className="flex border-b border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] flex-shrink-0">
              <button
                onClick={() => { setActiveTab("inbox"); setSelectedId(null); }}
                className={cn("flex-1 py-3 text-[13px] font-semibold transition-colors border-b-2", activeTab === "inbox" ? "border-[#1099A1] text-[#1099A1]" : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
              >
                Inbox
              </button>
              <button
                onClick={() => { setActiveTab("unread"); setSelectedId(null); }}
                className={cn("flex-1 py-3 text-[13px] font-semibold transition-colors border-b-2", activeTab === "unread" ? "border-[#1099A1] text-[#1099A1]" : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
              >
                Unread
              </button>
              <button
                onClick={() => { setActiveTab("archived"); setSelectedId(null); }}
                className={cn("flex-1 py-3 text-[13px] font-semibold transition-colors border-b-2", activeTab === "archived" ? "border-[#1099A1] text-[#1099A1]" : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white")}
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
                      <span className={cn("text-[11px] flex-shrink-0", !n.read ? "font-bold text-[#1099A1]" : "text-[#8696a0]")}>
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
            "flex-1 flex flex-col min-w-0 bg-white dark:bg-[#111b21]",
            selectedId === null ? "hidden md:flex" : "flex"
          )}>
            {activeNotification ? (
              <>
                {/* Reading Toolbar */}
                <div className="h-14 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between px-4 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="md:hidden text-[#54656f] dark:text-[#aebac1] -ml-2">
                    <ArrowLeftIcon size={18} />
                  </Button>

                  <div className="flex items-center gap-2 ml-auto">
                    <Button variant="ghost" size="icon" title={activeNotification.archived ? "Unarchive" : "Archive"} onClick={() => toggleArchive(activeNotification.id)} className="text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33]">
                      <Archive size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteNotification(activeNotification.id)} className="text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#202c33] hover:text-red-500">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10">
                  <h2 className="text-2xl font-bold text-[#111] dark:text-white mb-6">
                    {activeNotification.subject}
                  </h2>
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#e9edef] dark:border-[#2a3942]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1099A1]/10 text-[#1099A1] flex items-center justify-center font-bold text-lg">
                        {activeNotification.sender[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-[14px] text-[#111] dark:text-white">{activeNotification.sender}</div>
                        <div className="text-[12px] text-[#54656f] dark:text-[#aebac1]">to me</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[12px] text-[#54656f] dark:text-[#aebac1]">
                      <Clock size={14} />
                      {activeNotification.date}, {activeNotification.time}
                    </div>
                  </div>

                  <div className="text-[15px] leading-relaxed text-[#111] dark:text-[#e9edef]">
                    <div className="space-y-4">
                      <p>Hi there,</p>
                      <p>{activeNotification.snippet}</p>
                      <div className="bg-[#f0f2f5] dark:bg-[#202c33] p-5 rounded-xl font-medium text-[14px] flex flex-col gap-4 mt-6 border border-[#e9edef] dark:border-[#2a3942]">
                        <div className="flex items-center justify-between">
                           <div>
                             <p className="text-[#54656f] dark:text-[#aebac1] text-[12px] uppercase tracking-wider mb-1">Service</p>
                             <p>College Admissions</p>
                           </div>
                           <div className="text-right">
                             <p className="text-[#54656f] dark:text-[#aebac1] text-[12px] uppercase tracking-wider mb-1">Status</p>
                             <p className={cn("capitalize", activeNotification.status === "approved" ? "text-emerald-600" : activeNotification.status === "denied" ? "text-red-600" : "")}>{activeNotification.status}</p>
                           </div>
                        </div>
                        {activeNotification.status === "pending" && (
                          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-[#e9edef] dark:border-[#2a3942]">
                            <button 
                              onClick={() => handleDeny(activeNotification.id)}
                              className="w-full sm:w-auto flex-1 py-2.5 border border-[#e9edef] dark:border-[#2a3942] rounded-lg font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                            >
                              <X size={16} /> Deny
                            </button>
                            <button 
                              onClick={() => handleApprove(activeNotification.id)}
                              className="w-full sm:w-auto flex-1 py-2.5 bg-[#111] dark:bg-white text-white dark:text-[#111] rounded-lg font-semibold hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
                            >
                              <Check size={16} /> Give Access
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#54656f] dark:text-[#aebac1]">
                <Mail size={48} className="mb-4 opacity-20" />
                <p className="text-[15px] font-medium mb-1">Select a notification</p>
                <p className="text-[13px]">Choose an item from the list to read it</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
