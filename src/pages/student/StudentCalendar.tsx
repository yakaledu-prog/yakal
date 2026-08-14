import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

// --- Mock Data ---
const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();
const pad = (n: number) => n.toString().padStart(2, '0');
const dateStr = (d: number) => `${currentYear}-${pad(currentMonth + 1)}-${pad(d)}`;

const mockSessions = [
  { id: "1", subject: "AP Calculus AB", date: dateStr(15), startTime: "16:00", duration: 60, tutorName: "Dr. Alex", status: "Upcoming" },
  { id: "2", subject: "Physics Lab Review", date: dateStr(17), startTime: "17:30", duration: 60, tutorName: "Dr. Alex", status: "Upcoming" },
  { id: "3", subject: "College Essay Draft", date: dateStr(20), startTime: "15:00", duration: 60, tutorName: "Jane Doe", status: "Upcoming" },
];
export function StudentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const date = currentDate.getDate();
  const monthString = monthNames[month];

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const getDaysArray = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const daysArray: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) daysArray.push(null);
    for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);
    // Fill remainder for full weeks
    while (daysArray.length % 7 !== 0) daysArray.push(null);
    return daysArray;
  };

  const getWeekDays = () => {
    const weekDays = [];
    const currentDay = currentDate.getDay();
    const currentDateNum = currentDate.getDate();
    const firstDayOfWeek = new Date(currentDate);
    firstDayOfWeek.setDate(currentDateNum - currentDay);

    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDayOfWeek);
      d.setDate(firstDayOfWeek.getDate() + i);
      weekDays.push({ date: d.getDate(), month: d.getMonth(), year: d.getFullYear(), fullDate: d });
    }
    return weekDays;
  };

  const getDayHours = () => {
    const hours = [];
    for (let i = 8; i <= 20; i++) {
      hours.push({ hour: i, label: i > 12 ? `${i - 12} PM` : i === 12 ? '12 PM' : `${i} AM` });
    }
    return hours;
  };

  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else if (calendarView === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (calendarView === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else if (calendarView === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const getSessionsForDay = (d: number | null, checkMonth = month, checkYear = year) => {
    if (!d) return [];
    const targetDateStr = `${checkYear}-${pad(checkMonth + 1)}-${pad(d)}`;
    return mockSessions.filter(s => s.date === targetDateStr);
  };

  const isToday = (d: number | null, checkMonth = month, checkYear = year) => {
    if (!d) return false;
    const t = new Date();
    return d === t.getDate() && checkMonth === t.getMonth() && checkYear === t.getFullYear();
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    return `${hour % 12 || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`;
  };

  const getHeaderText = () => {
    if (calendarView === 'month') return `${monthString} ${year}`;
    if (calendarView === 'week') {
      const weekDays = getWeekDays();
      const first = weekDays[0];
      const last = weekDays[6];
      if (first.month !== last.month) return `${monthNames[first.month]} ${first.date} - ${monthNames[last.month]} ${last.date}, ${last.year}`;
      return `${monthNames[first.month]} ${first.date} - ${last.date}, ${first.year}`;
    }
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${weekdays[currentDate.getDay()]}, ${monthString} ${date}, ${year}`;
  };

  const renderMonthView = () => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="border border-[#e9edef] dark:border-[#2a3942] rounded overflow-hidden bg-white dark:bg-[#111b21] shadow-sm">
        <div className="grid grid-cols-7 border-b border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
          {weekdays.map(day => (
            <div key={day} className="text-center text-[13px] font-medium text-[#111] dark:text-[#e9edef] py-3 border-r border-[#e9edef] dark:border-[#2a3942] last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {getDaysArray().map((day, index) => (
            <div
              key={index}
              className={cn(
                "min-h-[140px] p-2 border-r border-b border-[#e9edef] dark:border-[#2a3942] relative group",
                !day ? "bg-[#f9fafb] dark:bg-[#202c33]" : isToday(day) ? "bg-secondary/10 text-white" : "bg-white dark:bg-[#111b21] hover:bg-[#f9fafb] dark:hover:bg-[#202c33]",
                index % 7 === 6 ? "border-r-0" : "",
                index >= getDaysArray().length - 7 ? "border-b-0" : ""
              )}
            >
              {day && (
                <>
                  <div className="text-right mb-1">
                    <span className={cn(
                      "inline-flex items-center justify-center w-7 h-7 text-[13px] rounded-full",
                      isToday(day) ? "bg-secondary/85 text-white font-semibold" : "text-[#54656f] dark:text-[#aebac1]"
                    )}>
                      {day}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {getSessionsForDay(day).map(session => (
                      // <div key={session.id} className="flex items-start gap-1.5 px-2 py-1 rounded bg-primary/10 dark:hover:bg-white/5 cursor-pointer">
                      <div key={session.id} className="flex items-start gap-1.5 px-2 py-1 rounded bg-primary/10 dark:hover:bg-white/5 cursor-pointer">
                        <span className="text-[11.5px] text-[#222] dark:text-[#e9edef] truncate">
                          {formatTime(session.startTime)} {session.subject}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();
    const hours = getDayHours();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="border border-[#e9edef] dark:border-[#2a3942] rounded overflow-x-auto bg-white dark:bg-[#111b21] mt-4 shadow-sm">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-8 border-b border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
            <div className="border-r border-[#e9edef] dark:border-[#2a3942]"></div>
            {weekDays.map((day, index) => (
              <div key={index} className="text-center py-3 border-r border-[#e9edef] dark:border-[#2a3942] last:border-r-0">
                <div className="text-[12px] text-[#54656f] dark:text-[#aebac1] font-medium uppercase tracking-wider">{weekdays[index]}</div>
                <div className={cn("text-[18px] mt-0.5", isToday(day.date, day.month, day.year) ? "text-primary font-bold" : "text-[#111] dark:text-white")}>
                  {day.date}
                </div>
              </div>
            ))}
          </div>
          <div className="relative">
            {hours.map((hour, idx) => (
              <div key={idx} className="grid grid-cols-8 border-b border-[#e9edef] dark:border-[#2a3942] last:border-b-0">
                <div className="py-3 px-2 text-[12px] text-right text-[#54656f] dark:text-[#aebac1] font-medium border-r border-[#e9edef] dark:border-[#2a3942]">
                  {hour.label}
                </div>
                {weekDays.map((day, dayIdx) => {
                  const timeStr = `${pad(hour.hour)}:00`;
                  const sessions = getSessionsForDay(day.date, day.month, day.year).filter(s => s.startTime === timeStr);

                  return (
                    <div key={dayIdx} className="h-14 border-r border-[#e9edef] dark:border-[#2a3942] last:border-r-0 p-1">
                      {sessions.map(s => (
                        <div key={s.id} className="bg-primary/10 text-primary border border-primary/20 rounded px-2 py-1 text-[11px] font-semibold truncate cursor-pointer hover:bg-primary/15 transition-colors">
                          {formatTime(s.startTime)} {s.subject}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = getDayHours();
    return (
      <div className="border border-[#e9edef] dark:border-[#2a3942] rounded bg-white dark:bg-[#111b21] mt-4 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[100px_1fr] bg-[#f8f9fa] dark:bg-[#182329] border-b border-[#e9edef] dark:border-[#2a3942]">
          <div className="p-3 border-r border-[#e9edef] dark:border-[#2a3942]"></div>
          <div className="p-3 text-[15px] font-medium text-[#111] dark:text-white">
            {getHeaderText()}
          </div>
        </div>
        <div>
          {hours.map((hour, idx) => {
            const timeStr = `${pad(hour.hour)}:00`;
            const sessions = getSessionsForDay(date).filter(s => s.startTime === timeStr);
            return (
              <div key={idx} className="grid grid-cols-[100px_1fr] border-b border-[#e9edef] dark:border-[#2a3942] last:border-b-0">
                <div className="py-4 px-3 text-[13px] text-right text-[#54656f] dark:text-[#aebac1] font-medium border-r border-[#e9edef] dark:border-[#2a3942]">
                  {hour.label}
                </div>
                <div className="p-2 min-h-[60px]">
                  {sessions.map(s => (
                    <div key={s.id} className="bg-primary/10 text-primary border border-primary/20 rounded-md p-3 text-[13px] hover:bg-primary/15 transition-colors cursor-pointer w-full max-w-md">
                      <div className="font-bold">{s.subject}</div>
                      <div className="text-primary/80 mt-1 flex items-center gap-2 text-[12px]">
                        <span>{formatTime(s.startTime)}</span>
                        <span>•</span>
                        <span>{s.tutorName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <PageWrapper className="!p-0">
      <div className="flex flex-col w-full min-h-screen bg-background dark:bg-[#111b21]">
        {/* Massive Integrated Header */}
        <div className="bg-primary text-white pt-6 md:pt-10 px-6 md:px-2 md:pl-10 pb-6 md:pb-8 relative overflow-hidden shrink-0">
          {/* Subtle Background Texture/Graph */}
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="flex flex-col md:flex-row md:items-center justify-center gap-6 md:justify-between w-full">
            <div className="space-y-1 text-center md:text-left">
              <h4 className="text-3xl md:text-4xl font-bold tracking-tight">Your Calendar</h4>
              <p className="text-white/70 text-[14px] pt-1 hidden md:block">
                View your upcoming classes and sessions
              </p>
            </div>

            <div className="max-w-fit mx-auto flex items-center gap-1 text-white">
              <Button variant="outline" size="icon" onClick={navigatePrev} className="h-9 w-9 border-none !bg-transparent text-white hover:bg-white/10 hover:text-white"><ChevronLeft size={18} /></Button>
              <span className="text-md text-center font-medium min-w-[140px]">{getHeaderText()}</span>
              <Button variant="outline" size="icon" onClick={navigateNext} className="h-9 w-9 border-none !bg-transparent text-white hover:bg-white/10 hover:text-white"><ChevronRight size={18} /></Button>
            </div>

            <div className="w-fit mx-auto flex border border-white/30 rounded-lg overflow-hidden bg-black/0">
              <button
                className={cn("px-4 py-2 text-[12px] font-bold uppercase tracking-wider transition ease-in-out duration-500 border-r border-white/30 last:border-r-0", calendarView === 'day' ? 'bg-white/90 text-primary' : 'text-white hover:bg-white/20')}
                onClick={() => setCalendarView('day')}
              >
                Daily
              </button>
              <button
                className={cn("px-4 py-2 text-[12px] font-bold uppercase tracking-wider transition ease-in-out duration-500 border-r border-white/30 last:border-r-0", calendarView === 'week' ? 'bg-white/90 text-primary' : 'text-white hover:bg-white/20')}
                onClick={() => setCalendarView('week')}
              >
                Weekly
              </button>
              <button
                className={cn("px-4 py-2 text-[12px] font-bold uppercase tracking-wider transition ease-in-out duration-500 border-r border-white/30 last:border-r-0", calendarView === 'month' ? 'bg-white/90 text-primary' : 'text-white hover:bg-white/20')}
                onClick={() => setCalendarView('month')}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        <div className="w-full mx-auto">
          <div className="w-full bg-white dark:bg-[#111b21]">
            {calendarView === 'month' && renderMonthView()}
            {calendarView === 'week' && renderWeekView()}
            {calendarView === 'day' && renderDayView()}
          </div>
        </div>

      </div>
    </PageWrapper>
  );
}
