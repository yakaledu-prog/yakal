import { useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Plus, BookOpen, ExternalLink, CalendarClock, School } from "lucide-react";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import { exchangeGoogleToken, fetchCourses, fetchCourseWork, createCourseWork } from "@/services/classroomService";

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
  const [token, setToken] = useState<string | null>(localStorage.getItem('google_access_token'));
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

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

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!token || !selectedCourse) return;
    
    try {
      setLoading(true);
      await createCourseWork(token, selectedCourse.id, {
        title: newTitle,
        description: newDesc,
        workType: "ASSIGNMENT",
        state: "PUBLISHED"
      });
      toast.success("Assignment published to Google Classroom!");
      setShowForm(false);
      setNewTitle("");
      setNewDesc("");
      loadCourseWork(token, selectedCourse.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to create assignment");
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
          <div className="w-20 h-20 rounded-full bg-[#1099A1]/10 flex items-center justify-center text-[#1099A1] mb-6">
            <School size={36} />
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
        <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0 md:pb-0">
          <div className="max-w-[1440px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10">
              <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Assignments</h1>
                <p className="text-white/80 text-[15px]">Powered by Google Classroom</p>
              </div>
              {courses.length > 0 && (
                <Button onClick={() => setShowForm(!showForm)} className="bg-white/10 hover:bg-white/20 text-white border-0">
                  <Plus size={18} className="mr-2" /> {showForm ? "Cancel" : "New Assignment"}
                </Button>
              )}
            </div>

            {/* Course Tabs */}
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar border-b border-white/20">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => { setSelectedCourse(course); setShowForm(false); }}
                  className={`pb-4 px-1 text-[15px] font-medium whitespace-nowrap transition-colors relative ${
                    selectedCourse?.id === course.id ? "text-white" : "text-white/60 hover:text-white/80"
                  }`}
                >
                  {course.name}
                  {selectedCourse?.id === course.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-t-full" />
                  )}
                </button>
              ))}
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
              {showForm && selectedCourse && (
                <div className="mb-8 p-6 bg-[#f8f9fa] dark:bg-[#182329] rounded-2xl border border-transparent dark:border-border/20">
                  <h3 className="text-[16px] font-semibold text-foreground mb-4">Create New Assignment for {selectedCourse.name}</h3>
                  <div className="space-y-4 max-w-2xl">
                    <div>
                      <label className="block text-[13px] font-medium text-muted-foreground mb-1">Title</label>
                      <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full bg-white dark:bg-[#111b21] border border-border/50 rounded-lg px-3 py-2 text-[14px] text-foreground focus:outline-none focus:border-[#1099A1]" placeholder="e.g. Chapter 3 Homework" />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-muted-foreground mb-1">Instructions (Optional)</label>
                      <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} className="w-full bg-white dark:bg-[#111b21] border border-border/50 rounded-lg px-3 py-2 text-[14px] text-foreground focus:outline-none focus:border-[#1099A1]" placeholder="Add detailed instructions..." />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleCreate} disabled={loading || !newTitle.trim()} className="bg-[#1099A1] hover:bg-[#0d848b] text-white">
                        Publish Assignment
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {loading && !showForm ? (
                 <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
              ) : assignments.length === 0 ? (
                <p className="text-center text-[14px] text-muted-foreground py-12">No assignments found for this class.</p>
              ) : (
                <div className="space-y-0">
                  {assignments.map((a) => (
                    <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-5 border-b border-border/40 last:border-0 hover:bg-muted/10 transition-colors px-2 -mx-2 rounded-lg cursor-pointer group">
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
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
