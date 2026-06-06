import { ArrowRight } from "lucide-react";
import imgPrograms1 from "@/assets/images/resource-book-session.png";
import imgPrograms3 from "@/assets/images/resource-blogs.png";

export default function ParentResources({ scrollTo }: { scrollTo: (id: string) => void }) {
  return (
    <div id="resources" className="w-full max-w-[1440px]">
      <div className="max-w-[1290px] mx-auto px-[24px] md:px-[18px]">
        <div className="text-center mb-[40px] md:mb-[70px]">
          <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px] mb-[12px] md:mb-[16px]">Parent Resources</h2>
          <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px]">
            Helpful tools and tips to guide your student's learning journey.
          </p>
        </div>

        {/* Book a Session */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-[32px] mb-[60px] md:mb-[70px]">
          <div className="w-full md:max-w-[520px]">
            <p className="text-[22px] md:text-[26px] font-medium mb-[12px]">[01]</p>
            <h3 className="text-[36px] md:text-[56px] font-medium leading-[44px] md:leading-[66px] mb-[16px]">Book a Session</h3>
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[32px]">
              Schedule a one-on-one tutoring session with our expert instructors. Choose the time, subject, and learning mode that works best for your student.
            </p>
            <button className="border-2 border-[#1099a1] text-[#1099a1] px-[28px] py-[14px] rounded-[500px] text-[16px] md:text-[18px] uppercase hover:bg-[#1099a1] hover:text-white transition flex items-center gap-[8px]">
              Book a Session <ArrowRight size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="w-full md:w-[630px] h-[280px] md:h-[530px] rounded-[20px] md:rounded-[30px] overflow-hidden">
            <img src={imgPrograms1} alt="Book a Session" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Blogs */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-[32px]">
          <div className="w-full md:max-w-[520px]">
            <p className="text-[22px] md:text-[26px] font-medium mb-[12px]">[02]</p>
            <h3 className="text-[36px] md:text-[56px] font-medium leading-[44px] md:leading-[66px] mb-[16px]">Blogs</h3>
            <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[32px]">
              Explore our collection of articles and guides designed for parents and students. Get tips on study strategies and academic growth.
            </p>
            <button onClick={() => scrollTo("blog")} className="border-2 border-[#1099a1] text-[#1099a1] px-[28px] py-[14px] rounded-[500px] text-[16px] md:text-[18px] uppercase hover:bg-[#1099a1] hover:text-white transition flex items-center gap-[8px]">
              See All Blogs <ArrowRight size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="w-full md:w-[630px] h-[280px] md:h-[530px] rounded-[20px] md:rounded-[30px] overflow-hidden">
            <img src={imgPrograms3} alt="Blogs" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
}
