import React, { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Link, useParams } from "react-router-dom";
import { Star, Clock, Users, PlayCircle, Plus, Minus, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    name: "Abebe Kebede",
    avatar: "https://i.pravatar.cc/150?u=abebe",
    bio: "Senior Mathematics Instructor with 10+ years of experience helping students ace their exams."
  },
  syllabus: [
    { title: "Module 1: Introduction to Variables", lectures: 5, time: "2h 30m" },
    { title: "Module 2: Linear Equations", lectures: 8, time: "4h 15m" },
    { title: "Module 3: Functions and Graphs", lectures: 12, time: "6h 45m" },
    { title: "Module 4: Polynomials", lectures: 6, time: "3h 20m" },
    { title: "Module 5: Final Assessment", lectures: 10, time: "8h 00m" },
  ]
};

export function StudentCourseCatalogDetail() {
  const { courseId } = useParams();
  const [isBooking, setIsBooking] = useState(false);
  const [expandedModules, setExpandedModules] = useState<number[]>([0]);

  // In a real app, fetch course by courseId. Using mock data here.
  const course = courseData;

  const handleBookCourse = () => {
    setIsBooking(true);
    // Simulate API call
    setTimeout(() => {
      setIsBooking(false);
      alert("Successfully booked! Redirecting to My Learning...");
    }, 1500);
  };

  const toggleModule = (index: number) => {
    setExpandedModules(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <PageWrapper>
      <div className="mx-auto w-full p-4 md:p-8 dark:bg-[#111b21]">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-8">

            {/* Header Info */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-8 shadow-sm">
              <h1 className="text-[28px] md:text-[36px] font-bold text-[#111] dark:text-white leading-tight mb-4">
                {course.title}
              </h1>
              <p className="text-[16px] text-[#54656f] dark:text-[#aebac1] leading-relaxed mb-6">
                {course.description}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-[14px]">
                <div className="flex items-center gap-1.5 text-yellow-500 font-bold">
                  <span>{course.rating}</span>
                  <Star size={16} fill="currentColor" />
                  <span className="text-[#54656f] dark:text-[#aebac1] font-normal">({course.reviews} ratings)</span>
                </div>
                <div className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]">
                  <Users size={16} />
                  <span>{course.students} students enrolled</span>
                </div>
                <div className="flex items-center gap-2 text-[#54656f] dark:text-[#aebac1]">
                  <Clock size={16} />
                  <span>{course.duration}</span>
                </div>
              </div>
            </div>

            {/* Course Outline / Syllabus */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-8 shadow-sm">
              <h2 className="text-[20px] font-bold text-[#111] dark:text-white mb-6">Course Outline</h2>

              <div className="space-y-4">
                {course.syllabus.map((module, i) => (
                  <div key={i} className="border border-[#e9edef] dark:border-[#2a3942] rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleModule(i)}
                      className="w-full bg-[#f8f9fa] dark:bg-[#182329] hover:bg-[#e9edef]/50 dark:hover:bg-[#111b21] p-5 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-4 text-left">
                        {expandedModules.includes(i) ? (
                          <Minus size={20} className="text-[#54656f] dark:text-[#aebac1] shrink-0" />
                        ) : (
                          <Plus size={20} className="text-[#54656f] dark:text-[#aebac1] shrink-0" />
                        )}
                        <h3 className="text-[15px] font-bold text-[#111] dark:text-white">{module.title}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-[13px] text-[#54656f] dark:text-[#aebac1] shrink-0">
                        <span className="hidden sm:inline">{module.lectures} lectures</span>
                        <span>{module.time}</span>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {expandedModules.includes(i) && (
                      <div className="p-5 border-t border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#202c33]">
                        <ul className="space-y-3">
                          <li className="text-[13px] text-[#54656f] dark:text-[#aebac1] flex items-center gap-3">
                            <PlayCircle size={14} className="text-primary" />
                            <span>{module.lectures} detailed video lectures on this topic</span>
                          </li>
                          <li className="text-[13px] text-[#54656f] dark:text-[#aebac1] flex items-center gap-3">
                            <FileText size={14} className="text-primary" />
                            <span>Supplemental reading materials and practice worksheets</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Sidebar (Right) - Now entire sidebar is sticky to prevent overlapping children */}
          <div className="lg:col-span-1 space-y-6 self-start">

            {/* Booking Card */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] overflow-hidden shadow hover:shadow-lg">
              <div className="relative w-full aspect-video">
                <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group cursor-pointer hover:bg-black/40 transition-colors">
                  <PlayCircle size={64} className="text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                </div>
              </div>

              <div className="p-6">
                <div className="text-[32px] font-bold text-[#111] dark:text-white mb-6">
                  {course.price}
                </div>

                <Button
                  onClick={handleBookCourse}
                  disabled={isBooking}
                  className="w-full h-14 bg-[#1099A1] hover:bg-[#0d848b] text-white text-[16px] font-bold rounded-xl mb-4 transition-all hover:shadow-lg hover:shadow-[#1099A1]/20"
                >
                  {isBooking ? "Booking Course..." : "Book Course"}
                </Button>

                <p className="text-[12px] text-center text-[#54656f] dark:text-[#aebac1]">
                  30-Day Money-Back Guarantee
                </p>

                <div className="w-full h-px bg-[#e9edef] dark:bg-[#2a3942] my-6" />

                <h4 className="text-[14px] font-bold text-[#111] dark:text-white mb-4">This course includes:</h4>
                <ul className="space-y-3 text-[13px] text-[#54656f] dark:text-[#aebac1]">
                  <li className="flex items-center gap-3"><PlayCircle size={16} /> 24 hours on-demand video</li>
                  <li className="flex items-center gap-3"><Users size={16} /> 1-on-1 tutoring sessions</li>
                  <li className="flex items-center gap-3"><Clock size={16} /> Full lifetime access</li>
                </ul>
              </div>
            </div>

            {/* Tutor Info */}
            <div className="bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-[24px] p-6 shadow-sm">
              <h3 className="text-[16px] font-bold text-[#111] dark:text-white mb-4">About the Tutor</h3>
              <div className="flex items-start gap-4">
                <img src={course.tutor.avatar} alt={course.tutor.name} className="w-16 h-16 rounded-full border-4 border-[#f8f9fa] dark:border-[#182329]" />
                <div>
                  <h4 className="text-[15px] font-bold text-[#111] dark:text-white">{course.tutor.name}</h4>
                  <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] mt-2 leading-relaxed">
                    {course.tutor.bio}
                  </p>
                  <Button variant="outline" className="mt-4 h-8 text-[12px] border-[#e9edef] dark:border-[#2a3942]">View Profile</Button>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
