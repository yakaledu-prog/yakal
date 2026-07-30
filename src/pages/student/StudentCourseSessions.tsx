import { useState } from "react";
import { Clock, X, ChevronRight, CheckCircle2, Video, CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Session = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
};

const MOCK_SESSIONS: Session[] = [
  { id: "1", title: "Understanding Variables", date: "Friday, Nov 17", time: "4:00 PM", type: "1-on-1" },
  { id: "2", title: "Linear Equations", date: "Monday, Nov 20", time: "6:00 PM", type: "Group" },
  { id: "3", title: "Graphing Functions", date: "Wednesday, Nov 22", time: "3:30 PM", type: "1-on-1" },
  { id: "4", title: "Polynomials Review", date: "Friday, Dec 1", time: "5:00 PM", type: "Group" },
];

export function StudentCourseSessions() {
  const [rescheduleSession, setRescheduleSession] = useState<Session | null>(null);
  const [rescheduleStep, setRescheduleStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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

  return (
    <div className="w-full relative">
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {MOCK_SESSIONS.map((session) => {
          const dateParts = session.date.includes(', ') ? session.date.split(', ')[1].split(' ') : ["", ""];
          const month = dateParts[0];
          const day = dateParts[1];

          return (
            <div key={session.id} className="pb-3 border-b border-[#e9edef] dark:border-[#2a3942] last:border-0">
              <div className="flex flex-col md:flex-row items-center gap-6 p-4">
                {/* Date Column */}
                <div className="flex flex-col items-center justify-center shrink-0 w-[60px]">
                  <span className="text-[24px] font-bold text-[#1099A1] leading-none tracking-tight">{day}</span>
                  <span className="text-[12px] font-bold text-[#1099A1] uppercase tracking-wider mt-1">{month}</span>
                </div>

                {/* Title & Time Column */}
                <div className="flex flex-col justify-center flex-1 min-w-0 py-2 w-full md:w-auto text-center md:text-left border-l-2 border-transparent md:border-[#1099A1] md:pl-6">
                  <h2 className="text-[15px] md:text-[16px] font-medium text-[#111] dark:text-white leading-tight mb-1.5 truncate">
                    {session.title}
                  </h2>
                  <span className="text-[13px] text-[#54656f] dark:text-[#aebac1] font-medium leading-tight flex items-center gap-1.5 md:justify-start justify-center">
                    <Clock size={14} /> {session.time}
                  </span>
                </div>

                {/* Actions Column */}
                <div className="flex items-center justify-center gap-3 w-full md:w-auto shrink-0">
                  <div className="relative inline-flex flex-1 md:flex-none h-[40px] shadow-sm rounded-md">
                    <Button className="flex-1 md:flex-none h-full px-4 text-[14px] font-normal flex items-center justify-center gap-2 bg-[#1099A1] hover:bg-[#0d848b] rounded-l-md rounded-r-none border-0 border-r border-[#0d848b] text-white">
                      <Video size={16} /> Join
                    </Button>
                    <button
                      onClick={() => setOpenDropdownId(openDropdownId === session.id ? null : session.id)}
                      className="h-full px-2 flex items-center justify-center bg-[#1099A1] hover:bg-[#0d848b] text-white rounded-r-md transition-colors"
                    >
                      <ChevronDown size={16} />
                    </button>

                    {openDropdownId === session.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                        <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-md shadow-lg z-50 py-1 overflow-hidden">
                          <button onClick={() => { setOpenDropdownId(null); }} className="w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-[#f8f9fa] dark:hover:bg-[#182329] text-[#1099A1] flex items-center gap-2 transition-colors border-b !border-[#1099A1]/10">
                            <Video size={16} /> Join Meeting
                          </button>
                          <button onClick={() => { setOpenDropdownId(null); handleRescheduleClick(session); }} className="w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-[#f8f9fa] dark:hover:bg-[#182329] text-[#CAA25F] flex items-center gap-2 transition-colors">
                            <CalendarRange size={16} /> Reschedule
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reschedule Modal */}
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
                    <p className="font-semibold text-[#111] dark:text-white">{rescheduleSession.title} ({rescheduleSession.date} at {rescheduleSession.time})</p>
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
