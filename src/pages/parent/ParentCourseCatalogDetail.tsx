import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Star, Clock, Users, CheckCircle2, MessageCircle, ChevronDown, ChevronLeft, ChevronRight, Heart, Upload, Download, GraduationCap, Briefcase, Languages, Award } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import 'react-flagpack/dist/style.css';
import { useAuth } from "@/contexts/AuthContext";
import { getFirstAvailableTutor, TutorAvailability } from "@/services/availability";
import { bookAndPay } from "@/services/billingService";
import { toast } from "sonner";
import Flag from 'react-flagpack';
import 'react-flagpack/dist/style.css';
import { ChatBody, useDirectConversation } from "@/components/messaging";

const courseData = {
  id: "CAT-01",
  title: "Algebra Fundamentals",
  description: "Dive deep into modern algebraic concepts. Learn how to solve equations, understand functions, and build a strong foundation for advanced mathematics.",
  thumbnail: "https://picsum.photos/seed/algebra/1280/720",
  price: "$49.99",
  students: 1204,
  rating: 4.8,
  reviews: 320,
  syllabus: [
    { title: "Module 1: Introduction to Variables", sessions: 5, time: "2h 30m" },
    { title: "Module 2: Linear Equations", sessions: 8, time: "4h 15m" },
    { title: "Module 3: Functions and Graphs", sessions: 12, time: "6h 45m" },
    { title: "Module 4: Polynomials", sessions: 6, time: "3h 20m" },
    { title: "Module 5: Final Assessment", sessions: 10, time: "8h 00m" },
  ]
};

const MOCK_TUTORS = [
  {
    id: "t1",
    name: "Avery M.",
    avatar: "https://i.pravatar.cc/150?u=avery",
    country: "US",
    headline: "Senior Mathematics Instructor with 10+ years of experience.",
    bio: "Learning with Avery is truly amazing. You feel comfortable from day one. Every lesson feels relaxed, but also productive and engaging at the same time. I specialize in helping students overcome their math anxiety.",
    price: "$49.99",
    rating: 4.8,
    reviews: 120,
    students: 12,
    responseTime: "Usually responds in 2 hrs",
    certifications: [
      { id: 1, year: "2026 - 2026", title: "Advanced Math Teaching", issuer: "National Math Board", verified: true },
      { id: 2, year: "2025 - 2025", title: "Algebra Certified", issuer: "Tutors Assoc.", verified: true },
    ],
    reviews_data: [
      { id: 1, name: "María Alicia", date: "June 5, 2026", text: "Learning with Avery is truly amazing. You feel comfortable from day one. Every lesson feels relaxed, but also productive and engaging at the same time." },
      { id: 2, name: "Linh", date: "June 2, 2026", text: "She has fun lessons that make me feel excited for the next lesson." },
    ]
  },
  {
    id: "t2",
    name: "David K.",
    avatar: "https://i.pravatar.cc/150?u=david",
    country: "GB-UKM",
    headline: "Math enthusiast and patient tutor for all levels.",
    bio: "I love making math simple. I break down complex algebraic problems into easy steps.",
    price: "$35.00",
    rating: 4.9,
    reviews: 45,
    students: 8,
    responseTime: "Usually responds in 1 hr",
    certifications: [
      { id: 1, year: "2023 - 2024", title: "B.S. Mathematics", issuer: "University of Oxford", verified: true },
    ],
    reviews_data: [
      { id: 1, name: "John Doe", date: "July 12, 2026", text: "David is incredibly patient. My son loves his classes!" },
    ]
  },
  {
    id: "t3",
    name: "Sarah L.",
    avatar: "https://i.pravatar.cc/150?u=sarah",
    country: "CA",
    headline: "Former high school teacher with a passion for Algebra.",
    bio: "With over 15 years in the classroom, I know exactly where students get stuck and how to help them push through.",
    price: "$55.00",
    rating: 5.0,
    reviews: 210,
    students: 34,
    responseTime: "Usually responds in 4 hrs",
    certifications: [
      { id: 1, year: "2015 - 2020", title: "State Teaching License", issuer: "Ontario Board of Ed.", verified: true },
    ],
    reviews_data: [
      { id: 1, name: "Emma W.", date: "Aug 1, 2026", text: "Best math teacher I've ever had. She makes algebra fun." },
    ]
  }
];

