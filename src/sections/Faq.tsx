import { useState } from "react";
import Reveal from "@/components/Reveal";
import FaqItem, { type Faq } from "@/components/FaqItem";

const faqs: Faq[] = [
  { q: "How do I select appropriate courses?", a: "Our tutors assess each student's current level and academic goals to recommend the most appropriate courses. You can also schedule a free consultation to discuss options." },
  { q: "How can I meet my coach?", a: "You can schedule an introductory session online or in-person to meet your assigned coach, discuss learning goals, and set up a personalized plan." },
  { q: "What is the eligibility to do online courses?", a: "Any student from middle school through college is welcome. All you need is a reliable internet connection, a device with a camera, and a willingness to learn." },
  { q: "How do I buy study materials?", a: "Most study materials are provided digitally by your tutor at no extra cost. For specialized test prep materials, your tutor will guide you to the best resources." },
  { q: "How do I reschedule my class?", a: "You can reschedule a session up to 24 hours in advance through our booking platform or by contacting your tutor directly." },
];

export default function Faq({ scrollTo }: { scrollTo: (id: string) => void }) {
  const [openFaq, setOpenFaq] = useState<number | null>(1);

  return (
    <div className="bg-[#f4f4f4] rounded-[20px] md:rounded-[30px] px-[16px] sm:px-[24px] md:px-[73px] py-[60px] md:py-[130px] w-full max-w-[1440px] overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between gap-[40px] md:gap-[80px] w-full min-w-0">
        <Reveal className="w-full md:w-[380px] lg:w-[460px] md:shrink-0 min-w-0">
          <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px] mb-[16px]">
            Frequently Asked Questions
          </h2>
          <p className="text-[#4a4a4a] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[32px] md:mb-[48px]">
            Get answers to common queries about our tutoring services, scheduling, and learning approach.
          </p>
          <button onClick={() => scrollTo("contact")} className="bg-[#1099a1] px-[40px] md:px-[60px] py-[14px] md:py-[15px] rounded-[500px] text-white text-[16px] md:text-[18px] uppercase hover:bg-[#0d7d84] transition">
            Contact us
          </button>
        </Reveal>

        {/* Accordion column - flex-1 so it never exceeds available space */}
        <div className="w-full min-w-0 overflow-hidden md:flex-1 md:max-w-[630px] space-y-[16px] md:space-y-[28px]">
          {faqs.map((faq, idx) => (
            <FaqItem
              key={idx}
              faq={faq}
              isOpen={openFaq === idx}
              onToggle={() => setOpenFaq(openFaq === idx ? null : idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
