import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Star, Clock, Users, PlayCircle, Plus, Minus, FileText, CheckCircle2, MessageSquare, Heart, ChevronLeft, ChevronRight, Upload, Facebook, Twitter, Linkedin, Instagram, Mail, Youtube, MessageCircle, Link2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { useAuth } from "@/contexts/AuthContext";
import { getFirstAvailableTutor, TutorAvailability } from "@/services/availability";
import { createSession } from "@/services/sessions";
import { createZoomMeeting } from "@/services/zoom";
import { toast } from "react-hot-toast";

// Mock data
const courseData = {
  id: "CAT-01",
  title: "Algebra Fundamentals",
  description: "Dive deep into modern algebraic concepts. Learn how to solve equations, understand functions, and build a strong foundation for advanced mathematics.",
  thumbnail: "https://picsum.photos/seed/algebra/1280/720",
  price: "$49.99",
  duration: "3 months",
  students: 1204,
  rating: 4.8,
  reviews: 320,
  tutor: {
    id: "mock-tutor-id", // will be replaced dynamically
    name: "Avery M.",
    avatar: "https://i.pravatar.cc/150?u=abebe",
    bio: "Senior Mathematics Instructor with 10+ years of experience helping students ace their exams.",
    response_time: "Usually responds in 7 hrs",
    stats: "72 new contacts and 4 lesson bookings in the last 48 hours"
  },
  syllabus: [
    { title: "Module 1: Introduction to Variables", sessions: 5, time: "2h 30m" },
    { title: "Module 2: Linear Equations", sessions: 8, time: "4h 15m" },
    { title: "Module 3: Functions and Graphs", sessions: 12, time: "6h 45m" },
    { title: "Module 4: Polynomials", sessions: 6, time: "3h 20m" },
    { title: "Module 5: Final Assessment", sessions: 10, time: "8h 00m" },
  ],
  reviews_data: [
    { id: 1, name: "María Alicia", date: "June 5, 2026", text: "Learning with Avery is truly amazing. You feel comfortable from day one. Every lesson feels relaxed, but also productive and engaging at the same time." },
    { id: 2, name: "Linh", date: "June 2, 2026", text: "I feel more confident when I speak in English with Avery. She has fun lessons that make me feel excited for the next lesson." },
    { id: 3, name: "Roger", date: "May 9, 2026", text: "She has a unique teaching method." },
  ],
  certifications: [
    { id: 1, year: "2026 - 2026", title: "Preply Language Teaching Certificate", issuer: "Preply Language Teaching Certificate", verified: true },
    { id: 2, year: "2025 - 2025", title: "TESOL", issuer: "Teaching English to Speakers of Other Languages", verified: true },
  ]
};

const TABS = ["Outline", "Reviews", "Resume", "Availability"];

