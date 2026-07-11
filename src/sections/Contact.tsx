import { MapPin, Mail, Phone } from "lucide-react";
import { toast } from "react-toastify";
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
          <form className="space-y-[20px] md:space-y-[24px]" onSubmit={async (e) => { 
            e.preventDefault(); 
            const form = e.currentTarget as HTMLFormElement;
            const formData = new FormData(form);
            const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
            const originalText = submitBtn.innerText;
            
            try {
              submitBtn.innerText = "Sending...";
              submitBtn.disabled = true;

              // Use local API in dev, or relative path in production if deployed to Vercel
              const apiUrl = import.meta.env.DEV ? "http://localhost:3001/api/contact" : "/api/contact";
              
              const res = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  firstName: formData.get("firstName"),
                  lastName: formData.get("lastName"),
                  email: formData.get("email"),
                  phone: formData.get("phone"),
                  subject: formData.get("subject"),
                  message: formData.get("message"),
                }),
              });

              if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to send message");
              }

              toast.success("Message sent! We'll be in touch soon."); 
              form.reset(); 
            } catch (err: any) {
              toast.error(err.message || "An error occurred. Please try again.");
            } finally {
              submitBtn.innerText = originalText;
              submitBtn.disabled = false;
            }
          }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] md:gap-[32px]">
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">First Name*</label>
                <input name="firstName" required type="text" placeholder="First name" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Last Name*</label>
                <input name="lastName" required type="text" placeholder="Last name" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px] md:gap-[32px]">
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Email Address*</label>
                <input name="email" required type="email" placeholder="Email address" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
              <div>
                <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Phone</label>
                <input name="phone" type="tel" placeholder="Phone number" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
              </div>
            </div>
            <div>
              <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Subject</label>
              <input name="subject" type="text" placeholder="Write your subject" className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[19px] rounded-[500px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition" />
            </div>
            <div>
              <label className="block text-[15px] md:text-[18px] font-semibold mb-[10px] md:mb-[16px]">Message*</label>
              <textarea name="message" required placeholder="Write your messages" rows={5} className="w-full px-[20px] md:px-[26px] py-[14px] md:py-[16px] rounded-[16px] border border-[#d9d9d9] bg-white text-[15px] outline-none focus:border-[#1099a1] transition resize-none"></textarea>
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
