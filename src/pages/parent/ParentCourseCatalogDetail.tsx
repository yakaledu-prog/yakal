import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Star, Users, CheckCircle2, MessageCircle, ChevronDown, ChevronLeft, ChevronRight, Heart, Upload, Download, GraduationCap, Briefcase, Languages, Award } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import 'react-flagpack/dist/style.css';
import { useAuth } from "@/contexts/AuthContext";
import { getTutorAvailability, TutorAvailability } from "@/services/availability";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { bookAndPay, money } from "@/services/billingService";
import { getCourseForBooking } from "@/services/courseApplicationService";
import { getLinkedChildren } from "@/services/parentService";
import { getSlotConflicts, slotKey } from "@/services/slotService";
import { dicebearUrl } from "@/utils/avatar";
import { toast } from "sonner";
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

// The availability grid stored on a tutor is 13 rows, 8 AM through 8 PM, one
// row per hour and seven columns for Sunday to Saturday. The booking grid drew
// 15 rows starting at 7 AM, so row 0 was labelled 7 AM while holding the
// tutor's 8 AM, and every slot on the page was an hour earlier than what they
// had actually offered. These two constants are the contract.
const HOUR_START = 8;
const HOUR_COUNT = 13;

// The day as the parent sees it. toISOString() converts to UTC first, so a
// date built from a local midnight lands on the day before for anyone west of
// Greenwich, and the session gets booked twenty four hours out.
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** How far ahead conflicts are loaded. Far enough that paging never runs past it. */
const CONFLICT_WEEKS = 26;

const TABS = ["Availability", "Resume", "Reviews", "Messages"];

