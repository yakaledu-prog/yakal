import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SessionList, type SessionListItem } from "@/components/shared/SessionList";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseSessions } from "@/services/studentService";

// The rows are the shared SessionList, so a session reads the same here as it
// will anywhere else. What is specific to a student is the action on the
// right: join the one happening now, ask to move a later one.

type Session = SessionListItem;

export function StudentCourseSessions() {
  const { courseId } = useParams();
  const { user } = useAuth();

  const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);
  const [rescheduleStep, setRescheduleStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["course-sessions", user?.id, courseId],
    queryFn: () => getCourseSessions(user!.id, courseId!),
    enabled: !!user?.id && !!courseId,
  });

  const sessions: SessionListItem[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    startTime: r.start_time,
    durationMinutes: r.duration_minutes,
    status: r.status,
    title: r.subject,
    personName: r.tutor_name,
    personAvatarUrl: r.tutor_avatar,
    note: r.notes,
  }));

  const handleRescheduleClick = (session: Session) => {
    setRescheduleSession(session);
    setRescheduleStep(1);
    setSelectedDate("");
    setSelectedTime("");
    setIsSuccess(false);
  };

  const closeModal = () => {
    setRescheduleSession(null);
  };

  const handleConfirm = () => {
    setIsSuccess(true);
    setTimeout(() => {
      closeModal();
    }, 2000);
  };

  /** Joinable only on the day, which is the only time the link is any use. */
  const isToday = (s: SessionListItem) => {
    const d = new Date(`${s.date}T00:00:00`);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  return (
    <div className="p-4 md:p-8">
      <SessionList
        sessions={sessions}
        isLoading={isLoading}
        emptyText="No sessions booked for this course yet."
        renderAction={(s) =>
          s.status !== "upcoming" ? null : isToday(s) ? (
            <Button className="h-10 px-6 text-[14px] font-semibold">Join</Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => handleRescheduleClick(s)}
              className="h-10 border !border-[#1099A1] px-5 text-[14px] font-medium !text-[#1099A1] hover:!bg-[#1099A1]/10"
            >
              Reschedule
            </Button>
          )
        }
      />

      {rescheduleSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#202c33] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between">
              <h3 className="text-[18px] font-bold text-[#111] dark:text-white">
                {isSuccess ? "Rescheduled Successfully" : "Reschedule Session"}
              </h3>
              <button onClick={closeModal} className="p-2 -mr-2 text-[#54656f] hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 bg-[#1099A1]/10 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} className="text-[#1099A1]" />
                  </div>
                  <p className="font-bold text-[#111] dark:text-white text-[18px] mb-2">All set!</p>
                  <p className="text-[#54656f] dark:text-[#aebac1] text-[14px]">
                    Your session has been moved to {selectedDate} at {selectedTime}.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] mb-1">Current Session:</p>
                    <p className="font-semibold text-[#111] dark:text-white">{rescheduleSession.title} ({rescheduleSession.date} at {rescheduleSession.startTime})</p>
                  </div>

                  {rescheduleStep === 1 && (
                    <div className="space-y-4">
                      <p className="font-bold text-[#111] dark:text-white mb-2">Select a new date</p>
                      <div className="grid grid-cols-2 gap-3">
                        {["Mon, Nov 27", "Tue, Nov 28", "Wed, Nov 29", "Thu, Nov 30"].map(date => (
                          <button
                            key={date}
                            onClick={() => setSelectedDate(date)}
                            className={`p-3 rounded-xl border text-left text-[14px] transition-colors ${selectedDate === date ? 'border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1] font-bold' : 'border-[#e9edef] dark:border-[#2a3942] hover:border-[#1099A1]/50 text-[#111] dark:text-white'}`}
                          >
                            {date}
                          </button>
                        ))}
                      </div>
                      <Button
                        disabled={!selectedDate}
                        onClick={() => setRescheduleStep(2)}
                        className="w-full mt-6 h-12 text-[15px] font-bold"
                      >
                        Continue <ChevronRight size={18} className="ml-1" />
                      </Button>
                    </div>
                  )}

                  {rescheduleStep === 2 && (
                    <div className="space-y-4">
                      <p className="font-bold text-[#111] dark:text-white mb-2">Select a new time</p>
                      <div className="grid grid-cols-2 gap-3">
                        {["9:00 AM", "11:30 AM", "2:00 PM", "4:30 PM"].map(time => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`p-3 rounded-xl border text-center text-[14px] transition-colors ${selectedTime === time ? 'border-[#1099A1] bg-[#1099A1]/5 text-[#1099A1] font-bold' : 'border-[#e9edef] dark:border-[#2a3942] hover:border-[#1099A1]/50 text-[#111] dark:text-white'}`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => setRescheduleStep(1)}
                          className="w-1/3 h-12 text-[15px] font-bold bg-transparent"
                        >
                          Back
                        </Button>
                        <Button
                          disabled={!selectedTime}
                          onClick={handleConfirm}
                          className="flex-1 h-12 text-[15px] font-bold"
                        >
                          Confirm Reschedule
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