const TABS = ["Availability", "Resume", "Reviews", "Messages"];

export function ParentCourseCatalogDetail() {
  useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const selectedTutor = MOCK_TUTORS.find(t => t.id === selectedTutorId);

  const [activeTab, setActiveTab] = useState("Availability");
  const [availability, setAvailability] = useState<TutorAvailability | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Array<{ dayIndex: number, hourIndex: number, date: Date, mode: number }>>([]);
  const [isTimezoneOpen, setIsTimezoneOpen] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState("Local Time");
  const [isBooking, setIsBooking] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Note: the tutor cards on this page still come from the MOCK_TUTORS list, so
  // `selectedTutor.id` is not a real profile id yet. The chat below is wired to
  // the real messaging stack, which means it will work as soon as this catalog
  // is backed by profiles, and fails loudly rather than silently pretending
  // until then.
  const { conversation: tutorConversation, send: sendToTutor, isPeerTyping, notifyTyping } =
    useDirectConversation({
      userId: user?.id,
      peerId: selectedTutor?.id,
      peerName: selectedTutor?.name,
      peerRole: "tutor",
      peerAvatarUrl: selectedTutor?.avatar,
    });

  const [prefilledMessage, setPrefilledMessage] = useState("");
  const [favoriteTutors, setFavoriteTutors] = useState<Record<string, boolean>>({});

  const course = courseData;

  useEffect(() => {
    const fetchAvail = async () => {
      const avail = await getFirstAvailableTutor();
      if (avail) setAvailability(avail);
    };
    fetchAvail();
  }, [selectedTutorId]); // refetch when tutor changes

  const getWeekDays = (offsetWeeks: number) => {
    const d = new Date();
    d.setDate(d.getDate() + (offsetWeeks * 7));
    const day = d.getDay();
    const diff = d.getDate() - day;
    const sunday = new Date(d.setDate(diff));

    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      return date;
    });
  };

  const weekDays = getWeekDays(currentWeekOffset);
  const hours = Array.from({ length: 15 }).map((_, i) => i + 7);

  const tzOffset = selectedTimezone === "Local Time" ? 0
    : selectedTimezone === "US/Eastern" ? -4
      : selectedTimezone === "Africa/Addis_Ababa" ? 3
        : 1;

  const formatHour = (hour: number, offset: number = 0) => {
    let h = hour + offset;
    if (h < 0) h += 24;
    if (h >= 24) h -= 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:00 ${ampm}`;
  };

  const toggleSlot = (dayIndex: number, hourIndex: number, date: Date, mode: number) => {
    setSelectedSlots(prev => {
      const exists = prev.find(s => s.dayIndex === dayIndex && s.hourIndex === hourIndex);
      if (exists) return prev.filter(s => s.dayIndex !== dayIndex || s.hourIndex !== hourIndex);
      return [...prev, { dayIndex, hourIndex, date, mode }];
    });
  };

  const getModeClasses = (mode: number, isSelected: boolean) => {
    if (isSelected) return "bg-[#1099A1] text-white border border-[#1099A1]";
    if (mode === 1) return "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/40";
    if (mode === 2) return "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50 hover:bg-orange-100 dark:hover:bg-orange-900/40";
    if (mode === 3) return "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-100 dark:hover:bg-purple-900/40";
    return "";
  };

  const handleBookSlot = async () => {
    if (!availability) return;
    if (selectedSlots.length === 0) {
      toast.error("Please select at least one time slot.");
      return;
    }

    if (!user) {
      toast.error("Please log in to book a session.");
      navigate('/login');
      return;
    }
    setIsBooking(true);

    try {
      const unit = parseFloat(selectedTutor?.price.replace(/[^0-9.]/g, "") || "0");
      const amountCents = Math.round(unit * 100 * selectedSlots.length);
      const label = `${course.title} with ${selectedTutor?.name} (${selectedSlots.length} session${selectedSlots.length > 1 ? "s" : ""})`;

      const { error } = await bookAndPay({ description: label, amountCents, kind: "tutoring", tutorId: selectedTutor?.id ?? "" });
      if (error) throw new Error(error);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Could not start payment. Please try again.");
      setIsBooking(false);
    }
  };

  return (
    <PageWrapper className="!p-0">
      <div className={cn(
        "flex-1 min-h-screen bg-background dark:bg-[#111b21]",
        activeTab === "Messages" ? "pb-0" : "pb-12"
      )}>

        {/* Dynamic Header Section */}
        {!selectedTutorId ? (
          /* Course Overview Header */
          <div className="bg-[#1099A1] text-white pt-6 md:pt-10 px-6 md:px-10 pb-6 md:pb-8 relative overflow-hidden shrink-0">
            <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
              <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
              <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
              <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
              <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
              <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
            </svg>

            <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-4 max-w-3xl">
                <Link to="/parent/courses" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white transition-colors mb-2 font-medium text-[14px]">
                  <ChevronLeft size={16} /> Back to Courses
                </Link>
                <h1 className="text-3xl md:text-[40px] font-bold tracking-tight leading-tight">
                  {course.title}
                </h1>
                <p className="text-white/80 text-[16px] leading-relaxed max-w-2xl">
                  {course.description}
                </p>

                <div className="flex items-center gap-6 text-[14px]">
                  <div className="flex items-center gap-1.5 text-yellow-300 font-bold">
                    <span>{course.rating}</span>
                    <Star size={16} fill="currentColor" />
                    <span className="text-white font-medium underline">({course.reviews} reviews)</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <Users size={16} />
                    <span>{course.students} students enrolled</span>
                  </div>
                </div>
              </div>

              {/* Pricing in header */}
              <div className="flex flex-col md:items-end shrink-0 mb-2 md:mb-0">
                <div className="text-[28px] font-bold">$199.96<span className="text-[16px] font-normal text-white/80">/course</span></div>
                <div className="text-[14px] text-white/70">Or starting at $49.99/hr with tutors</div>
              </div>
            </div>
          </div>
        ) : (
          /* Tutor Profile Header */
          <div className="bg-[#1099A1] text-white pt-6 md:pt-10 px-6 md:px-10 pb-0 relative overflow-hidden shrink-0">
            <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
              <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
              <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
              <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
              <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
              <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
            </svg>

            <div className="relative z-10 max-w-[1440px] mx-auto">
              <button
                onClick={() => setSelectedTutorId(null)}
                className="inline-flex items-center gap-1.5 text-white/80 hover:text-white transition-colors mb-6 font-medium text-[14px]"
              >
                <ChevronLeft size={16} /> Back to gallery
              </button>

              <div className="flex flex-col sm:flex-row gap-6 items-center justify-between mb-8">
                <div className="flex flex-col sm:flex-row gap-6 items-center">
                  <div className="space-y-3 max-w-5xl">
                    <h2 className="text-3xl md:text-[40px] font-bold text-white flex items-center gap-3 leading-tight">
                      {selectedTutor?.name}
                    </h2>
                    <div className="text-[18px] font-medium text-white/90">{selectedTutor?.headline}</div>
                  </div>
                </div>

                <div className="flex flex-col shrink-0 sm:items-end sm:text-right">
                  <div className="text-[32px] md:text-[40px] font-bold text-white leading-none mb-1">
                    {selectedTutor?.students}
                  </div>
                  <div className="text-[14px] text-white/80 font-medium flex items-center gap-1.5">
                    <Users size={14} className="text-white/60" /> active students
                  </div>
                </div>
              </div>

              {/* Tabs inside Header */}
              <div className="flex items-center gap-8 mt-4 pt-2 pb-0 border-b border-white/20">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "pb-1 px-2 text-[16px] font-apfel transition-all ease-in-out relative",
                      activeTab === tab
                        ? "text-white border-b-2 border-b-white"
                        : "text-white/70 hover:text-white"
                    )}
                  >
                    {tab}
                    {/* {activeTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-t-full" />
                    )} */}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={cn(
          "mx-auto w-full max-w-[1440px]",
          !selectedTutorId ? "px-6 md:px-10 mt-8" : "mt-0"
        )}>
          {/* Dynamic Section: Gallery OR Master-Detail */}
          {!selectedTutorId ? (
            /* GALLERY VIEW */
            <div>
              <h2 className="text-2xl font-bold text-[#111] dark:text-white mb-6">Available Tutors for this Course</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {MOCK_TUTORS.map(tutor => (
                  <div key={tutor.id} className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-6 shadow-sm flex flex-col hover:border-[#1099A1] transition-colors cursor-pointer" onClick={() => setSelectedTutorId(tutor.id)}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-start gap-4">
                        <img src={tutor.avatar} alt={tutor.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
                        <div>
                          <h3 className="text-lg font-bold text-[#111] dark:text-white flex items-center gap-2 mb-1">
                            {tutor.name}
                            <Flag code={tutor.country} size="m" />
                          </h3>
                          <div className="flex items-center gap-1.5 text-[14px] text-yellow-500 font-bold mb-1">
                            <Star size={14} fill="currentColor" /> {tutor.rating}
                            <span className="text-[#54656f] font-normal underline ml-1">({tutor.reviews})</span>
                          </div>
                          <p className="text-[#54656f] text-[13px]">{tutor.students} active students</p>
                        </div>
                      </div>
                      <button
                        className={cn("transition-colors", favoriteTutors[tutor.id] ? "text-secondary" : "text-[#aebac1] hover:text-secondary")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFavoriteTutors(prev => ({ ...prev, [tutor.id]: !prev[tutor.id] }));
                        }}
                      >
                        <Heart size={20} className={favoriteTutors[tutor.id] ? "fill-secondary" : ""} />
                      </button>
                    </div>

                    <div className="text-[14px] font-medium text-[#111] dark:text-white mb-2 line-clamp-1">
                      {tutor.headline}
                    </div>
                    <div className="text-[13px] text-[#54656f] dark:text-[#aebac1] line-clamp-2 mb-4">
                      {tutor.bio}
                    </div>

                    <div className="mt-auto flex items-center justify-end pt-4 border-t border-[#e9edef] dark:border-[#2a3942]">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          className="!bg-[#87bE8D] hover:!bg-[#97CE9D]/95 border-transparent !text-white hover:!text-secondary-foreground gap-2 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTutorId(tutor.id);
                            setTimeout(() => {
                              setActiveTab("Messages");
                              setPrefilledMessage(`Hi ${tutor.name.split(' ')[0]},\n\nI'm interested in booking a lesson for my child. Could we discuss availability?`);
                            }, 10);
                          }}
                        >
                          <MessageCircle size={16} /> Send Message
                        </Button>
                        <Button className="bg-[#1099A1] hover:bg-[#0d848b] text-white">View Profile</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* SELECTED TUTOR VIEW */
            <div className="w-full">
              <div className="flex flex-col xl:flex-row gap-0">
                {/* Left side of right pane (Tabs body) */}
                <div className="flex-1 w-full bg-white dark:bg-[#182329] min-h-[500px]">

                  {/* Tabs Content */}
                  <div className={cn(
                    "w-full",
                    activeTab === "Messages" ? "p-0 h-[calc(100vh-280px)]" : "p-6 md:p-10"
                  )}>

                    {/* AVAILABILITY TAB */}
                    {activeTab === "Availability" && (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold">Book a session with {selectedTutor?.name}</h3>
                        <div className="text-xl font-bold text-[#1099A1]">{selectedTutor?.price}<span className="text-[14px] text-[#54656f] font-normal">/hr</span></div>
                      </div> */}

                        {!availability ? (
                          <div className="p-12 text-center text-[#54656f] dark:text-[#aebac1] border border-dashed rounded-xl border-[#e9edef] dark:border-[#2a3942]">
                            <Clock className="mx-auto mb-4 opacity-50" size={32} />
                            <p>Loading tutor availability...</p>
                          </div>
                        ) : (
                          // <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-x-auto bg-white dark:bg-[#182329]">
                          <div className="border-0 border-[#e9edef] dark:border-[#2a3942] rounded-none overflow-x-auto bg-white/0 dark:bg-[#182329]">
                            <div className="min-w-[600px] p-4 pt-0">

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
                                    {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
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

                        {selectedSlots.length > 0 && (
                          <div className="xl:hidden bg-white dark:bg-[#202c33] p-6 border border-[#e9edef] dark:border-[#2a3942] rounded-xl shadow-lg sticky bottom-4 flex items-center justify-between">
                            <div>
                              <div className="text-lg font-bold">{selectedSlots.length} slot(s) selected</div>
                              <div className="text-[#54656f]">Total: ${(parseFloat((selectedTutor?.price || "$0").replace('$', '')) * selectedSlots.length).toFixed(2)}</div>
                            </div>
                            <Button
                              onClick={handleBookSlot}
                              disabled={isBooking}
                              className="bg-[#1099A1] hover:bg-[#0d848b] text-white px-8 h-12 text-[16px] font-bold rounded-xl transition-all"
                            >
                              {isBooking ? "Booking..." : "Checkout"}
                            </Button>
                          </div>
                        )}

                      </div>
                    )}

                    {/* RESUME TAB */}
                    {activeTab === "Resume" && (
                      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
                        <div>
                          <div className="border-b border-[#e9edef] dark:border-[#2a3942] pb-2 mb-6">
                            <span className="text-[16px] font-bold text-[#111] dark:text-white border-b-2 border-[#1099A1] pb-2 inline-flex items-center gap-2"><Award size={18} /> Certifications</span>
                          </div>
                          <div className="space-y-6">
                            {selectedTutor?.certifications.map((cert: any) => (
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

                        <div>
                          <div className="border-b border-[#e9edef] dark:border-[#2a3942] pb-2 mb-6">
                            <span className="text-[16px] font-bold text-[#111] dark:text-white border-b-2 border-[#1099A1] pb-2 flex items-center gap-2"><GraduationCap size={18} /> Education</span>
                          </div>
                          <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                              <div className="w-32 text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0 font-medium pt-1">
                                2016 - 2020
                              </div>
                              <div className="flex-1 space-y-1">
                                <h4 className="text-[16px] font-bold text-[#111] dark:text-white">B.S. in Mathematics</h4>
                                <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">University of California, Berkeley</p>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                              <div className="w-32 text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0 font-medium pt-1">
                                2020 - 2022
                              </div>
                              <div className="flex-1 space-y-1">
                                <h4 className="text-[16px] font-bold text-[#111] dark:text-white">M.Ed. in Mathematics Education</h4>
                                <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">Stanford University</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="border-b border-[#e9edef] dark:border-[#2a3942] pb-2 mb-6">
                            <span className="text-[16px] font-bold text-[#111] dark:text-white border-b-2 border-[#1099A1] pb-2 flex items-center gap-2"><Briefcase size={18} /> Work Experience</span>
                          </div>
                          <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                              <div className="w-32 text-[14px] text-[#54656f] dark:text-[#aebac1] shrink-0 font-medium pt-1">
                                2022 - Present
                              </div>
                              <div className="flex-1 space-y-2">
                                <h4 className="text-[16px] font-bold text-[#111] dark:text-white">Senior Mathematics Instructor</h4>
                                <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">Yakal Learning</p>
                                <p className="text-[14px] text-[#54656f] dark:text-[#aebac1] leading-relaxed">
                                  Conducted over 1,200 hours of 1-on-1 tutoring sessions, specializing in Algebra and Calculus. Developed custom learning plans for students with math anxiety, improving average test scores by 25%.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="border-b border-[#e9edef] dark:border-[#2a3942] pb-2 mb-6">
                            <span className="text-[16px] font-bold text-[#111] dark:text-white border-b-2 border-[#1099A1] pb-2 flex items-center gap-2"><Languages size={18} /> Languages</span>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#111] dark:text-white">English</span>
                              <span className="text-[#54656f] dark:text-[#aebac1] text-[14px]">- Native</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#111] dark:text-white">Spanish</span>
                              <span className="text-[#54656f] dark:text-[#aebac1] text-[14px]">- Conversational</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 flex justify-center">
                          <Button className="gap-2 h-12 px-8 bg-[#f0f2f5] hover:bg-[#e4e7eb] dark:bg-[#202c33] dark:hover:bg-[#2a3942] text-[#111] dark:text-white border-0 font-semibold transition-colors">
                            <Download size={18} /> Download Resume (PDF)
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* REVIEWS TAB */}
                    {activeTab === "Reviews" && (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-4">
                          <div className="text-[48px] font-bold text-[#111] dark:text-white">{selectedTutor?.rating}</div>
                          <div className="flex flex-col gap-1">
                            <div className="flex text-yellow-500">
                              <Star size={20} fill="currentColor" />
                              <Star size={20} fill="currentColor" />
                              <Star size={20} fill="currentColor" />
                              <Star size={20} fill="currentColor" />
                              <Star size={20} fill="currentColor" className="opacity-50" />
                            </div>
                            <span className="text-[#54656f] dark:text-[#aebac1] font-bold text-[14px]">Tutor Rating ({selectedTutor?.reviews})</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {selectedTutor?.reviews_data.map((review: any) => (
                            <div key={review.id} className="border-b border-[#e9edef] dark:border-[#2a3942] pb-6 mb-6 last:border-0">
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
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* MESSAGES TAB */}
                    {activeTab === "Messages" && (
                      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full w-full">
                        <div className="bg-[#f8f9fa] dark:bg-[#182329] h-full overflow-hidden flex flex-col">
                          {tutorConversation && (
                            <ChatBody
                              conversation={tutorConversation}
                              currentUserId={user?.id}
                              onSendText={sendToTutor}
                              onTyping={notifyTyping}
                              isPeerTyping={isPeerTyping}
                              draft={prefilledMessage}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sticky Booking Card (Right Pane) */}
                {activeTab !== "Messages" && (
                  <div className="w-full xl:w-[400px] shrink-0 p-6 md:p-10 bg-white dark:bg-[#111b21] border-l border-[#e9edef] dark:border-[#2a3942]">
                    <div className="sticky top-8 bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl shadow-sm overflow-hidden flex flex-col">
                    {/* Tutor Profile Header (in floating card) */}
                    <div className="p-6 pb-2 border-b border-[#e9edef] dark:border-[#2a3942] flex flex-col items-center text-center">
                      <img 
                        src={selectedTutor?.avatar} 
                        alt={selectedTutor?.name} 
                        className="w-24 h-24 rounded-full object-cover shadow-sm border-2 border-white dark:border-[#182329] mb-4" 
                      />
                      <h3 className="text-[20px] font-bold text-[#111] dark:text-white mb-3">
                        {selectedTutor?.name}
                      </h3>
                      <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] leading-relaxed mb-2">
                        {selectedTutor?.bio}
                      </p>
                    </div>

                    <div className="p-6">
                      {/* Stats */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-1.5">
                          <Star size={20} fill="currentColor" className="text-yellow-500" />
                          <span className="text-[20px] font-bold text-[#111] dark:text-white">{selectedTutor?.rating}</span>
                        </div>
                        <div className="text-center">
                          <div className="text-[16px] font-bold text-[#111] dark:text-white">{selectedTutor?.students}</div>
                          <div className="text-[12px] text-[#54656f] dark:text-[#aebac1]">students</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[20px] font-bold text-[#111] dark:text-white">
                            ${(parseFloat((selectedTutor?.price || "$0").replace('$', '')) * Math.max(1, selectedSlots.length)).toFixed(2)}
                          </div>
                          <div className="text-[12px] text-[#54656f] dark:text-[#aebac1]">
                            {selectedSlots.length > 1 ? `${selectedSlots.length}x 60-min lesson` : '60-min lesson'}
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={activeTab !== "Availability" && selectedSlots.length === 0 ? () => setActiveTab("Availability") : handleBookSlot}
                        disabled={isBooking}
                        className="w-full h-14 bg-[#1099A1] hover:bg-[#0d848b] text-white text-[16px] font-bold rounded-xl mb-4 transition-all"
                      >
                        {isBooking ? "Booking..." : (selectedSlots.length > 0 ? `Checkout (${selectedSlots.length} slots)` : "Book this course")}
                      </Button>

                      <div className="flex gap-2">
                        <button
                          onClick={() => { setActiveTab("Messages"); setPrefilledMessage(`Hi ${selectedTutor?.name.split(' ')[0]},\n\nI'm interested in booking a lesson for my child. Could we discuss availability?`); }}
                          className="flex-1 h-14 flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold text-[#111] dark:text-white bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl transition-colors"
                        >
                          <MessageCircle size={16} /> Message
                        </button>
                        <button className="flex-1 h-14 flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold text-[#111] dark:text-white bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl transition-colors">
                          <Heart size={16} /> Save
                        </button>
                        <button className="flex-1 h-14 flex flex-col items-center justify-center gap-1.5 text-[11px] font-bold text-[#111] dark:text-white bg-transparent hover:bg-[#f8f9fa] dark:hover:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-xl transition-colors">
                          <Upload size={16} /> Share
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
