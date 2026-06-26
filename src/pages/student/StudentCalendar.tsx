import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const mockEvents = [
  { id: 1, title: "AP Calculus AB", time: "4:00 PM", date: 15, tutor: "Dr. Alex" },
  { id: 2, title: "Physics Lab Review", time: "5:30 PM", date: 17, tutor: "Sarah J." },
  { id: 3, title: "College Essay Draft", time: "3:00 PM", date: 20, tutor: "Prof. Miller" },
];

export function StudentCalendar() {
  const [currentDate] = useState(new Date(2023, 9, 1)); // Mock October 2023
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly' | 'daily'>('monthly');

  const daysInMonth = 31;
  const startDay = 0; // Sunday

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon"><ChevronLeft size={16} /></Button>
          <span className="font-medium px-4 text-lg">October 2023</span>
          <Button variant="outline" size="icon"><ChevronRight size={16} /></Button>
        </div>
        <div className="flex p-1 bg-muted rounded-md w-fit">
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded ${viewMode === 'daily' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setViewMode('daily')}
          >
            Daily
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded ${viewMode === 'weekly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setViewMode('weekly')}
          >
            Weekly
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded ${viewMode === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
            onClick={() => setViewMode('monthly')}
          >
            Monthly
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {viewMode === 'monthly' && (
            <>
              <div className="grid grid-cols-7 border-b text-center text-sm font-medium text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                  <div key={day} className="py-3 border-r last:border-r-0">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-[120px]">
                {Array.from({ length: 35 }).map((_, i) => {
                  const date = i - startDay + 1;
                  const isCurrentMonth = date > 0 && date <= daysInMonth;
                  const events = isCurrentMonth ? mockEvents.filter(e => e.date === date) : [];
                  
                  return (
                    <div key={i} className={`border-r border-b last:border-r-0 p-2 ${!isCurrentMonth ? 'bg-muted/30' : 'bg-card'}`}>
                      {isCurrentMonth && (
                        <>
                          <div className={`text-sm mb-1 ${date === 15 ? 'h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold' : 'text-muted-foreground'}`}>
                            {date}
                          </div>
                          <div className="flex flex-col gap-1">
                            {events.map(event => (
                              <div key={event.id} className="text-xs bg-primary/10 text-primary p-1.5 rounded flex flex-col cursor-pointer hover:bg-primary/20 transition-colors">
                                <span className="font-medium truncate">{event.title}</span>
                                <span className="truncate">{event.time}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {viewMode === 'weekly' && (
            <div className="flex border-t h-[600px] overflow-y-auto">
              <div className="w-16 flex-shrink-0 border-r bg-muted/10">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-16 border-b text-xs text-muted-foreground text-center pt-2">
                    {i + 8}:00 AM
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, dIdx) => (
                  <div key={day} className="border-r last:border-r-0 relative">
                    <div className="sticky top-0 bg-card border-b py-2 text-center text-sm font-medium z-10 shadow-sm">{day} 1{dIdx+1}</div>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="h-16 border-b border-border/50" />
                    ))}
                    {dIdx === 2 && (
                      <div className="absolute top-[32px] left-1 right-1 bg-primary/20 border border-primary text-primary text-xs rounded p-1.5 z-0 shadow-sm">
                        <div className="font-semibold">Physics Lab</div>
                        <div>5:30 PM</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'daily' && (
            <div className="flex border-t h-[600px] overflow-y-auto relative">
              <div className="w-16 flex-shrink-0 border-r bg-muted/10">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="h-20 border-b text-xs text-muted-foreground text-center pt-2">
                    {i + 8}:00
                  </div>
                ))}
              </div>
              <div className="flex-1 relative">
                <div className="sticky top-0 bg-card border-b py-3 text-center font-medium z-10 shadow-sm">
                  Tuesday, October 17, 2023
                </div>
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="h-20 border-b border-border/50" />
                ))}
                
                <div className="absolute top-[190px] left-4 right-4 bg-primary/10 border-l-4 border-l-primary text-foreground rounded-r p-3 z-0 shadow-sm">
                  <div className="font-semibold text-primary">Physics Lab Review</div>
                  <div className="text-sm text-muted-foreground">5:30 PM - 6:30 PM with Sarah J.</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
