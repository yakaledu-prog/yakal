import Reveal from "@/components/Reveal";
import imgTeam1 from "@/assets/images/team-eyasu.png";
import imgTeam2 from "@/assets/images/team-daniel.png";
import imgTeam3 from "@/assets/images/team-bethlehem.png";
import imgTeam4 from "@/assets/images/team-hana.png";

const members = [
  { name: "Eyasu (Josh)", subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", img: imgTeam1 },
  { name: "Daniel", subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", img: imgTeam2 },
  { name: "Bethlehem", subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", img: imgTeam3 },
  { name: "Hana", subjects: "Physics | Geometry 1 & 2 | Algebra 1 & 2", img: imgTeam4 },
];

export default function Team() {
  return (
    <div className="w-full max-w-[1440px] py-[10px]">
      <Reveal className="text-center mb-[40px] md:mb-[70px]">
        <p className="text-[#acacac] text-[16px] md:text-[20px] font-semibold uppercase mb-[12px] md:mb-[16px]">Yakal Tutor</p>
        <h2 className="text-[32px] md:text-[56px] font-medium leading-[40px] md:leading-[66px]">Our Team</h2>
      </Reveal>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] md:gap-[30px] px-[12px] md:px-[10px]">
        {members.map((member, idx) => (
          <Reveal key={idx} delay={idx * 80}>
            <div className="bg-white rounded-tl-[20px] rounded-tr-[20px] md:rounded-tl-[30px] md:rounded-tr-[30px] border border-[#eaecf0] overflow-hidden">
              <div className="bg-[#a4d5f0] h-[160px] md:h-[230px] overflow-hidden">
                <img src={member.img} alt={member.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-[12px] md:p-[16px] text-center">
                <h4 className="text-[15px] md:text-[18px] font-semibold mb-[6px] md:mb-[8px]">{member.name}</h4>
                <p className="text-[#4a4a4a] text-[12px] md:text-[14px] leading-[20px] md:leading-[22px]">{member.subjects}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
