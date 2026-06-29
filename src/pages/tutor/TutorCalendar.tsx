import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight, Clock, Video, MapPin, Layers } from "lucide-react";
import { AvailabilityEditor } from "@/components/feature/AvailabilityEditor";
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
export function TutorCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('month');
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [availabilityData, setAvailabilityData] = useState<number[][] | undefined>();

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

  /*
  const downloadICS = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Yakal//Tutor Calendar//EN\n";
    mockSessions.forEach(s => {
      const [y, m, d] = s.date.split('-');
      const [h, min] = s.startTime.split(':');
      const startDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
      const endDate = new Date(startDate.getTime() + s.duration * 60000);
      const formatICSDate = (dt: Date) => dt.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${s.id}@yakal.com\n`;
      icsContent += `DTSTAMP:${formatICSDate(new Date())}\n`;
      icsContent += `DTSTART:${formatICSDate(startDate)}\n`;
      icsContent += `DTEND:${formatICSDate(endDate)}\n`;
      icsContent += `SUMMARY:${s.subject}\n`;
      icsContent += `DESCRIPTION:Tutor: ${s.tutorName}\n`;
      icsContent += "END:VEVENT\n";
    });
    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'yakal_calendar.ics';
    link.click();
  };
  */

  const renderMonthView = () => {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const getAvailableModesOnDay = (dayIndex: number): number[] => {
      if (!availabilityData) return [];
      const modes = new Set<number>();
      availabilityData.forEach(row => {
        if (row[dayIndex] > 0) modes.add(row[dayIndex]);
      });
      return Array.from(modes);
    };

    const renderModeIcon = (mode: number) => {
      switch (mode) {
        case 1: return <Video size={12} className="text-sky-500" />;
        case 2: return <MapPin size={12} className="text-emerald-500" />;
        case 3: return <Layers size={12} className="text-[#CAA25F]" />;
        default: return null;
      }
    };

    return (
      <div className="border border-[#e9edef] dark:border-[#2a3942] rounded overflow-hidden bg-white dark:bg-[#111b21] mt-4 shadow-sm">
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
                !day ? "bg-[#f9fafb] dark:bg-[#202c33]" : isToday(day) ? "bg-[#CAA25F]/10 text-white" : "bg-white dark:bg-[#111b21] hover:bg-[#f9fafb] dark:hover:bg-[#202c33]",
                index % 7 === 6 ? "border-r-0" : "",
                index >= getDaysArray().length - 7 ? "border-b-0" : ""
              )}
            >
              {day && (
                <>
                  <div className="text-right mb-1 flex justify-between items-start">
                    <div className="flex gap-1 mt-1.5 ml-1 flex-wrap w-[40px]">
                      {getAvailableModesOnDay(index % 7).map(mode => (
                        <div key={mode} className="bg-white dark:bg-[#111b21] rounded shadow-sm p-0.5 border border-[#e9edef] dark:border-[#2a3942]" title={mode === 1 ? 'Online' : mode === 2 ? 'In-Person' : 'Both'}>
                          {renderModeIcon(mode)}
                        </div>
                      ))}
                    </div>
                    <span className={cn(
                      "inline-flex items-center justify-center w-7 h-7 text-[13px] rounded-full",
                      isToday(day) ? "bg-[#CAA25F]/85 text-white font-semibold" : "text-[#54656f] dark:text-[#aebac1]"
                    )}>
                      {day}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {getSessionsForDay(day).map(session => (
                      // <div key={session.id} className="flex items-start gap-1.5 px-2 py-1 rounded bg-[#1099A1]/10 dark:hover:bg-white/5 cursor-pointer">
                      <div key={session.id} className="flex items-start gap-1.5 px-2 py-1 rounded bg-[#1099A1]/10 dark:hover:bg-white/5 cursor-pointer">
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
                <div className={cn("text-[18px] mt-0.5", isToday(day.date, day.month, day.year) ? "text-[#1099A1] font-bold" : "text-[#111] dark:text-white")}>
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
                        <div key={s.id} className="bg-[#1099A1]/10 text-[#1099A1] border border-[#1099A1]/20 rounded px-2 py-1 text-[11px] font-semibold truncate cursor-pointer hover:bg-[#1099A1]/15 transition-colors">
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
                    <div key={s.id} className="bg-[#1099A1]/10 text-[#1099A1] border border-[#1099A1]/20 rounded-md p-3 text-[13px] hover:bg-[#1099A1]/15 transition-colors cursor-pointer w-full max-w-md">
                      <div className="font-bold">{s.subject}</div>
                      <div className="text-[#1099A1]/80 mt-1 flex items-center gap-2 text-[12px]">
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
    <PageWrapper>
      <div className="flex flex-col w-full mx-auto">

        {/* Header Controls */}
        {/* <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-[#111b21] p-2 pl-4 pr-2 rounded-xl shadow-sm border border-[#e9edef] dark:border-[#2a3942]">
          
        </div> */}

        {/* Calendar Grid */}
        <div className="w-full p-4 bg-white dark:bg-[#111b21]">
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <div className="flex bg-[#f0f2f5] dark:bg-[#202c33] p-0.5 rounded-lg">
              <button
                className={cn("px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors", calendarView === 'day' ? 'bg-white dark:bg-[#111b21] text-[#111] dark:text-white shadow-sm' : 'text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white')}
                onClick={() => setCalendarView('day')}
              >
                Daily
              </button>
              <button
                className={cn("px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors", calendarView === 'week' ? 'bg-white dark:bg-[#111b21] text-[#111] dark:text-white shadow-sm' : 'text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white')}
                onClick={() => setCalendarView('week')}
              >
                Weekly
              </button>
              <button
                className={cn("px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors", calendarView === 'month' ? 'bg-white dark:bg-[#111b21] text-[#111] dark:text-white shadow-sm' : 'text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white')}
                onClick={() => setCalendarView('month')}
              >
                Monthly
              </button>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={navigatePrev} className="h-9 w-9 border-none !bg-transparent"><ChevronLeft size={18} /></Button>
              <span className="text-md text-center text-[#111] dark:text-white">{getHeaderText()}</span>
              <Button variant="outline" size="icon" onClick={navigateNext} className="h-9 w-9 border-none !bg-transparent"><ChevronRight size={18} /></Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-[#54656f] dark:text-[#aebac1]" />
              </div>
              <input
                type="text"
                placeholder="Search sessions..."
                className="pl-9 pr-3 py-1.5 h-9 bg-[#f0f2f5] dark:bg-[#202c33] text-[#111] dark:text-white placeholder:text-[#54656f] dark:placeholder:text-[#aebac1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1099A1] w-full sm:w-[200px] md:w-80 text-[14px]"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div> */}

              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="h-9 flex items-center gap-2 bg-[#1099A1] hover:bg-[#0e8a91] text-white"
                  onClick={() => setIsAvailabilityOpen(true)}
                >
                  <Clock size={16} />
                  <span className="text-[13px] font-medium hidden sm:inline">Set Availability</span>
                </Button>
                {/* <Button variant="outline" className="h-9 border-[#e9edef] dark:border-[#2a3942] flex items-center gap-2" title="Download ICS" onClick={downloadICS}>
                  <Download size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                  <span className="text-[13px] font-medium hidden sm:inline">Export</span>
                </Button> */}
                {/* <Button variant="outline" className="h-9 border-[#e9edef] dark:border-[#2a3942] flex items-center gap-2" title="Download CSV" onClick={downloadCSV}>
                <Download size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                <span className="text-[13px] font-medium hidden sm:inline">CSV</span>
              </Button> */}
              </div>
            </div>
          </div>
          {calendarView === 'month' && renderMonthView()}
          {calendarView === 'week' && renderWeekView()}
          {calendarView === 'day' && renderDayView()}
        </div>

      </div>
      <AvailabilityEditor
        isOpen={isAvailabilityOpen}
        onClose={() => setIsAvailabilityOpen(false)}
        onSave={(data) => {
          setAvailabilityData(data);
          // TODO: Save to database
        }}
        initialData={availabilityData}
      />
    </PageWrapper>
  );
}