export function ParentCourseCatalogDetail() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  // The real course and the tutor an admin accepted for it. This page used to
  // render four invented tutors with invented prices, so the id it handed to
  // checkout was not a real profile and the booking could never have worked.
  const { data: realCourse } = useQuery({
    queryKey: ["course-for-booking", courseId],
    queryFn: () => getCourseForBooking(courseId!),
    enabled: !!courseId,
  });

  // A parent buys for a child, so which child has to be part of the purchase.
  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });
  const [childId, setChildId] = useState<string | null>(null);
  const bookingFor = children.find((c) => c.id === childId) ?? children[0] ?? null;

  const realTutor = realCourse?.tutor ?? null;

  // One approved tutor per course, so there is nobody to choose between: the
  // page opens on them rather than on a picker of one.
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  useEffect(() => {
    if (realTutor && !selectedTutorId) setSelectedTutorId(realTutor.id);
  }, [realTutor, selectedTutorId]);

  const selectedTutor = realTutor
    ? {
        id: realTutor.id,
        name: realTutor.name,
        avatar: realTutor.avatarUrl || dicebearUrl(realTutor.name),
        headline: (realTutor.subjects ?? []).join(", ") || "Tutor",
        bio: realTutor.bio ?? "",
        price: realCourse?.priceCents != null ? money(realCourse.priceCents) : "",
        students: undefined,
        responseTime: "",
        certifications: [] as any[],
        reviews_data: [] as any[],
      }
    : undefined;

  const [activeTab, setActiveTab] = useState("Availability");
  const [availability, setAvailability] = useState<TutorAvailability | null>(null);
  // An empty week rather than no week. The calendar keeps its shape whether or
  // not the tutor has published times, so the page does not rearrange itself
  // around a missing row of data.
  const EMPTY_GRID: Pick<TutorAvailability, "time_grid" | "disabled_days"> = {
    time_grid: [],
    disabled_days: [],
  };
  // Keyed by the actual day, not by its column. Keying on the column meant a
  // pick in one week showed as picked in every other week at the same square,
  // and toggling it in either place removed it from both, so buying more than
  // one week was not possible.
  const [selectedSlots, setSelectedSlots] = useState<Array<{ key: string, iso: string, hour: number, date: Date }>>([]);
  const [isTimezoneOpen, setIsTimezoneOpen] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState("Local Time");
  const [isBooking, setIsBooking] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Now a real profile id, so messaging the tutor from this page works.
  const { conversation: tutorConversation, send: sendToTutor, isPeerTyping, notifyTyping } =
    useDirectConversation({
      userId: user?.id,
      peerId: selectedTutor?.id,
      peerName: selectedTutor?.name,
      peerRole: "tutor",
      peerAvatarUrl: selectedTutor?.avatar,
    });

  const [prefilledMessage, setPrefilledMessage] = useState("");

  // Falls back to the placeholder only while the real one loads, so the page
  // never renders half a course.
  const course = realCourse
    ? {
        ...courseData,
        id: realCourse.id,
        title: realCourse.title,
        description: realCourse.description ?? "",
        thumbnail: realCourse.thumbnailUrl ?? courseData.thumbnail,
        price: realCourse.priceCents != null ? money(realCourse.priceCents) : "",
      }
    : courseData;

  // The tutor assigned to this course. It used to load whichever tutor came
  // back first, so a parent booked against somebody else's calendar.
  useEffect(() => {
    let cancelled = false;
    if (!realTutor?.id) {
      setAvailability(null);
      return;
    }
    getTutorAvailability(realTutor.id).then((avail) => {
      if (!cancelled) setAvailability(avail);
    });
    return () => {
      cancelled = true;
    };
  }, [realTutor?.id]);

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
  const grid = availability ?? EMPTY_GRID;

  // The current week is mostly behind us by Friday, so opening on it shows an
  // empty grid. Skip to the next one when nothing here is still bookable.
  useEffect(() => {
    if (!availability || currentWeekOffset !== 0) return;
    const week = getWeekDays(0);
    const anyLeft = week.some((day, dIndex) => {
      if (grid.disabled_days?.includes(dIndex)) return false;
      return hours.some((hour, hIndex) => {
        if (!(grid.time_grid[hIndex]?.[dIndex] || 0)) return false;
        const start = new Date(day);
        start.setHours(hour, 0, 0, 0);
        return start.getTime() > Date.now();
      });
    });
    if (!anyLeft) setCurrentWeekOffset(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);
  const hours = Array.from({ length: HOUR_COUNT }).map((_, i) => i + HOUR_START);

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

  const toggleSlot = (date: Date, hour: number) => {
    const iso = isoDay(date);
    const key = `${iso}|${String(hour).padStart(2, "0")}:00`;
    setSelectedSlots(prev =>
      prev.some(s => s.key === key)
        ? prev.filter(s => s.key !== key)
        : [...prev, { key, iso, hour, date }]
    );
  };

  // A child cannot sit two lessons at once, and a tutor cannot teach two. The
  // grid used to draw the tutor's published hours and nothing else, so an hour
  // already sold looked free and could be sold again.
  const conflictWindow = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + CONFLICT_WEEKS * 7);
    return { from: isoDay(from), to: isoDay(to) };
  }, []);

  const { data: conflicts } = useQuery({
    queryKey: ["slot-conflicts", bookingFor?.id, realTutor?.id, conflictWindow.from],
    queryFn: () =>
      getSlotConflicts({
        studentId: bookingFor?.id ?? null,
        tutorId: realTutor?.id ?? null,
        ...conflictWindow,
      }),
    enabled: !!(bookingFor?.id || realTutor?.id),
  });

  const conflictAt = (date: Date, hour: number) =>
    conflicts?.byKey.get(slotKey(isoDay(date), `${String(hour).padStart(2, "0")}:00`)) ?? null;

  // Switching child changes what clashes, so picks made for the previous one
  // are not carried over onto a calendar they may no longer fit.
  useEffect(() => {
    setSelectedSlots([]);
  }, [bookingFor?.id]);

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

    if (!realCourse || !realTutor) {
      toast.error("This course does not have a tutor yet.");
      setIsBooking(false);
      return;
    }
    if (!bookingFor) {
      toast.error("Add a child before booking a course.");
      setIsBooking(false);
      return;
    }

    try {
      // Priced from the course, not from a string parsed back out of the UI.
      const unitCents = realCourse.priceCents ?? 0;
      const amountCents = unitCents * selectedSlots.length;
      const label = `${realCourse.title} with ${realTutor.name} (${selectedSlots.length} session${selectedSlots.length > 1 ? "s" : ""})`;

      // The chosen slots travel with the invoice, so the payment webhook can
      // turn them into sessions without asking the browser after the fact.
      // The week grid runs Sunday to Saturday, so the current week still shows
      // days that have already gone. Paying for a session in the past is not
      // something to discover after the money has moved.
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const past = selectedSlots.filter((slot) => slot.date < startOfToday);
      if (past.length > 0) {
        toast.error("Some of those times have already passed. Pick a later slot.");
        setIsBooking(false);
        return;
      }

      // The greyed-out slots in the grid are a snapshot. Somebody else can buy
      // an hour while this page sits open, so ask again with the money about to
      // move rather than find out during fulfilment, after it has.
      const fresh = await getSlotConflicts({
        studentId: bookingFor.id,
        tutorId: realTutor.id,
        ...conflictWindow,
      });
      const clashing = selectedSlots.filter((slot) =>
        fresh.byKey.has(slotKey(slot.iso, `${String(slot.hour).padStart(2, "0")}:00`))
      );
      if (clashing.length > 0) {
        setSelectedSlots((prev) => prev.filter((s) => !clashing.some((c) => c.key === s.key)));
        await qc.invalidateQueries({ queryKey: ["slot-conflicts"] });
        toast.error(
          clashing.length === 1
            ? "That time was taken while you were choosing. It has been removed."
            : `${clashing.length} of those times were taken while you were choosing. They have been removed.`
        );
        setIsBooking(false);
        return;
      }

      const booking = selectedSlots.map((slot) => ({
        date: slot.iso,
        startTime: `${String(slot.hour).padStart(2, "0")}:00`,
        durationMinutes: 60,
      }));

      const { error } = await bookAndPay({
        description: label,
        amountCents,
        kind: "tutoring",
        studentId: bookingFor.id,
        tutorId: realTutor.id,
        courseId: realCourse.id,
        booking,
      });
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
            /* No tutor accepted for this course yet. There is nobody to
               book with, and inventing three to fill the space is what this
               page did before. */
            <div className="rounded-2xl border border-dashed border-[#e9edef] py-16 text-center dark:border-[#2a3942]">
              <Users size={32} className="mx-auto mb-3 text-[#aebac1]" />
              <p className="text-[15px] font-medium text-[#111] dark:text-white">
                No tutor assigned yet
              </p>
              <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#54656f] dark:text-[#aebac1]">
                This course is open for tutors to apply to. It becomes bookable once one is
                approved.
              </p>
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

                        {(
                          // <div className="border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-x-auto bg-white dark:bg-[#182329]">
                          <div className="border-0 border-[#e9edef] dark:border-[#2a3942] rounded-none overflow-x-auto bg-white/0 dark:bg-[#182329]">
                            <div className="min-w-[600px] p-4 pt-0">

                              {/* Week Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 px-2">
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentWeekOffset <= 0} onClick={() => setCurrentWeekOffset(prev => Math.max(0, prev - 1))}>
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
                                      {grid.disabled_days?.includes(dIndex) ? (
                                        <div className="text-[12px] text-[#54656f] dark:text-[#aebac1] py-4 bg-[#f8f9fa] dark:bg-[#111b21] rounded">Off</div>
                                      ) : new Date(day).setHours(23, 59, 59, 999) < Date.now() ? (
                                        <div className="text-[12px] text-[#c2c7d0] py-4">-</div>
                                      ) : !hours.some((hour, hIndex) => {
                                          if (!(grid.time_grid[hIndex]?.[dIndex] || 0)) return false;
                                          const start = new Date(day);
                                          start.setHours(hour, 0, 0, 0);
                                          return start.getTime() > Date.now();
                                        }) ? (
                                        <div className="py-4 text-[12px] text-[#c2c7d0]">
                                          No slots
                                        </div>
                                      ) : (
                                        hours.map((hour, hIndex) => {
                                          const mode = grid.time_grid[hIndex]?.[dIndex] || 0;
                                          if (mode === 0) return null; // Only show available slots

                                          const isSelected = selectedSlots.some(
                                            s => s.key === `${isoDay(day)}|${String(hour).padStart(2, "0")}:00`
                                          );

                                          // The week runs Sunday to Saturday, so the
                                          // current one still holds hours that have
                                          // gone. They are not drawn at all: a time
                                          // nobody can book is not an option, and a
                                          // column of struck-through rows is just
                                          // noise to read past.
                                          const slotStart = new Date(day);
                                          slotStart.setHours(hour, 0, 0, 0);
                                          if (slotStart.getTime() <= Date.now()) return null;

                                          // An hour already sold. Drawn, not hidden:
                                          // a parent looking for Monday at four needs
                                          // to see it is gone, not wonder why the
                                          // tutor stopped offering it.
                                          const taken = conflictAt(day, hour);

                                          return (
                                            <button
                                              key={hIndex}
                                              onClick={() => toggleSlot(day, hour)}
                                              disabled={!!taken}
                                              title={taken ?? undefined}
                                              className={cn(
                                                "w-full py-2 text-[13px] font-bold rounded transition-all flex flex-col items-center justify-center gap-0.5",
                                                taken
                                                  ? "bg-[#f8f9fa] dark:bg-[#111b21] text-[#c2c7d0] dark:text-[#54656f] border border-[#e9edef] dark:border-[#2a3942] cursor-not-allowed line-through"
                                                  : getModeClasses(mode, isSelected)
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
                              <div className="text-[#54656f]">
                                Total: {money((realCourse?.priceCents ?? 0) * selectedSlots.length)}
                              </div>
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
                        <p className="text-[14px] text-[#54656f] dark:text-[#aebac1]">
                          No reviews yet. Ratings appear here once students have left them.
                        </p>

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
                        <div className="text-center">
                          <div className="text-[16px] font-bold text-[#111] dark:text-white">{course.title}</div>
                          <div className="text-[12px] text-[#54656f] dark:text-[#aebac1]">course</div>
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

                      {/* Who this is for. It sits with the price and the
                          button because that is the purchase, and it has to be
                          answered before the calendar means anything: the
                          hours a child already has booked are the ones they
                          cannot have again. */}
                      <div className="mb-4">
                        <label htmlFor="booking-child" className="block text-[11px] font-bold uppercase tracking-wider text-[#54656f] dark:text-[#aebac1] mb-1.5">
                          For
                        </label>
                        {children.length === 0 ? (
                          <p className="text-[13px] font-medium text-[#CAA25F]">
                            No children linked yet. Add one from My Children first.
                          </p>
                        ) : (
                          <select
                            id="booking-child"
                            value={bookingFor?.id ?? ""}
                            onChange={(e) => setChildId(e.target.value)}
                            className="w-full h-11 rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] px-3 text-[14px] font-semibold text-[#111] dark:text-white outline-none focus:border-[#1099A1] transition-colors"
                          >
                            {children.map((c) => (
                              <option key={c.id} value={c.id}>{c.full_name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <Button
                        onClick={activeTab !== "Availability" && selectedSlots.length === 0 ? () => setActiveTab("Availability") : handleBookSlot}
                        disabled={isBooking || children.length === 0}
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
