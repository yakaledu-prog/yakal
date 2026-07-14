import { useState, useEffect } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight, Clock, Video, MapPin, Layers } from "lucide-react";
import { AvailabilityEditor } from "@/components/feature/AvailabilityEditor";
import { getTutorAvailability, saveTutorAvailability } from "@/services/availability";
import { getTutorSessionsFull } from "@/services/tutorService";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/utils/cn";

const pad = (n: number) => n.toString().padStart(2, '0');

interface CalSession {
  id: string; subject: string; date: string; startTime: string; duration: number; tutorName: string; status: string;
}

export function TutorCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day'>('week');
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [availabilityData, setAvailabilityData] = useState<number[][] | undefined>();
  const [disabledDays, setDisabledDays] = useState<number[]>([]);
  const [sessions, setSessions] = useState<CalSession[]>([]);

  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    getTutorAvailability(user.id).then((data) => {
      if (data) {
        setAvailabilityData(data.time_grid);
        setDisabledDays(data.disabled_days);
      }
    });
    getTutorSessionsFull(user.id).then((rows) =>
      setSessions(rows.map((s) => ({
        id: s.id,
        subject: s.subject,
        date: s.date,
        startTime: (s.start_time || "").slice(0, 5),
        duration: s.duration_minutes,
        tutorName: s.student_name || "Student",
        status: s.status,
      })))
    );
  }, [user]);

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
    return sessions.filter(s => s.date === targetDateStr);
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

  const renderModeIcon = (mode: number) => {
    switch (mode) {
      case 1: return <Video size={14} />;
      case 2: return <MapPin size={14} />;
      case 3: return <Layers size={14} />;
      default: return null;
    }
  };

  const getModeLabel = (mode: number) => {
    if (mode === 1) return 'Online';
    if (mode === 2) return 'In-Person';
    if (mode === 3) return 'Both';
    return '';
  };

  const getModeClasses = (mode: number) => {
    if (mode === 1) return 'border-[#1099A1]/40 bg-[#1099A1]/5 text-[#1099A1]';
    if (mode === 2) return 'border-[#CAA25F]/40 bg-[#CAA25F]/5 text-[#CAA25F]';
    if (mode === 3) return 'border-muted-foreground/40 bg-muted/10 text-muted-foreground';
    return 'border-border text-muted-foreground';
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
      <div className="border border-border/60 rounded-none overflow-hidden bg-white dark:bg-[#111b21] mt-4">
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
                      <div key={session.id} className="flex items-start gap-1.5 px-2 py-1 rounded-none border-l-2 border-[#1099A1] bg-[#1099A1]/5 dark:hover:bg-white/5 cursor-pointer">
                        <span className="text-[11.5px] text-[#222] dark:text-[#e9edef] truncate font-semibold">
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
      <div className="border border-border/60 rounded-none overflow-x-auto bg-white dark:bg-[#111b21] mt-4">
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
            {hours.map((hour, hIndex) => (
              <div key={hIndex} className="grid grid-cols-8 border-b border-[#e9edef] dark:border-[#2a3942] last:border-b-0">
                <div className="py-3 px-2 text-[12px] text-right text-[#54656f] dark:text-[#aebac1] font-medium border-r border-[#e9edef] dark:border-[#2a3942]">
                  {hour.label}
                </div>
                {weekDays.map((day, dIndex) => {
                  const sessions = getSessionsForDay(day.date, day.month, day.year).filter(s => s.startTime === `${pad(hour.hour)}:00`);
                  const isAvailable = availabilityData && availabilityData[hIndex]?.[dIndex] > 0;
                  const mode = isAvailable ? availabilityData[hIndex][dIndex] : 0;
                  const isDisabled = disabledDays.includes(dIndex);

                  return (
                    <div key={dIndex} className={cn("h-14 border-r border-[#e9edef] dark:border-[#2a3942] last:border-r-0 p-1 flex flex-col gap-1 overflow-hidden", isDisabled && "opacity-40 grayscale bg-[#f0f2f5] dark:bg-[#111b21]/50")}>
                      {mode > 0 && sessions.length === 0 && (
                        <div className={cn("flex-1 rounded-none border flex items-center justify-center pointer-events-none opacity-90", getModeClasses(mode))}>
                          <div className="flex items-center gap-1 text-[10px] font-bold">
                            {renderModeIcon(mode)} <span className="uppercase tracking-wider hidden md:inline">{getModeLabel(mode)}</span>
                          </div>
                        </div>
                      )}
                      {sessions.map(s => (
                        <div key={s.id} className="bg-[#1099A1]/5 text-[#1099A1] border-l-2 border-[#1099A1] rounded-none px-2 py-1 text-[11px] font-bold truncate cursor-pointer hover:bg-[#1099A1]/10 transition-colors">
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

    const getAvailabilityForHour = (hourIndex: number, dayIndex: number) => {
      if (!availabilityData) return 0;
      if (hourIndex < 8 || hourIndex > 20) return 0; // We only support 8AM to 8PM
      return availabilityData[hourIndex - 8]?.[dayIndex] || 0;
    };

    const dayIndex = currentDate.getDay();
    const isDayDisabled = disabledDays.includes(dayIndex);

    return (
      <div className={cn("border border-border/60 rounded-none bg-white dark:bg-[#111b21] mt-4 overflow-hidden", isDayDisabled && "opacity-50 grayscale bg-[#f8f9fa] dark:bg-[#182329] pointer-events-none")}>
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
            const mode = getAvailabilityForHour(hour.hour, dayIndex);
            
            return (
              <div key={idx} className="grid grid-cols-[100px_1fr] border-b border-[#e9edef] dark:border-[#2a3942] last:border-b-0">
                <div className="py-4 px-3 text-[13px] text-right text-[#54656f] dark:border-[#2a3942] font-medium border-r border-[#e9edef] dark:border-[#2a3942]">
                  {hour.label}
                </div>
                <div className="p-2 min-h-[60px] relative">
                  {mode > 0 && sessions.length === 0 && (
                    <div className={cn("absolute inset-2 border rounded-none flex items-center justify-center pointer-events-none", getModeClasses(mode))}>
                      <div className="flex items-center gap-2 text-[13px] font-semibold opacity-90">
                        {renderModeIcon(mode)} <span className="uppercase tracking-wider text-[11px]">{getModeLabel(mode)} Availability</span>
                      </div>
                    </div>
                  )}
                  <div className="relative z-10 flex flex-col gap-2">
                    {sessions.map(s => (
                      <div key={s.id} className="bg-[#1099A1]/5 text-[#1099A1] border-l-2 border-[#1099A1] rounded-none p-3 text-[13px] hover:bg-[#1099A1]/10 transition-colors cursor-pointer w-full max-w-md">
                        <div className="font-bold">{s.subject}</div>
                        <div className="text-[#1099A1]/80 mt-1 flex items-center gap-2 text-[12px] font-medium">
                          <span>{formatTime(s.startTime)}</span>
                          <span>•</span>
                          <span>{s.tutorName}</span>
                        </div>
                      </div>
                    ))}
                  </div>
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
          <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4 mt-2">
            <div className="flex border border-border/60 rounded-none bg-muted/10">
              <button
                className={cn("px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-none transition-colors border-r border-border/60 last:border-r-0", calendarView === 'day' ? 'bg-[#1099A1] text-white' : 'text-muted-foreground hover:bg-muted/50')}
                onClick={() => setCalendarView('day')}
              >
                Daily
              </button>
              <button
                className={cn("px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-none transition-colors border-r border-border/60 last:border-r-0", calendarView === 'week' ? 'bg-[#1099A1] text-white' : 'text-muted-foreground hover:bg-muted/50')}
                onClick={() => setCalendarView('week')}
              >
                Weekly
              </button>
              <button
                className={cn("px-4 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-none transition-colors border-r border-border/60 last:border-r-0", calendarView === 'month' ? 'bg-[#1099A1] text-white' : 'text-muted-foreground hover:bg-muted/50')}
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
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="h-9 flex items-center gap-2 bg-[#1099A1] hover:bg-[#0e8a91] text-white rounded-none font-bold"
                  onClick={() => setIsAvailabilityOpen(true)}
                >
                  <Clock size={16} />
                  <span className="text-[13px] hidden sm:inline">Set Availability</span>
                </Button>
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
        onSave={(data, disabled) => {
          setAvailabilityData(data);
          setDisabledDays(disabled);
          if (user) {
            saveTutorAvailability(user.id, data, disabled);
          }
        }}
        initialData={availabilityData}
        initialDisabledDays={disabledDays}
      />
    </PageWrapper>
  );
}
