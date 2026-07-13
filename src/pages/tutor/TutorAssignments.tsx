import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { TipTapEditor } from "@/components/ui/TipTapEditor";
import { Plus, BookOpen, ExternalLink, CalendarClock, School, Link2, Youtube, X } from "lucide-react";
import { toast } from "sonner";
import { useGoogleLogin } from "@react-oauth/google";
import { exchangeGoogleToken, fetchCourses, fetchCourseWork, createCourseWork } from "@/services/classroomService";

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
  const [showForm, setShowForm] = useState(false);
  
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);

  // Modal State for Attach Link
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [attachUrl, setAttachUrl] = useState("");

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

  const handleAttachConfirm = () => {
    if (attachUrl.trim()) {
      if (attachUrl.includes("youtube.com") || attachUrl.includes("youtu.be")) {
        setMaterials([...materials, { youtubeVideo: { alternateLink: attachUrl.trim() } }]);
      } else {
        setMaterials([...materials, { link: { url: attachUrl.trim() } }]);
      }
      setAttachUrl("");
      setShowAttachModal(false);
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
      
      // Google Classroom expects plain text for description, not HTML
      // Preserve newlines and bullets before extracting text
      let htmlDesc = newDesc;
      htmlDesc = htmlDesc.replace(/<\/p>/gi, '\n\n');
      htmlDesc = htmlDesc.replace(/<br\s*\/?>/gi, '\n');
      htmlDesc = htmlDesc.replace(/<\/li>/gi, '\n');
      htmlDesc = htmlDesc.replace(/<li>/gi, '• ');
      
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlDesc;
      const plainDesc = (tempDiv.textContent || tempDiv.innerText || "").trim();

      const payload: any = {
        title: newTitle,
        description: plainDesc,
        workType: "ASSIGNMENT",
        state: "PUBLISHED"
      };

      if (newPoints && !isNaN(Number(newPoints))) {
        payload.maxPoints = Number(newPoints);
      }

      if (newDueDate) {
        const [year, month, day] = newDueDate.split("-").map(Number);
        payload.dueDate = { year, month, day };

        if (newDueTime) {
          const [hours, minutes] = newDueTime.split(":").map(Number);
          payload.dueTime = { hours, minutes };
        }
      }

      if (materials.length > 0) {
        // Safely map all attachments to standard links to prevent API validation errors
        payload.materials = materials.map((m) => ({
          link: { url: m.youtubeVideo?.alternateLink || m.link?.url }
        }));
      }

      await createCourseWork(token, selectedCourse.id, payload);
      toast.success("Assignment published to Google Classroom!");
      setShowForm(false);
      setNewTitle("");
      setNewDesc("");
      setNewPoints("");
      setNewDueDate("");
      setNewDueTime("");
      setMaterials([]);
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
        <div className="bg-[#1099A1] text-white p-6 md:p-10 pb-0 md:pb-0">
          <div className="max-w-[1440px] mx-auto">
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
                  onClick={() => { setSelectedCourse(course); setShowForm(false); }}
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
              {!showForm && selectedCourse && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full mb-6 flex items-center gap-4 rounded-xl border-2 border-dashed border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] p-5 text-left hover:border-[#1099A1]/50 hover:bg-[#1099A1]/[0.02] transition-colors group"
                >
                  <div className="h-11 w-11 rounded-xl bg-[#f0f1f2] group-hover:bg-[#1099A1]/10 text-[#2a3942]/70  group-hover:text-[#1099A1] flex items-center justify-center shrink-0 transition-colors">
                    <Plus size={22} />
                  </div>
                  <div>
                    <p className="font-semibold text-[15px] text-foreground group-hover:text-[#1099A1] transition-colors">Create New Assignment</p>
                    <p className="text-[13px] text-muted-foreground">Publish a new assignment to {selectedCourse.name} on Google Classroom.</p>
                  </div>
                </button>
              )}

              {showForm && selectedCourse && (
                <div className="mb-10 animate-in slide-in-from-top-4 fade-in duration-300 ease-out">
                  <div className="bg-white dark:bg-[#182329] rounded-2xl border border-[#e0e0e0] dark:border-border/30 shadow-sm overflow-hidden flex flex-col">
                    {/* Top Header Actions */}
                    <div className="flex items-center justify-between p-4 px-6 border-b border-[#e0e0e0] dark:border-border/30 bg-[#f8f9fa] dark:bg-[#111b21]/50">
                      <Button variant="ghost" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                        Cancel
                      </Button>
                      <Button onClick={handleCreate} disabled={loading || !newTitle.trim()} className="bg-[#1099A1] hover:bg-[#0d848b] text-white">
                        Publish Assignment
                      </Button>
                    </div>

                    <div className="flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-[#e0e0e0] dark:divide-border/30">
                      {/* Left: Main Content Area */}
                      <div className="flex-1 p-6 md:p-8 space-y-8">
                        <div>
                          <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="w-full bg-transparent text-xl font-semibold text-foreground placeholder-muted-foreground focus:outline-none mb-4"
                            placeholder="Title *"
                          />
                          <div className="min-h-[160px] flex flex-col border border-[#e0e0e0] dark:border-border/30 rounded-lg overflow-hidden">
                            <TipTapEditor value={newDesc} onChange={setNewDesc} onAttachClick={() => setShowAttachModal(true)} />
                          </div>
                          
                          {/* Attachments Section */}
                          {materials.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {materials.map((m, i) => (
                                <div key={i} className="flex items-center gap-3 text-[13px] text-foreground bg-[#f8f9fa] dark:bg-[#111b21] p-3 rounded-lg border border-[#e0e0e0] dark:border-border/50">
                                  {m.youtubeVideo ? <Youtube size={16} className="text-red-500" /> : <Link2 size={16} className="text-[#1099A1]" />}
                                  <span className="truncate flex-1 font-medium">{m.youtubeVideo?.alternateLink || m.link?.url}</span>
                                  <button onClick={() => setMaterials(materials.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-500 transition-colors">×</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Settings Sidebar */}
                      <div className="w-full xl:w-[320px] shrink-0 p-6 md:p-8 space-y-6 bg-[#fcfcfc] dark:bg-transparent">
                        <div>
                          <label className="block text-[13px] font-semibold text-foreground mb-2">Points</label>
                          <div className="flex items-center gap-2 bg-white dark:bg-[#111b21] border border-[#e0e0e0] dark:border-border/50 rounded-lg p-1.5 focus-within:border-[#1099A1] transition-colors">
                            <input
                              type="number"
                              value={newPoints}
                              onChange={(e) => setNewPoints(e.target.value)}
                              className="w-full bg-transparent px-2 text-[14px] focus:outline-none"
                            />
                            <span className="text-[13px] text-muted-foreground pr-2 shrink-0 border-l border-[#e0e0e0] dark:border-border/30 pl-2">/ 100</span>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[13px] font-semibold text-foreground mb-2">Due</label>
                          <div className="flex flex-col gap-2">
                            <div className="relative group">
                              <input
                                type="date"
                                value={newDueDate}
                                onChange={(e) => setNewDueDate(e.target.value)}
                                className={`w-full text-neutral-700 p-2.5 bg-white dark:bg-[#111b21] hover:bg-muted/30 rounded-lg border border-[#e0e0e0] dark:border-border/50 transition-colors text-[14px] focus:outline-none focus:border-[#1099A1] pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10 ${!newDueDate ? 'text-transparent' : 'text-foreground'}`}
                              />
                              {!newDueDate && (
                                <div className="absolute group-focus-within:hidden inset-y-0 left-0 scale-90 pl-2.5 flex items-center pointer-events-none text-[14px] text-muted-foreground bg-inherit dark:bg-[#111b21]">
                                  No due date
                                </div>
                              )}
                              <CalendarClock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-0" />
                            </div>

                            {newDueDate && (
                              <div className="relative">
                                <input
                                  type="time"
                                  value={newDueTime}
                                  onChange={(e) => setNewDueTime(e.target.value)}
                                  className={`w-full p-2.5 bg-white dark:bg-[#111b21] hover:bg-muted/30 rounded-lg border border-[#e0e0e0] dark:border-border/50 transition-colors text-[14px] focus:outline-none focus:border-[#1099A1] pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer z-10 ${!newDueTime ? 'text-transparent' : 'text-foreground'}`}
                                />
                                {!newDueTime && (
                                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[14px] text-muted-foreground bg-white dark:bg-[#111b21]">
                                    Time (optional)
                                  </div>
                                )}
                                <CalendarClock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-0" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[13px] font-semibold text-foreground mb-2">Topic</label>
                          <button className="flex items-center justify-between w-full p-2.5 bg-white dark:bg-[#111b21] hover:bg-muted/30 rounded-lg border border-[#e0e0e0] dark:border-border/50 transition-colors text-left text-[14px] text-foreground">
                            <span>No topic</span>
                          </button>
                        </div>
                      </div>
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
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Attach Link Modal */}
      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#182329] rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <h3 className="font-semibold text-foreground">Attach Link</h3>
              <button onClick={() => setShowAttachModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-[13px] text-muted-foreground mb-3">Add a standard web link or a YouTube video URL.</p>
              <input
                type="url"
                placeholder="https://..."
                value={attachUrl}
                onChange={(e) => setAttachUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAttachConfirm(); }}
                className="w-full p-2.5 bg-[#f8f9fa] dark:bg-[#111b21] rounded-lg border border-border/50 focus:outline-none focus:border-[#1099A1] transition-colors text-[14px]"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border/50 bg-[#f8f9fa]/50 dark:bg-[#111b21]/50">
              <Button variant="ghost" onClick={() => setShowAttachModal(false)}>Cancel</Button>
              <Button onClick={handleAttachConfirm} disabled={!attachUrl.trim()} className="bg-[#1099A1] hover:bg-[#0d848b] text-white">Add Link</Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
