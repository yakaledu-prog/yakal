import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Reveal from "@/components/Reveal";
import Carousel from "@/components/Carousel";
import imgTeam1 from "@/assets/images/team-eyasu.webp";
import imgTeam2 from "@/assets/images/team-daniel.webp";
import imgTeam3 from "@/assets/images/team-bethlehem.webp";
import imgTeam4 from "@/assets/images/team-hana.webp";

type Member = { name: string; subjects: string; img: string; details: string };

const members: Member[] = [
  { 
    name: "Eyasu (Josh)", 
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", 
    img: imgTeam1,
    details: "Eyasu holds a deep passion for the sciences and mathematics. With years of experience guiding students through complex concepts, he focuses on practical problem-solving and building strong foundational understanding that helps students excel not just in exams, but in their overall academic journeys."
  },
  { 
    name: "Daniel", 
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", 
    img: imgTeam2,
    details: "Daniel specializes in making advanced mathematics and physics accessible and engaging. He adapts his teaching methods to match each student's unique learning style, ensuring that even the most challenging topics become clear, intuitive, and manageable."
  },
  { 
    name: "Bethlehem", 
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", 
    img: imgTeam3,
    details: "Bethlehem is dedicated to empowering students by building their confidence in STEM subjects. Her patient, step-by-step approach breaks down difficult algebraic and physical principles, fostering a supportive environment where students feel comfortable asking questions and making mistakes."
  },
  { 
    name: "Hana", 
    subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", 
    img: imgTeam4,
    details: "Hana brings a dynamic and highly interactive approach to tutoring. By connecting theoretical physics and geometry to real-world scenarios, she helps students see the 'why' behind the math, dramatically improving both retention and genuine interest in the subjects."
  },
];

function TeamCard({ member }: { member: Member }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-tl-[20px] rounded-tr-[20px] md:rounded-[30px] border border-[#eaecf0] overflow-hidden flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-[#a4d5f0] h-[240px] md:h-[230px] overflow-hidden shrink-0">
        <img src={member.img} alt={member.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-[16px] md:p-[20px] text-center flex flex-col flex-grow">
        <h4 className="text-[16px] md:text-[18px] font-bold mb-[6px] md:mb-[8px] text-[#111]">{member.name}</h4>
        <p className="text-[#1099A1] font-medium text-[12px] md:text-[14px] mb-3">{member.subjects}</p>
        
        {/* Animated Accordion for Details */}
        <div 
          className={`grid transition-all duration-300 ease-in-out ${
            expanded ? 'grid-rows-[1fr] opacity-100 mb-4 mt-2' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <p className="text-[13px] md:text-[14px] text-[#555] leading-relaxed text-left border-t border-gray-100 pt-3">
              {member.details}
            </p>
          </div>
        </div>

        <div className="mt-auto pt-2">
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="flex items-center justify-center gap-[6px] w-full text-[13px] md:text-[14px] font-semibold text-[#54656f] hover:text-[#1099A1] transition-colors py-2 rounded-lg bg-gray-50 hover:bg-[#1099a1]/5"
          >
            {expanded ? "Show Less" : "Read Full Bio"}
            <ChevronDown size={16} className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Team() {
  return (
    <div className="w-full max-w-[1440px] py-[10px]">
      <Reveal className="text-center mb-[40px] md:mb-[70px]">
        <p className="text-[#acacac] text-[16px] md:text-[20px] font-semibold uppercase mb-[12px] md:mb-[16px]">Yakal Tutor</p>
        <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px]">Our Team</h2>
      </Reveal>

      {/* Mobile: one card per view, infinite carousel */}
      <div className="md:hidden px-[40px]">
        <Carousel slides={members.map((member, idx) => (<TeamCard key={idx} member={member} />))} />
      </div>

      {/* Desktop: 4-column grid */}
      <div className="hidden md:grid grid-cols-4 gap-[30px] px-[10px] items-start">
        {members.map((member, idx) => (
          <Reveal key={idx} delay={idx * 80}>
            <TeamCard member={member} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
