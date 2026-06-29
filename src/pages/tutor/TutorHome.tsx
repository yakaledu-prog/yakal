import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChartCard } from "@/components/feature/ChartCard";
import { studentService } from "@/services/studentService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Video, Clock, BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { cn } from "@/utils/cn";

// Mock chart data
const studyHoursData = [
  { name: 'Mon', hours: 2 },
  { name: 'Tue', hours: 1.5 },
  { name: 'Wed', hours: 3 },
  { name: 'Thu', hours: 2 },
  { name: 'Fri', hours: 4 },
  { name: 'Sat', hours: 1 },
  { name: 'Sun', hours: 2.5 },
];

export function TutorHome() {
  const [data, setData] = useState<any>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(true);
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false);
  const { sidebarOpen } = useOutletContext<{ sidebarOpen: boolean }>();

  useEffect(() => {
    studentService.getDashboardSummary().then(setData);
  }, []);

  if (!data) {
    return (
      <PageWrapper>
        <div className="space-y-6 p-4">
          <Skeleton className="h-[200px] w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-[300px] col-span-2" />
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="space-y-6 p-5 dark:bg-[#111b21]">
        {/* Welcome Banner */}
        <div className="rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-8 flex flex-col sm:flex-row items-center justify-between shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, Brooklyn!</h1>
            <p className="text-primary-foreground/80">
              You have a calculus session coming up today. Keep up the great work on your learning streak.
            </p>
          </div>
          <div className="relative z-10 mt-auto -mb-1">
            <Button variant="secondary" size="lg" className="gap-2 dark:bg-[#111b21]">
              Continue Learning <ChevronRight size={18} />
            </Button>
          </div>
          {/* Decorative background shapes */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute right-20 -bottom-20 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Next Session (Priority Info) */}
          <div className="lg:col-span-2 space-y-6 dark:bg-[#111b21]">
            <Card className="overflow-hidden border-0 shadow-md dark:bg-[#111b21]">
              <div className="flex flex-col sm:flex-row h-full">
                <div className="w-full sm:w-2/5 h-48 sm:h-auto relative">
                  <img
                    src="/images/course_math_1782503062614.png"
                    alt="Calculus"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <Badge className="bg-primary/90 text-white backdrop-blur-sm border-0">Next Up</Badge>
                  </div>
                </div>
                <div className="p-6 flex flex-col justify-between flex-1 bg-card  dark:bg-[#182329]">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{data.nextSession.subject}</h3>
                    <p className="text-muted-foreground flex items-center gap-2 mb-4">
                      <Clock size={16} /> {data.nextSession.date} with {data.nextSession.tutor}
                    </p>
                    <p className="text-sm">
                      Today we will cover derivatives and the chain rule. Please review Chapter 4 before joining.
                    </p>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <Button className="flex-1 gap-2 bg-[#f26b4d] hover:bg-[#d8583d] text-white">
                      <Video size={18} /> Join Meeting
                    </Button>
                    <Button variant="outline" className="flex-1">View Details</Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Progress Chart */}
            <ChartCard
              title="Weekly Study Hours"
              data={studyHoursData}
              dataKey="hours"
              xAxisKey="name"
            />
          </div>

          {/* Sidebar Widgets */}
          <div className="space-y-6">

            <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Video className="text-primary" size={20} /> Next Session
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-6 w-6"><ChevronLeft size={12} /></Button>
                  <Button variant="outline" size="icon" className="h-6 w-6"><ChevronRight size={12} /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div>
                    <h4 className="font-semibold text-base mb-1">Physics Lab Review</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <Clock size={14} className="text-primary/70" />
                      <span>Today, 5:30 PM</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">SJ</div>
                      <span className="font-medium text-foreground">Sarah J.</span>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" className="w-full gap-2 mt-1 text-muted-foreground hover:text-foreground border border-border/50">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="text-primary" size={20} /> Homework Due
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">Derivatives Practice</p>
                    <p className="text-xs text-muted-foreground">Calculus</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] whitespace-nowrap">Tomorrow</Badge>
                </div>
                <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">Kinematics Lab Report</p>
                    <p className="text-xs text-muted-foreground">Physics</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">Friday</Badge>
                </div>
                <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">Read Chapter 4</p>
                    <p className="text-xs text-muted-foreground">Calculus</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Today</Badge>
                </div>
                <Button variant="secondary" className="w-full mt-2 text-xs text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground transition-colors border-none bg-muted/50">View All Tasks</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {showAnnouncement && data.announcements.length > 0 && (
          <div
            className={cn(
              "fixed bottom-0 right-0 z-40 transition-all duration-300 left-0",
              sidebarOpen ? "md:left-60" : "md:left-20"
            )}
          >
            <div className="bg-teal-50/95 dark:bg-teal-950/95 backdrop-blur border-t border-teal-200 dark:border-teal-900/50 px-4 py-1 text-xs font-medium flex items-center justify-between text-teal-800 dark:text-teal-200">
              <div className="flex items-center gap-2">
                <span className="font-bold">Notice:</span>
                <span className="truncate">{data.announcements[0].title} on {data.announcements[0].date}. Check your inbox for details.</span>
              </div>
              <button
                onClick={() => setShowAnnouncementDialog(true)}
                className="p-1 hover:bg-teal-200/50 dark:hover:bg-teal-900/50 rounded-md transition-colors shrink-0"
                aria-label="Close announcement"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {showAnnouncementDialog && data.announcements.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <Card className="w-full max-w-md shadow-lg border-muted animate-in fade-in zoom-in-95 duration-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex justify-between items-start text-lg">
                  <span>{data.announcements[0].title}</span>
                  <button
                    onClick={() => setShowAnnouncementDialog(false)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                  >
                    <X size={16} />
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                  <p className="font-medium text-foreground mb-1">Date: {data.announcements[0].date}</p>
                  <p>Please make sure to check your inbox for the registration link and further details regarding this upcoming seminar. Preparation materials will be sent out 24 hours prior.</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAnnouncementDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowAnnouncement(false);
                      setShowAnnouncementDialog(false);
                    }}
                  >
                    Mark as Read
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
