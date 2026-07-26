import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Star, Users, ExternalLink, Calendar, Search, LayoutGrid, Heart } from "lucide-react";
import { getCourse, type AdminCourse } from "@/services/adminService";
import { money } from "@/services/billingService";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";

// Mock Tutors
const mockTutors = [
  {
    id: "t1",
    name: "Avery M.",
    flag: "🇺🇸",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Avery",
    rating: 4.8,
    reviews: 120,
    students: 12,
    title: "Senior Mathematics Instructor with 10+ years of experience.",
    quote: "Learning with Avery is truly amazing. You feel comfortable from day one. Every lesson feels relaxed, but also...",
  },
  {
    id: "t2",
    name: "David K.",
    flag: "🇬🇧",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
    rating: 4.9,
    reviews: 45,
    students: 8,
    title: "Math enthusiast and patient tutor for all levels.",
    quote: "I love making math simple. I break down complex algebraic problems into easy steps.",
  },
  {
    id: "t3",
    name: "Sarah L.",
    flag: "🇨🇦",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    rating: 5.0,
    reviews: 210,
    students: 34,
    title: "Former high school teacher with a passion for...",
    quote: "With over 15 years in the classroom, I know exactly where students get stuck and how to help them push through.",
  }
];

export function AdminCourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<AdminCourse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tutors"); // Default to tutors to show off the UI

  useEffect(() => {
    if (id) {
      getCourse(id).then((data) => {
        setCourse(data);
        setIsLoading(false);
      });
    }
  }, [id]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-[#1099A1] border-t-transparent rounded-full" /></div>;
  }

  if (!course) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Course not found</div>;
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "students", label: "Students" },
    { id: "tutors", label: "Tutors" },
    { id: "sessions", label: "Sessions" },
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#111b21]">
      {/* Header Banner */}
      <div className="w-full bg-[#1099A1] text-white pt-8 pb-12 px-6 md:px-10 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        
        <div className="max-w-[1440px] mx-auto relative z-10">
          <button 
            onClick={() => navigate("/admin/courses")}
            className="flex items-center gap-1.5 text-white/90 hover:text-white mb-6 text-[14px] transition-colors"
          >
            <ChevronLeft size={16} /> Back to Courses
          </button>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="max-w-[800px]">
              <h1 className="text-[32px] md:text-[48px] font-bold tracking-tight mb-4 leading-tight">{course.title}</h1>
              {course.description ? (
                <div 
                  className="text-white/90 text-[15px] md:text-[18px] leading-relaxed mb-6 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: course.description }}
                />
              ) : (
                <p className="text-white/90 text-[15px] md:text-[18px] leading-relaxed mb-6">
                  Learn {course.subject} with our expert tutors. Tailored sessions for academic excellence.
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-6 text-[14px] font-medium text-white/95">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-[#F2C94C] text-[#F2C94C]" />
                  <span>4.8</span>
                  <span className="underline underline-offset-2 opacity-90 cursor-pointer hover:opacity-100">(320 reviews)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 opacity-80" />
                  <span>1,204 students enrolled</span>
                </div>
                {course.google_classroom_url && (
                  <a href={course.google_classroom_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 underline underline-offset-2 opacity-90 hover:opacity-100">
                    <ExternalLink size={14} /> Classroom
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end shrink-0 mt-4 md:mt-0">
              <div className="text-[28px] md:text-[36px] font-bold mb-1">
                {course.price_cents != null ? money(course.price_cents) : "—"}
                <span className="text-[16px] font-normal opacity-80 tracking-normal">/course</span>
              </div>
              <div className="text-[14px] opacity-90">
                Or starting at {course.tutor_payout_cents != null ? money(course.tutor_payout_cents) : "—"}/hr with tutors
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Nav */}
      <div className="w-full bg-white dark:bg-[#182329] border-b border-[#e9edef] dark:border-[#2a3942] sticky top-0 z-20">
        <div className="max-w-[1440px] mx-auto px-6 md:px-10 flex overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "py-4 px-6 text-[15px] font-medium whitespace-nowrap transition-colors relative",
                activeTab === tab.id ? "text-[#1099A1]" : "text-muted-foreground hover:text-[#111] dark:hover:text-white"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#1099A1] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-[1440px] mx-auto p-6 md:p-10">
        
        {/* TUTORS TAB */}
        {activeTab === "tutors" && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-[24px] font-bold text-[#111] dark:text-white mb-6">Available Tutors for this Course</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockTutors.map((tutor) => (
                <div key={tutor.id} className="bg-white dark:bg-[#182329] rounded-[24px] border border-[#e9edef] dark:border-[#2a3942] p-6 hover:shadow-lg transition-all flex flex-col h-full relative group">
                  <button className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors">
                    <Heart size={22} className="stroke-[1.5px]" />
                  </button>
                  
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                      <img src={tutor.avatar} alt={tutor.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[18px] font-bold text-[#111] dark:text-white">{tutor.name}</h3>
                        <span className="text-[14px]">{tutor.flag}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground mb-1">
                        <Star className="w-3.5 h-3.5 fill-[#F2C94C] text-[#F2C94C]" />
                        <span className="font-medium text-[#111] dark:text-white">{tutor.rating}</span>
                        <span>({tutor.reviews})</span>
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {tutor.students} active students
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 flex-grow">
                    <h4 className="text-[14px] font-semibold text-[#111] dark:text-white mb-2 leading-relaxed">
                      {tutor.title}
                    </h4>
                    <p className="text-[13px] text-muted-foreground leading-relaxed italic">
                      "{tutor.quote}"
                    </p>
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <Button variant="outline" className="flex-1 bg-[#f0f9f9] hover:bg-[#e0f2f2] text-[#1099A1] border-transparent font-semibold shadow-none rounded-xl h-11">
                      Send Message
                    </Button>
                    <Button className="flex-1 rounded-xl h-11 font-semibold shadow-none">
                      View Profile
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="animate-in fade-in duration-300 max-w-3xl bg-white dark:bg-[#182329] p-8 rounded-[24px] border border-[#e9edef] dark:border-[#2a3942]">
            <h2 className="text-[20px] font-bold text-[#111] dark:text-white mb-6">Course Description</h2>
            {course.description ? (
              <div 
                className="prose prose-sm dark:prose-invert max-w-none text-[#555] dark:text-gray-300"
                dangerouslySetInnerHTML={{ __html: course.description }}
              />
            ) : (
              <p className="text-[#555] dark:text-gray-300">No detailed description provided for this course.</p>
            )}
          </div>
        )}

        {/* STUDENTS TAB */}
        {activeTab === "students" && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-[20px] font-bold text-[#111] dark:text-white mb-6">Enrolled Students</h2>
            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-[16px] font-medium text-[#111] dark:text-white mb-2">Manage Students</h3>
              <p className="text-[14px] text-muted-foreground max-w-sm">
                View and manage all students enrolled in this course. You can assign them to specific tutors or sessions.
              </p>
            </div>
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === "sessions" && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-[20px] font-bold text-[#111] dark:text-white mb-6">Upcoming Sessions</h2>
            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
              <Calendar className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-[16px] font-medium text-[#111] dark:text-white mb-2">No upcoming sessions</h3>
              <p className="text-[14px] text-muted-foreground max-w-sm">
                There are currently no scheduled sessions for this course. Tutors will schedule sessions as needed.
              </p>
            </div>
          </div>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <div className="animate-in fade-in duration-300">
            <h2 className="text-[20px] font-bold text-[#111] dark:text-white mb-6">Student Reviews</h2>
            <div className="bg-white dark:bg-[#182329] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-12 flex flex-col items-center justify-center text-center">
              <Star className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-[16px] font-medium text-[#111] dark:text-white mb-2">4.8 Average Rating</h3>
              <p className="text-[14px] text-muted-foreground max-w-sm">
                Reviews will appear here once students complete course feedback forms.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