export function StudentCourseCatalogDetail() {
  useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("Outline");
  const [expandedModules, setExpandedModules] = useState<number[]>([0]);

  const [availability, setAvailability] = useState<TutorAvailability | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Array<{ dayIndex: number, hourIndex: number, date: Date, mode: number }>>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState("all"); // "all", "online", "in-person"
  const [isTimezoneOpen, setIsTimezoneOpen] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState("Local Time");
  const [isBooking, setIsBooking] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const course = courseData;

  useEffect(() => {
    // Fetch a real tutor's availability for MVP demo
    const fetchAvail = async () => {
      const avail = await getFirstAvailableTutor();
      if (avail) setAvailability(avail);
    };
    fetchAvail();
  }, []);

  const toggleModule = (index: number) => {
    setExpandedModules(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const getWeekDays = (offsetWeeks: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (offsetWeeks * 7));
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday
    const sunday = new Date(d.setDate(diff));

    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      return date;
    });
  };

  const weekDays = getWeekDays(currentWeekOffset);
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

  const toggleSlot = (dayIndex: number, hourIndex: number, date: Date, mode: number) => {
    setSelectedSlots(prev => {
      const exists = prev.some(s => s.dayIndex === dayIndex && s.hourIndex === hourIndex);
      if (exists) return prev.filter(s => !(s.dayIndex === dayIndex && s.hourIndex === hourIndex));
      return [...prev, { dayIndex, hourIndex, date, mode }];
    });
  };

  const tzOffsets: Record<string, number> = {
    "Local Time": 0,
    "US/Eastern": -7,
    "Africa/Addis_Ababa": 0,
    "Europe/London": -2,
  };
  const tzOffset = tzOffsets[selectedTimezone] || 0;

  const formatHour = (h: number, offset: number) => {
    let shiftedHour = h + offset;
    if (shiftedHour < 0) shiftedHour += 24;
    if (shiftedHour >= 24) shiftedHour -= 24;

    const ampm = shiftedHour >= 12 ? 'PM' : 'AM';
    const hour12 = shiftedHour % 12 || 12;
    return `${hour12}:00 ${ampm}`;
  };

  const getModeClasses = (mode: number, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-[#1099A1] text-white shadow-md scale-105 border border-[#1099A1]';
    }

    if (mode === 1) return 'border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-900/10 text-sky-600 dark:text-sky-400 border';
    if (mode === 2) return 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border';
    if (mode === 3) return 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 border';

    return 'border border-[#e9edef] text-[#54656f]';
  };

  const handleBookSlot = async () => {
    if (selectedSlots.length === 0 || !user || !availability) {
      toast.error("Please select at least one slot");
      return;
    }

    setIsBooking(true);

    try {
      // Book all selected slots, each gets a unique Jitsi meeting room and Zoom meeting
      await Promise.all(selectedSlots.map(async slot => {
        const formattedDate = slot.date.toISOString().split('T')[0];
        const formattedTime = `${(slot.hourIndex + 8).toString().padStart(2, '0')}:00:00`;
        const meetingRoomId = `yakal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        let zoom_meeting_id = undefined;
        let zoom_password = undefined;

        if (slot.mode === 1 || slot.mode === 3) {
          try {
            // For MVP, assuming UTC. In production, calculate proper UTC start_time
            const zoomStartTime = `${formattedDate}T${formattedTime}Z`;
            const zoomData = await createZoomMeeting(
              `${course.title} Session`,
              zoomStartTime,
              60
            );
            zoom_meeting_id = zoomData.meetingNumber;
            zoom_password = zoomData.password;
          } catch (e) {
            console.error("Zoom meeting creation failed:", e);
            // Continuing without Zoom to allow booking to succeed as fallback
          }
        }

        return createSession({
          tutor_id: availability.tutor_id,
          student_id: user.id,
          subject: course.title,
          date: formattedDate,
          start_time: formattedTime,
          duration_minutes: 60,
          mode: slot.mode,
          meeting_room_id: meetingRoomId,
          zoom_meeting_id,
          zoom_password,
        });
      }));

      toast.success(`Successfully booked ${selectedSlots.length} slot(s)!`);
      setSelectedSlots([]); // Clear selection after booking
      navigate('/student/sessions');
    } catch (error) {
      console.error(error);
      toast.error("Failed to book one or more slots. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-[1200px] p-4 md:p-8 dark:bg-[#111b21]">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-8">

            {/* Header Info */}
            <div className="flex flex-col gap-4 mb-6">
              <h1 className="text-[32px] md:text-[40px] font-bold text-[#111] dark:text-white leading-tight">
                {course.title}
              </h1>
              <p className="text-[16px] text-[#54656f] dark:text-[#aebac1] leading-relaxed">
                {course.description}
              </p>

              <div className="flex items-center gap-4 text-[14px]">
                <div className="flex items-center gap-1.5 text-yellow-500 font-bold">
                  <span>{course.rating}</span>
                  <Star size={16} fill="currentColor" />
                  <span className="text-[#111] dark:text-white font-medium underline">({course.reviews} reviews)</span>
                </div>
                <div className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]">
                  <Users size={16} />
                  <span>{course.students} students enrolled</span>
                </div>
              </div>
            </div>

            {/* Tabs Header */}
            <div className="flex items-center gap-8 border-b border-[#e9edef] dark:border-[#2a3942] sticky top-0 bg-white/80 dark:bg-[#111b21]/80 backdrop-blur-md z-10 pt-4">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "pb-3 text-[16px] font-bold transition-all relative",
                    activeTab === tab
                      ? "text-[#111] dark:text-white"
                      : "text-[#54656f] dark:text-[#aebac1] hover:text-[#111] dark:hover:text-white"
                  )}
                >
                  {tab}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1099A1] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Tabs Content */}
            <div className="pt-4">

              {/* OUTLINE TAB */}
              {activeTab === "Outline" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between text-[14px] text-[#54656f] dark:text-[#aebac1] mb-2">
                    <span>{course.syllabus.length} sections • {course.syllabus.reduce((acc, s) => acc + s.sessions, 0)} sessions</span>
                    <button
                      onClick={() => setExpandedModules(expandedModules.length === course.syllabus.length ? [] : course.syllabus.map((_, i) => i))}
                      className="text-[#1099A1] font-bold hover:underline"
                    >
                      {expandedModules.length === course.syllabus.length ? "Collapse all sections" : "Expand all sections"}
                    </button>
                  </div>

                  <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden bg-white dark:bg-[#182329]">
                    {course.syllabus.map((module, i) => (
                      <div key={i} className="border-b border-[#e9edef] dark:border-[#2a3942] last:border-b-0">
                        <button
                          onClick={() => toggleModule(i)}
                          className="w-full bg-[#f8f9fa] dark:bg-[#182329] hover:bg-[#e9edef]/50 dark:hover:bg-[#202c33] p-4 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-3 text-left">
                            {expandedModules.includes(i) ? (
                              <Minus size={16} className="text-[#111] dark:text-white shrink-0" />
                            ) : (
                              <Plus size={16} className="text-[#111] dark:text-white shrink-0" />
                            )}
                            <h3 className="text-[16px] font-bold text-[#111] dark:text-white">{module.title}</h3>
                          </div>
                          <div className="text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0">
                            <span>{module.sessions} sessions • {module.time}</span>
                          </div>
                        </button>

                        {expandedModules.includes(i) && (
                          <div className="p-4 bg-white dark:bg-[#111b21]">
                            <ul className="space-y-4">
                              {Array.from({ length: module.sessions > 3 ? 3 : module.sessions }).map((_, idx) => (
                                <li key={idx} className="flex items-start justify-between text-[14px] group cursor-pointer hover:bg-[#f8f9fa] dark:hover:bg-[#182329] p-2 rounded -mx-2">
                                  <div className="flex items-center gap-3">
                                    <Users size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                                    <span className="text-[#111] dark:text-white group-hover:text-[#1099A1] transition-colors">Session {idx + 1}: Introduction</span>
                                  </div>
                                  <span className="text-[#54656f] dark:text-[#aebac1]">12:4{idx}</span>
                                </li>
                              ))}
                              <li className="flex items-start justify-between text-[14px] group cursor-pointer hover:bg-[#f8f9fa] dark:hover:bg-[#182329] p-2 rounded -mx-2">
                                <div className="flex items-center gap-3">
                                  <FileText size={16} className="text-[#54656f] dark:text-[#aebac1]" />
                                  <span className="text-[#111] dark:text-white group-hover:text-[#1099A1] transition-colors">Reading Material & Quiz</span>
                                </div>
                                <span className="text-[#54656f] dark:text-[#aebac1]">5 min</span>
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* REVIEWS TAB */}
              {activeTab === "Reviews" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-4">
                    <div className="text-[48px] font-bold text-[#111] dark:text-white">4.8</div>
                    <div className="flex flex-col gap-1">
                      <div className="flex text-yellow-500">
                        <Star size={20} fill="currentColor" />
                        <Star size={20} fill="currentColor" />
                        <Star size={20} fill="currentColor" />
                        <Star size={20} fill="currentColor" />
                        <Star size={20} fill="currentColor" className="opacity-50" />
                      </div>
                      <span className="text-[#54656f] dark:text-[#aebac1] font-bold text-[14px]">Course Rating</span>
                    </div>
                  </div>

                  <div className="flex overflow-x-auto gap-6 pb-4 -mx-4 px-4 scrollbar-hide">
                    {course.reviews_data.map(review => (
                      <div key={review.id} className="w-[320px] max-w-[80vw] border border-[#e9edef] dark:border-[#2a3942] rounded-xl p-6 bg-white dark:bg-[#182329] shrink-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-[#1099A1] text-white flex items-center justify-center font-bold text-[16px]">
                            {review.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-[#111] dark:text-white text-[15px]">{review.name}</h4>
                            <p className="text-[12px] text-[#54656f] dark:text-[#aebac1]">{review.date}</p>
                          </div>
                        </div>
                        <div className="flex text-yellow-500 mb-3">
                          {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                        </div>
                        <p className="text-[14px] text-[#111] dark:text-[#e9edef] leading-relaxed">
                          {review.text}
                        </p>
                        <button className="text-[14px] font-bold text-[#111] dark:text-white mt-3 underline">Show more</button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="h-10 text-[14px] font-bold">Show all reviews</Button>
                </div>
              )}

              {/* RESUME TAB */}
              {activeTab === "Resume" && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">

                  {/* Education */}
                  <div>
                    <div className="border-b border-[#e9edef] dark:border-[#2a3942] pb-2 mb-6">
                      <span className="text-[16px] font-bold text-[#111] dark:text-white border-b-2 border-[#1099A1] pb-2 inline-block">Education</span>
                    </div>
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="w-32 text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0 font-medium pt-1">
                          2014 – 2018
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="text-[16px] font-bold text-[#111] dark:text-white">M.S. in Mathematics</h4>
                          <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">Stanford University</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="w-32 text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0 font-medium pt-1">
                          2010 – 2014
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="text-[16px] font-bold text-[#111] dark:text-white">B.S. in Applied Mathematics</h4>
                          <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">University of California, Berkeley</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Achievements */}
                  <div>
                    <div className="border-b border-[#e9edef] dark:border-[#2a3942] pb-2 mb-6">
                      <span className="text-[16px] font-bold text-[#111] dark:text-white border-b-2 border-[#1099A1] pb-2 inline-block">Achievements</span>
                    </div>
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="w-32 text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0 font-medium pt-1">
                          2023
                        </div>
                        <div className="flex-1 space-y-1">
                          <h4 className="text-[16px] font-bold text-[#111] dark:text-white">Outstanding Educator Award</h4>
                          <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">National Mathematics Society</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Certifications */}
                  <div>
                    <div className="border-b border-[#e9edef] dark:border-[#2a3942] pb-2 mb-6">
                      <span className="text-[16px] font-bold text-[#111] dark:text-white border-b-2 border-[#1099A1] pb-2 inline-block">Certifications</span>
                    </div>
                    <div className="space-y-6">
                      {course.certifications.map(cert => (
                        <div key={cert.id} className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-32 text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0 font-medium pt-1">
                            {cert.year}
                          </div>
                          <div className="flex-1 space-y-1">
                            <h4 className="text-[16px] font-bold text-[#111] dark:text-white">{cert.title}</h4>
                            <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">{cert.issuer}</p>
                            {cert.verified && (
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-[13px] font-bold mt-1">
                                <CheckCircle2 size={14} />
                                Certificate verified
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* AVAILABILITY TAB */}
              {activeTab === "Availability" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                  {!availability ? (
                    <div className="p-12 text-center text-[#54656f] dark:text-[#aebac1] border border-dashed rounded-xl border-[#e9edef] dark:border-[#2a3942]">
                      <Clock className="mx-auto mb-4 opacity-50" size={32} />
                      <p>Loading tutor availability...</p>
                      <p className="text-[12px] mt-2 opacity-70">(Make sure the tutor has set and saved their availability first)</p>
                    </div>
                  ) : (
                    <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-x-auto bg-white dark:bg-[#182329] shadow-sm">
                      <div className="min-w-[600px] p-4">

                        {/* Week Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 px-2">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekOffset(prev => prev - 1)}>
                              <ChevronLeft size={16} />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekOffset(prev => prev + 1)}>
                              <ChevronRight size={16} />
                            </Button>
                            <span className="text-[14px] font-bold text-[#111] dark:text-white ml-2">
                              {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {/* Filter */}
                            <div className="flex bg-[#f0f2f5] dark:bg-[#111b21] p-1 rounded-full border border-[#e9edef] dark:border-[#2a3942]">
                              {["all", "online", "in-person"].map(f => (
                                <button
                                  key={f}
                                  onClick={() => setAvailabilityFilter(f)}
                                  className={cn("px-4 py-1.5 text-[12px] font-bold rounded-full transition-all capitalize", availabilityFilter === f ? "bg-[#1099A1] shadow-md text-white" : "text-[#54656f] hover:text-[#111] dark:hover:text-white")}
                                >
                                  {f}
                                </button>
                              ))}
                            </div>

                            {/* Custom Timezone Dropdown */}
                            <div className="relative">
                              <button
                                onClick={() => setIsTimezoneOpen(!isTimezoneOpen)}
                                className="flex items-center gap-2 text-[13px] bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-lg px-3 py-1.5 font-medium hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors"
                              >
                                {selectedTimezone} <ChevronDown size={14} className={cn("transition-transform", isTimezoneOpen && "rotate-180")} />
                              </button>
                              {isTimezoneOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl shadow-lg overflow-hidden z-10 animate-in fade-in slide-in-from-top-2 duration-200">
                                  {["Local Time", "US/Eastern", "Africa/Addis_Ababa", "Europe/London"].map(tz => (
                                    <button
                                      key={tz}
                                      onClick={() => { setSelectedTimezone(tz); setIsTimezoneOpen(false); }}
                                      className="w-full text-left px-4 py-2 text-[13px] font-medium hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors"
                                    >
                                      {tz}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-7 gap-2">
                          {weekDays.map((day, dIndex) => (
                            <div key={dIndex} className="text-center">
                              <div className="pb-3 mb-3 border-b-2 border-[#CAA25F]">
                                <div className="text-[12px] text-[#54656f] dark:text-[#aebac1] uppercase font-bold">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div className="text-[18px] text-[#111] dark:text-white mt-1">{day.getDate()}</div>
                              </div>

                              <div className="space-y-2">
                                {availability.disabled_days?.includes(dIndex) ? (
                                  <div className="text-[12px] text-[#54656f] dark:text-[#aebac1] py-4 bg-[#f8f9fa] dark:bg-[#111b21] rounded">Off</div>
                                ) : (
                                  hours.map((hour, hIndex) => {
                                    const mode = availability.time_grid[hIndex]?.[dIndex] || 0;
                                    if (mode === 0) return null; // Only show available slots

                                    // Apply filter
                                    if (availabilityFilter === "online" && mode !== 1 && mode !== 3) return null;
                                    if (availabilityFilter === "in-person" && mode !== 2 && mode !== 3) return null;

                                    const isSelected = selectedSlots.some(s => s.dayIndex === dIndex && s.hourIndex === hIndex);

                                    return (
                                      <button
                                        key={hIndex}
                                        onClick={() => toggleSlot(dIndex, hIndex, day, mode)}
                                        className={cn(
                                          "w-full py-2 text-[13px] font-bold rounded transition-all flex flex-col items-center justify-center gap-0.5",
                                          getModeClasses(mode, isSelected)
                                        )}
                                      >
                                        <span>{formatHour(hour, tzOffset)}</span>
                                        <span className={cn("text-[9px] uppercase tracking-wider", isSelected ? "text-white/90" : "opacity-80")}>
                                          {mode === 1 ? "Online" : mode === 2 ? "In-Person" : "Both"}
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Sticky Sidebar (Right) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">

              {/* Preply-style Booking Card */}
              <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden shadow-sm">

                {/* Video Header */}
                <div className="relative w-full aspect-video bg-[#111]" onClick={() => setIsVideoOpen(true)}>
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group cursor-pointer hover:bg-black/40 transition-colors">
                    <PlayCircle size={48} className="text-white opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </div>
                </div>

                <div className="p-6">
                  {/* Stats */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-1.5">
                      <Star size={20} fill="currentColor" className="text-yellow-500" />
                      <span className="text-[20px] font-bold text-[#111] dark:text-white">4.8</span>
                    </div>
                    <div className="text-center">
                      <div className="text-[16px] font-bold text-[#111] dark:text-white">635</div>
                      <div className="text-[12px] text-[#54656f] dark:text-[#aebac1]">lessons</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[20px] font-bold text-[#111] dark:text-white">${(parseFloat(course.price.replace('$', '')) * Math.max(1, selectedSlots.length)).toFixed(2)}</div>
                      <div className="text-[12px] text-[#54656f] dark:text-[#aebac1]">{selectedSlots.length > 1 ? `${selectedSlots.length}x 60-min lesson` : '60-min lesson'}</div>
                    </div>
                  </div>

                  <Button
                    onClick={activeTab !== "Availability" && selectedSlots.length === 0 ? () => setActiveTab("Availability") : handleBookSlot}
                    disabled={isBooking}
                    className="w-full h-14 bg-[#1099A1] hover:bg-[#0d848b] text-white text-[16px] font-bold rounded-xl mb-4 transition-all"
                  >
                    {isBooking ? "Booking..." : (selectedSlots.length > 0 ? `Book ${selectedSlots.length} slot(s)` : "Book this course")}
                  </Button>

                  <div className="flex gap-2 mb-6">
                    <button onClick={() => navigate('/student/messages', { state: { draftMessage: `Hi ${course.tutor.name}, I'm interested in your course!`, tutorName: course.tutor.name } })} className="flex-1 h-14 flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold text-[#111] dark:text-white bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl transition-colors">
                      <MessageSquare size={16} /> Message
                    </button>
                    <button onClick={() => { setIsSaved(!isSaved); toast.success(isSaved ? "Removed from list" : "Saved to your list!"); }} className="flex-1 h-14 flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold text-[#111] dark:text-white bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl transition-colors">
                      <Heart size={16} className={isSaved ? "fill-[#97CE9D] text-[#97CE9D]" : ""} /> Save
                    </button>
                    <button onClick={() => setIsShareOpen(true)} className="flex-1 h-14 flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold text-[#111] dark:text-white bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl transition-colors">
                      <Upload size={16} /> Share
                    </button>
                  </div>

                  {/* User info */}
                  <div className="border-t border-[#e9edef] dark:border-[#2a3942] pt-6 flex items-start gap-4">
                    <img src={course.tutor.avatar} alt={course.tutor.name} className="w-12 h-12 rounded-full object-cover border border-[#e9edef] dark:border-[#2a3942] shrink-0" />
                    <div>
                      <h4 className="text-[15px] font-bold text-[#111] dark:text-white mb-1">{course.tutor.name}</h4>
                      <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] leading-snug">
                        {course.tutor.bio}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* Video Modal */}
      {isVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-black rounded-2xl overflow-hidden relative shadow-2xl">
            <button onClick={() => setIsVideoOpen(false)} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2">
              <Plus className="rotate-45" size={24} />
            </button>
            <div className="aspect-video w-full flex items-center justify-center bg-[#111]">
              <PlayCircle size={64} className="text-white/50" />
              <span className="text-white ml-4 text-lg">Course Introduction Video (Mock)</span>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsShareOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#202c33] rounded-2xl overflow-hidden shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[20px] font-bold text-[#111] dark:text-white">Share this course</h3>
              <button onClick={() => setIsShareOpen(false)} className="text-[#54656f] hover:text-[#111] dark:hover:text-white transition-colors">
                <Plus className="rotate-45" size={28} />
              </button>
            </div>

            {/* Scrollable Socials */}
            <div className="flex overflow-x-auto gap-4 pb-4 mb-2 scrollbar-hide -mx-2 px-2">
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <Facebook size={22} />
              </button>
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <Twitter size={22} />
              </button>
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <Linkedin size={22} />
              </button>
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <Instagram size={22} />
              </button>
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <Youtube size={22} />
              </button>
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <MessageCircle size={22} />
              </button>
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <Mail size={22} />
              </button>
              <button className="shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#111b21] text-[#111] dark:text-white transition-colors border border-[#e9edef] dark:border-[#2a3942]">
                <Link2 size={22} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-4 p-2 bg-[#f8f9fa] dark:bg-[#182329] rounded-xl border border-[#e9edef] dark:border-[#2a3942]">
              <input type="text" readOnly value="https://yakal.app/course/CAT-01" className="bg-transparent flex-1 outline-none text-[13px] text-[#54656f] dark:text-[#aebac1] px-2" />
              <Button
                className={cn(
                  "h-8 text-[12px] text-white rounded-lg px-4 transition-all duration-300 flex items-center gap-1.5 active:scale-95",
                  isCopied ? "bg-green-500 hover:bg-green-600 scale-105" : "bg-[#1099A1] hover:bg-[#0d848b]"
                )}
                onClick={() => {
                  navigator.clipboard.writeText("https://yakal.app/course/CAT-01");
                  setIsCopied(true);
                  toast.success("Link copied!");
                  setTimeout(() => setIsCopied(false), 2000);
                }}
              >
                {isCopied ? <><Check size={14} /> Copied</> : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
