import { MapPin, Mail, Phone } from "lucide-react";
import { toast } from "react-hot-toast";
import Reveal from "@/components/Reveal";
import imgTeam1 from "@/assets/images/team-eyasu.webp";
import imgTeam2 from "@/assets/images/team-daniel.webp";
import imgTeam3 from "@/assets/images/team-bethlehem.webp";

const contactInfo = [
  { label: "Address:", value: "123 Design Street, New York, United States", icon: <MapPin size={18} strokeWidth={2} /> },
  { label: "Email:", value: "contact@yamaleducation.com", icon: <Mail size={18} strokeWidth={2} /> },
  { label: "Phone:", value: "+1 (800) 123-4567", icon: <Phone size={18} strokeWidth={2} /> },
];

export default function Contact() {
  return (
    <div id="contact" className="w-full max-w-[1290px] px-[24px] md:px-[18px]">
      <Reveal><h2 className="text-[40px] md:text-[76px] font-medium leading-[48px] md:leading-[86px] text-center mb-[40px] md:mb-[70px]">Contact Us</h2></Reveal>
      <div className="rounded-[20px] md:rounded-[30px] p-[24px] md:p-[56px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[40px] md:gap-[80px]">
          {/* Form */}
          <form className="space-y-[20px] md:space-y-[24px]" onSubmit={(e) => { e.preventDefault(); toast.success("Message sent! We'll be in touch soon."); (e.target as HTMLFormElement).reset(); }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] md:gap-[32px]">
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">First Name*</label>
                <input type="text" placeholder="First name" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Last Name*</label>
                <input type="text" placeholder="Last name" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] md:gap-[32px]">
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Email Address*</label>
                <input type="email" placeholder="Email address" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Phone</label>
                <input type="tel" placeholder="Phone number" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
            </div>
            <div>
              <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Subject</label>
              <input type="text" placeholder="Write your subject" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
            </div>
            <div>
              <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Message</label>
              <textarea placeholder="Write your messages" rows={5} className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[16px] rounded-[16px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition resize-none"></textarea>
            </div>
            <button type="submit" className="bg-[#1099a1] px-[40px] md:px-[60px] py-[14px] md:py-[15px] rounded-[500px] text-white text-[16px] md:text-[18px] uppercase hover:bg-[#0d7d84] transition mx-auto block">
              Submit Now
            </button>
          </form>

          {/* Right side */}
          <div className="flex flex-col">
            {/* Overlapping avatars */}
            <div className="flex items-center mb-[20px]">
              {[imgTeam3, imgTeam1, imgTeam2].map((img, i) => (
                <div
                  key={i}
                  className="w-[52px] h-[52px] md:w-[60px] md:h-[60px] rounded-full overflow-hidden border-[3px] border-white"
                  style={{ marginLeft: i === 0 ? 0 : "-16px", zIndex: i }}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <p className="text-[#4a4a4a] text-[15px] md:text-[16px] leading-[24px] mb-[32px] md:mb-[48px]">
              Whether you have questions about our services, need assistance with a project, or want to discuss.
            </p>

            <h3 className="text-[16px] md:text-[18px] font-semibold mb-[20px] md:mb-[28px]">Get in Touch:</h3>
            <div className="space-y-[20px] md:space-y-[24px]">
              {contactInfo.map((item, i) => (
                <div key={i} className="flex gap-[16px] md:gap-[20px] items-start">
                  <div className="w-[44px] h-[44px] md:w-[52px] md:h-[52px] bg-[#f4f4f4] rounded-full flex items-center justify-center shrink-0 text-[#4a4a4a]">
                    {item.icon}
                  </div>
                  <div className="pt-[2px]">
                    <p className="text-[15px] md:text-[17px] font-medium mb-[2px]">{item.label}</p>
                    <p className="text-[#4a4a4a] text-[14px] md:text-[15px] leading-[22px]">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
