import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { Search, Calendar, Clock, User, Video, FileText, CalendarRange } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorSessions } from "@/services/sessions";

interface Session {
  id: string;
  subject: string;
  student: string;
  date: string;
  time: string;
  duration: string;
  status: "Upcoming" | "Completed" | "Canceled";
  meetingRoomId?: string;
  mode?: number;
}

export function TutorSessions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [filterText, setFilterText] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchSessions = async () => {
      setLoading(true);
      const { data } = await getTutorSessions(user.id);
      if (data) {
        setSessions(data.map((s: any) => {
          const dbStatus = (s.status || 'upcoming').toLowerCase();
          let status: Session['status'] = 'Upcoming';
          if (dbStatus === 'completed') status = 'Completed';
          else if (dbStatus === 'canceled') status = 'Canceled';

          return {
            id: s.id,
            subject: s.subject,
            student: s.student_name || 'Student',
            date: s.date,
            time: s.start_time?.substring(0, 5) || '',
            duration: `${s.duration_minutes} min`,
            status,
            meetingRoomId: s.meeting_room_id,
            mode: s.mode,
          };
        }));
      }
      setLoading(false);
    };
    fetchSessions();
  }, [user]);

  const filteredSessions = sessions.filter(s => {
    const matchesTab = activeTab === "upcoming" ? s.status === "Upcoming" : s.status !== "Upcoming";
    const matchesSearch = s.subject.toLowerCase().includes(filterText.toLowerCase()) || s.student.toLowerCase().includes(filterText.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <PageWrapper>
      <div className="w-full p-8 pb-12 h-full dark:bg-[#111b21]">

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="relative w-full">
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
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#e9edef] dark:border-[#2a3942] mb-6">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={cn(
              "px-6 py-3 text-[14px] font-semibold border-b-2 transition-colors",
              activeTab === "upcoming"
                ? "border-primary text-primary"
                : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
            )}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={cn(
              "px-6 py-3 text-[14px] font-semibold border-b-2 transition-colors",
              activeTab === "past"
                ? "border-primary text-primary"
                : "border-transparent text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
            )}
          >
            Past Sessions
          </button>
        </div>

        {/* Sessions List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md">
            <CalendarRange size={48} className="mx-auto text-[#aebac1] mb-4" />
            <h3 className="text-[18px] font-bold text-[#111] dark:text-white mb-2">No {activeTab} sessions found</h3>
            <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">You don't have any {activeTab} sessions matching your criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map(session => (
              <div key={session.id} className="bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md overflow-hidden hover:shadow-sm transition-shadow p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-[18px] font-bold text-[#111] dark:text-white">
                        {session.subject}
                      </h2>
                      <Badge
                        variant={session.status === 'Completed' ? 'success' : session.status === 'Canceled' ? 'destructive' : 'secondary'}
                        className="rounded-sm text-[11px] font-semibold px-2 py-0.5 uppercase tracking-wider"
                      >
                        {session.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-[13px] text-[#54656f] dark:text-[#aebac1]">
                      <div className="flex items-center gap-1.5">
                        <User size={14} />
                        <span className="font-medium text-[#111] dark:text-[#e9edef]">{session.student}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        <span>{session.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>{session.time} ({session.duration})</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    {session.status === "Upcoming" ? (
                      <>
                        {session.meetingRoomId && (session.mode === 1 || session.mode === 3) && (
                          <Button
                            onClick={() => navigate(`/tutor/meeting/${session.id}`)}
                            className="flex-1 md:flex-none h-9 text-[13px] font-semibold flex items-center gap-2 bg-[#1099A1] hover:bg-[#0d7f86]"
                          >
                            <Video size={14} />
                            Start Meeting
                          </Button>
                        )}
                      </>
                    ) : session.status === "Completed" ? (
                      <>
                        <Button variant="outline" className="flex-1 md:flex-none h-9 text-[13px] font-semibold border-[#e9edef] dark:border-[#2a3942] flex items-center gap-2">
                          <FileText size={14} />
                          View Notes
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" className="w-full md:w-auto h-9 text-[13px] font-semibold border-[#e9edef] dark:border-[#2a3942]">
                        Rebook Session
                      </Button>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </PageWrapper>
  );
}
