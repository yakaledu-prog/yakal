import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import imgPrograms1 from "@/assets/images/landing-page/book-session.webp";
import imgPrograms3 from "@/assets/images/landing-page/parent-resources.webp";

export default function ParentResources() {
  const navigate = useNavigate();

  return (
    <div id="resources" className="w-full max-w-[1140px] py-[60px]">
      <div className="max-w-[1290px] mx-auto px-[24px] md:px-[18px]">
        <div className="text-center mb-[40px] md:mb-[70px]">
          <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px] mb-[12px] md:mb-[16px]">Parent Resources</h2>
          <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px]">
            Helpful tools and tips to guide your student's learning journey.
          </p>
        </div>

        {/* Book a Session */}
        {/* On a phone the image leads and the copy follows, matching Blogs
            below. Stacked the other way the heading and the button sat a
            screen apart with the picture wedged between them. */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-[32px] mb-[70px] md:mb-[105px] text-justify">
          <div className="order-2 md:order-1 w-full md:max-w-[520px] flex flex-col items-center md:items-start">
            <h3 className="text-[36px] md:text-[56px] font-medium leading-[44px] md:leading-[66px] mb-[16px]">Book a Session</h3>
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[32px] text-center md:text-left">
              Schedule a one-on-one tutoring session with our expert instructors. Choose the time, subject, and learning mode that works best for your student.
            </p>
            <button onClick={() => window.open('https://calendly.com/binyammamo01/parent-counseling-session', '_blank')} className="btn-shimmer text-white px-[28px] py-[14px] rounded-[500px] text-[16px] md:text-[18px] uppercase shadow-lg hover:opacity-90 transition-opacity flex items-center gap-[8px]">
              Book a Session <ArrowRight size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="order-1 md:order-2 overflow-hidden flex items-center justify-center md:justify-end">
            <img src={imgPrograms1} alt="Book a Session" className="h-[70%] rounded-xl object-cover" />
          </div>
        </div>

        {/* Blogs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-[32px]">
          <div className="overflow-hidden">
            <img src={imgPrograms3} alt="Blogs" className="h-[70%] rounded-xl object-cover" />
          </div>
          <div className="w-full md:max-w-[520px] flex items-center md:items-start flex-col">
            <h3 className="text-[36px] md:text-[56px] font-medium leading-[44px] md:leading-[66px] mb-[16px]">Blogs</h3>
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[32px] text-center md:text-left">
              Explore our collection of articles and guides designed for parents and students. Get tips on study strategies and academic growth.
            </p>
            {/* The full archive, not the three latest further down the page. */}
            <button onClick={() => navigate("/posts")} className="btn-shimmer text-white px-[28px] py-[14px] rounded-[500px] text-[16px] md:text-[18px] uppercase shadow-lg hover:opacity-90 transition-opacity flex items-center gap-[8px]">
              See All Blogs <ArrowRight size={18} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
