import Reveal from "@/components/Reveal";
import TestimonialCarousel, { type Testimonial } from "@/components/TestimonialCarousel";
import imgUser1 from "@/assets/images/testimonial-david.png";
import imgUser5 from "@/assets/images/testimonial-sarah.png";
import imgUser6 from "@/assets/images/testimonial-ellyse.png";

const items: Testimonial[] = [
  { name: "David Warner", text: "Yakal's tutoring completely changed my approach to learning. I was struggling with Algebra, but my tutor broke concepts into easy-to-understand steps.", img: imgUser1 },
  { name: "Sarah Taylor", text: "I used to struggle with Physics and Calculus, but Yakal made these subjects understandable and even enjoyable. The personalized approach meant I was always working on my weaknesses.", img: imgUser5 },
  { name: "Ellyse Perry", text: "I loved how flexible Yakal's sessions were. Each lesson was tailored to my pace and learning style. I finally feel like I'm learning efficiently and achieving real results.", img: imgUser6 },
];

export default function Testimonials() {
  return (
    <div className="bg-[#1099a1] rounded-[20px] md:rounded-[30px] py-[48px] md:py-[100px] px-[24px] md:px-[55px] w-full max-w-[1440px] overflow-hidden">
      <div className="max-w-[1290px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-[24px] mb-[40px] md:mb-[70px]">
          <h2 className="text-white text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px] md:max-w-[520px]">
            What Our Students Say
          </h2>
          <p className="text-white text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] md:max-w-[494px]">
            Real stories of improved grades, confidence, and learning experiences with Yakal.
          </p>
        </div>

        {/* Mobile: swipeable carousel */}
        <div className="md:hidden">
          <TestimonialCarousel items={items} />
        </div>
        <div className="hidden md:grid grid-cols-3 gap-[30px]">
          {items.map((testimonial, idx) => (
            <Reveal key={idx} delay={idx * 100}>
              <div className="bg-white rounded-[30px] p-[30px] flex flex-col gap-[32px]">
                <p className="text-[#4a4a4a] text-[18px] leading-[30px]">{testimonial.text}</p>
                <div className="flex gap-[16px] items-center">
                  <div className="w-[64px] h-[64px] rounded-full overflow-hidden bg-[#f3f3f3] shrink-0">
                    <img src={testimonial.img} alt={testimonial.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-[18px] font-medium">{testimonial.name}</p>
                    <p className="text-[#4a4a4a] text-[14px]">Pro Member</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
