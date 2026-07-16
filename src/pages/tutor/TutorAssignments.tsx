import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { Plus, BookOpen, ExternalLink, CalendarClock, School } from "lucide-react";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import { exchangeGoogleToken, fetchCourses, fetchCourseWork } from "@/services/classroomService";
import { GoogleClassroom } from "@/components/icons/GoogleClassroom";

function formatDue(dueDate: any, dueTime: any) {
  if (!dueDate) return "No due date";
  const { year, month, day } = dueDate;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  if (dueTime) {
    const { hours = 0, minutes = 0 } = dueTime;
    return new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  }
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TutorAssignments() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(localStorage.getItem('google_classroom_token'));
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);

  // Authenticate with Google (Auth Code Flow for Refresh Token)
  const login = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/classroom.rosters.readonly',
    onSuccess: async ({ code }) => {
      try {
        const data = await exchangeGoogleToken(code);
        setToken(data.access_token);
        localStorage.setItem('google_classroom_token', data.access_token);
        toast.success("Successfully connected to Google Classroom");
      } catch (err: any) {
        toast.error(err.message || "Failed to connect to Google");
      }
    },
    onError: () => toast.error('Google login failed'),
  });

  const { data: coursesData, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['classroom-courses', token],
    queryFn: async () => {
      try {
        return await fetchCourses(token!);
      } catch (err) {
        toast.error("Failed to load courses. Please reconnect.");
        setToken(null);
        localStorage.removeItem('google_classroom_token');
        throw err;
      }
    },
    enabled: !!token,
    retry: false,
  });

  const courses = coursesData?.courses || [];

  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0]);
    }
  }, [courses, selectedCourse]);

  const { data: assignmentsData, isLoading: isLoadingCourseWork } = useQuery({
    queryKey: ['classroom-coursework', token, selectedCourse?.id],
    queryFn: () => fetchCourseWork(token!, selectedCourse!.id),
    enabled: !!token && !!selectedCourse?.id,
    retry: false,
  });

  const assignments = assignmentsData?.courseWork || [];
  const loading = isLoadingCourses || isLoadingCourseWork;

  if (!token) {
    return (
      <PageWrapper>
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
                  <h1 className="text-3xl font-bold tracking-tight mb-2">Assignments</h1>
                  <p className="text-white/80 text-[15px]">Powered by Google Classroom</p>
                </div>
              </div>
            </div>
          </div>

          {/* Connect Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <GoogleClassroom className="w-16 h-16 mb-6" />
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">Connect Google Classroom</h2>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              Manage your assignments, grades, and student submissions directly through Google Classroom without leaving Yakal.
            </p>
            <Button onClick={() => login()} size="lg" className="bg-[#1099A1] hover:bg-[#0d848b] text-white">
              Connect Classroom
            </Button>
          </div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="flex-1 min-h-screen bg-background dark:bg-[#111b21] pb-12">
        {/* Massive Integrated Header */}
        <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0 md:pb-0 relative overflow-hidden shrink-0">
          {/* Subtle Background Texture/Graph */}
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="max-w-[1440px] mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Assignments</h1>
                <p className="text-white/80 text-[15px]">Powered by Google Classroom</p>
              </div>
            </div>

            {/* Course Tabs */}
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar border-b border-white/20">
              {courses.map((course: any) => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className={`pb-4 px-1 text-[15px] font-medium whitespace-nowrap transition-colors relative ${selectedCourse?.id === course.id ? "text-white" : "text-white/60 hover:text-white/80"
                    }`}
                >
                  {course.name}
                  {selectedCourse?.id === course.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />
                  )}
                </button>
              ))}
              {courses.length > 0 && (
                <a href="https://classroom.google.com/h" target="_blank" rel="noreferrer" className="pb-4 px-2 text-white/60 hover:text-white transition-colors flex items-center" title="Create new course in Google Classroom">
                  <Plus size={18} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Content Below Banner */}
        <div className="max-w-[1440px] mx-auto p-6 md:p-10">

          {courses.length === 0 ? (
            <div className="text-center py-16 bg-[#f8f9fa] dark:bg-[#182329] rounded-2xl border border-transparent dark:border-border/20">
              <School size={48} className="mx-auto text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Google Classroom Courses Found</h3>
              <p className="text-[14px] text-muted-foreground mb-6 max-w-md mx-auto">
                You need to have at least one active course in Google Classroom to manage assignments here.
              </p>
              <a href="https://classroom.google.com" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-md bg-[#1099A1] px-6 text-sm font-medium text-primary-foreground hover:bg-[#0d848b] transition-colors">
                Go to Google Classroom to Create a Course <ExternalLink size={14} className="ml-2" />
              </a>
            </div>
          ) : (
            <>
              {loading ? (
                <div className="space-y-4 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
                  ))}
                </div>
              ) : assignments.length === 0 ? (
                <p className="text-center text-[14px] text-muted-foreground py-12">No assignments found for this class.</p>
              ) : (
                <div className="space-y-0">
                  {assignments.map((a: any) => (
                    <div key={a.id} onClick={() => navigate(`/tutor/assignments/${a.id}`, { state: { courseId: selectedCourse?.id } })} className="flex flex-col sm:flex-row sm:items-center justify-between py-5 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-pointer group">
                      <div className="flex items-start sm:items-center gap-6 min-w-0">
                        <div className="hidden sm:flex shrink-0 w-12 h-12 rounded-full bg-[#1099A1]/10 items-center justify-center text-[#1099A1]">
                          <BookOpen size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[16px] text-foreground truncate group-hover:text-[#1099A1] transition-colors">{a.title}</h3>
                          <div className="flex items-center gap-4 text-[13px] text-muted-foreground mt-1">
                            <span className="flex items-center gap-1.5"><CalendarClock size={14} /> Due: {formatDue(a.dueDate, a.dueTime)}</span>
                            <span>{a.maxPoints ? `${a.maxPoints} Points` : 'Ungraded'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 sm:mt-0 flex items-center gap-3 shrink-0">
                        <a href={a.alternateLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1099A1] hover:underline px-3 py-1.5 bg-[#1099A1]/10 rounded-md">
                          Classroom <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                  
                  {/* Create Assignment Link */}
                  {selectedCourse && (
                    <a
                      href={selectedCourse.alternateLink || "https://classroom.google.com/h"}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 flex items-center gap-4 rounded-xl border-2 border-dashed border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] p-5 text-left hover:border-[#1099A1]/50 hover:bg-[#1099A1]/[0.02] transition-colors group"
                    >
                      <div className="h-11 w-11 rounded-xl bg-[#f0f1f2] group-hover:bg-[#1099A1]/10 text-[#2a3942]/70  group-hover:text-[#1099A1] flex items-center justify-center shrink-0 transition-colors">
                        <ExternalLink size={22} />
                      </div>
                      <div>
                        <p className="font-semibold text-[15px] text-foreground group-hover:text-[#1099A1] transition-colors">Create New Assignment</p>
                        <p className="text-[13px] text-muted-foreground">Go to Google Classroom to publish a new assignment for {selectedCourse.name}.</p>
                      </div>
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
