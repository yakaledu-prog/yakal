import React, { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageWrapper } from "@/components/ui/PageWrapper";

const mockEvents = [
  { id: "1", title: "AP Calculus AB with Dr. Alex", start: "2023-10-15T16:00:00", end: "2023-10-15T17:00:00", backgroundColor: "hsl(var(--primary) / 0.1)", borderColor: "hsl(var(--primary))", textColor: "hsl(var(--primary))" },
  { id: "2", title: "Physics Lab Review", start: "2023-10-17T17:30:00", end: "2023-10-17T18:30:00", backgroundColor: "hsl(var(--primary) / 0.1)", borderColor: "hsl(var(--primary))", textColor: "hsl(var(--primary))" },
  { id: "3", title: "College Essay Draft Review", start: "2023-10-20T15:00:00", end: "2023-10-20T16:00:00", backgroundColor: "hsl(var(--primary) / 0.1)", borderColor: "hsl(var(--primary))", textColor: "hsl(var(--primary))" },
];

export function StudentCalendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const [viewMode, setViewMode] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('dayGridMonth');
  const [currentDateTitle, setCurrentDateTitle] = useState("October 2023");

  const handleDatesSet = (arg: any) => {
    setCurrentDateTitle(arg.view.title);
  };

  const handlePrev = () => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.prev();
  };

  const handleNext = () => {
    const calendarApi = calendarRef.current?.getApi();
    calendarApi?.next();
  };

  const handleViewChange = (view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(view);
      setViewMode(view);
    }
  };

  return (
    <PageWrapper>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft size={16} /></Button>
          <span className="font-medium px-4 text-lg min-w-[150px] text-center">{currentDateTitle}</span>
          <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight size={16} /></Button>
        </div>
        <div className="flex p-1 bg-muted rounded-md w-fit">
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${viewMode === 'timeGridDay' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            onClick={() => handleViewChange('timeGridDay')}
          >
            Daily
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${viewMode === 'timeGridWeek' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            onClick={() => handleViewChange('timeGridWeek')}
          >
            Weekly
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${viewMode === 'dayGridMonth' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
            onClick={() => handleViewChange('dayGridMonth')}
          >
            Monthly
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <style>{`
            .fc-toolbar.fc-header-toolbar { display: none; }
            .fc-theme-standard td, .fc-theme-standard th { border-color: hsl(var(--border) / 0.6); }
            .fc-day-today { background-color: hsl(var(--primary) / 0.03) !important; }
            .fc-col-header-cell-cushion { padding: 8px 4px !important; font-weight: 500; font-size: 0.875rem; color: hsl(var(--foreground)); }
            .fc-daygrid-day-number { font-size: 0.875rem; font-weight: 400; padding: 4px 8px !important; color: hsl(var(--muted-foreground)); }
            .fc-event { border-radius: 4px; padding: 2px 6px; border-width: 1px; font-weight: 500; border-left-width: 3px; }
            .fc-timegrid-event .fc-event-main { padding: 2px; }
            .fc-daygrid-event { font-size: 0.75rem; }
            .fc-timegrid-axis-cushion, .fc-timegrid-slot-label-cushion { font-size: 0.75rem; color: hsl(var(--muted-foreground)); font-weight: 400; }
          `}</style>
          <div className="h-[700px]">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              initialDate="2023-10-15"
              events={mockEvents}
              headerToolbar={false}
              datesSet={handleDatesSet}
              height="100%"
              dayMaxEvents={true}
              slotMinTime="07:00:00"
              slotMaxTime="22:00:00"
              allDaySlot={false}
              eventTimeFormat={{
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short'
              }}
            />
          </div>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
