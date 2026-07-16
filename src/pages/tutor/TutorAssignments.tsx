import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Plus, BookOpen, ExternalLink, CalendarClock, School } from "lucide-react";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import { exchangeGoogleToken, fetchCourses, fetchCourseWork } from "@/services/classroomService";

const GoogleClassroomIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611,20.083H42V14c0-2.211-1.789-4-4-4H10c-2.211,0-4,1.789-4,4v6H4.389C2.422,20.083,1,21.505,1,23.472v12.139 c0,1.967,1.422,3.389,3.389,3.389H43.61c1.967,0,3.389-1.422,3.389-3.389V23.472C47,21.505,45.578,20.083,43.611,20.083z"/>
    <path fill="#4CAF50" d="M38,10H10c-2.211,0-4,1.789-4,4v25c0,2.211,1.789,4,4,4h28c2.211,0,4-1.789,4-4V14 C42,11.789,40.211,10,38,10z"/>
    <path fill="#FFF" d="M24,29c2.761,0,5-2.239,5-5s-2.239-5-5-5s-5,2.239-5,5S21.239,29,24,29z M24,32c-4.418,0-8,3.134-8,7h16 C32,35.134,28.418,32,24,32z M13,26c1.657,0,3-1.343,3-3s-1.343-3-3-3s-3,1.343-3-3S11.343,26,13,26z M35,26c1.657,0,3-1.343,3-3 s-1.343-3-3-3s-3,1.343-3,3S33.343,26,35,26z M10,36c0-2.761,2.239-5-5-5h1.222C15.176,31.764,14,33.256,14,35v1H9.197 C9.582,36,10,36,10,36z M34,36c0-2.761-2.239-5-5-5h-1.222c1.046,0.764,2.222,2.256,2.222,4v1h4.803C34.418,36,34,36,34,36z"/>
  </svg>
);

function formatDue(dueDate: any, dueTime: any) {
  if (!dueDate) return "No due date";
  const { year, month, day } = dueDate;
  const d = new Date(year, month - 1, day);
  let str = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (dueTime && dueTime.hours !== undefined) {
    const min = String(dueTime.minutes || 0).padStart(2, '0');
    str += ` at ${dueTime.hours}:${min}`;
  }
  return str;
}

export function TutorAssignments() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(localStorage.getItem('google_access_token'));
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Authenticate with Google (Auth Code Flow for Refresh Token)
  const login = useGoogleLogin({
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.coursework.me https://www.googleapis.com/auth/classroom.coursework.students',
    onSuccess: async ({ code }) => {
      try {
        setLoading(true);
        const data = await exchangeGoogleToken(code);
        setToken(data.access_token);
        localStorage.setItem('google_access_token', data.access_token);
        toast.success("Successfully connected to Google Classroom");
        loadCourses(data.access_token);
      } catch (err: any) {
        toast.error(err.message || "Failed to connect to Google");
        setLoading(false);
      }
    },
    onError: () => toast.error('Google login failed'),
  });

  const loadCourses = async (tkn: string) => {
    try {
      setLoading(true);
      const data = await fetchCourses(tkn);
      setCourses(data.courses || []);
      if (data.courses && data.courses.length > 0) {
        setSelectedCourse(data.courses[0]);
      }
    } catch (err) {
      toast.error("Failed to load courses. Please reconnect.");
      setToken(null);
      localStorage.removeItem('google_access_token');
    } finally {
      setLoading(false);
    }
  };

  const loadCourseWork = async (tkn: string, courseId: string) => {
    try {
      setLoading(true);
      const data = await fetchCourseWork(tkn, courseId);
      setAssignments(data.courseWork || []);
    } catch (err) {
      toast.error("Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && courses.length === 0) {
      loadCourses(token);
    }
  }, [token]);

  useEffect(() => {
    if (token && selectedCourse) {
      loadCourseWork(token, selectedCourse.id);
    }
  }, [selectedCourse, token]);

  if (!token) {
    return (
      <PageWrapper>
        <div className="flex-1 min-h-[calc(100vh-80px)] bg-background dark:bg-[#111b21] flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 rounded-full bg-white dark:bg-[#182329] shadow-sm flex items-center justify-center mb-6">
            <GoogleClassroomIcon className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2 text-center">Connect Google Classroom</h2>
          <p className="text-muted-foreground text-center max-w-md mb-8">
            Manage your assignments, grades, and student submissions directly through Google Classroom without leaving Yakal.
          </p>
          <Button onClick={() => login()} size="lg" className="bg-[#1099A1] hover:bg-[#0d848b] text-white">
            Connect Classroom
          </Button>
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
              {courses.map((course) => (
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
                <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : assignments.length === 0 ? (
                <p className="text-center text-[14px] text-muted-foreground py-12">No assignments found for this class.</p>
              ) : (
                <div className="space-y-0">
                  {assignments.map((a) => (
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
