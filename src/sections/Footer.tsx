import { useState } from "react";
import { Facebook, Instagram, Twitter, Linkedin } from "lucide-react";
import { toast } from "react-toastify";
import logo from "@/assets/images/logo.webp";

const quickLinks = [
  { label: "Home", id: "home" },
  { label: "About Us", id: "about" },
  { label: "Courses", id: "courses" },
  { label: "Blog", id: "blog" },
  { label: "Contact", id: "contact" },
];

const socials = [
  { href: "#facebook", icon: <Facebook size={15} strokeWidth={2} /> },
  { href: "#instagram", icon: <Instagram size={15} strokeWidth={2} /> },
  { href: "#twitter", icon: <Twitter size={15} strokeWidth={2} /> },
  { href: "#linkedin", icon: <Linkedin size={15} strokeWidth={2} /> },
];

export default function Footer({ scrollTo }: { scrollTo: (id: string) => void }) {
  const [email, setEmail] = useState("");

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    toast.success("Thanks for joining our newsletter.");
    setEmail("");
  }

  return (
    <footer id="footer" className="bg-black text-white rounded-[20px] md:rounded-[30px] px-[24px] md:px-[73px] py-[40px] pb-[20px] md:py-[60px] md:pb-[20px] w-full max-w-[1440px]">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-[40px] mb-[48px] md:mb-[80px]">
        <div className="col-span-2 md:col-span-1">
          <div className="w-[110px] h-[40px] md:w-[120px] md:h-[47px]">
            <img alt="Yakal" className="w-full h-full object-cover" src={logo} />
          </div>
        </div>

        <div>
          <h4 className="text-[16px] md:text-[20px] font-semibold mb-[16px] md:mb-[24px]">Quick Links</h4>
          <nav className="space-y-[12px] md:space-y-[16px]">
            {quickLinks.map((link) => (
              <button key={link.id} onClick={() => scrollTo(link.id)} className="block text-[rgba(255,255,255,0.75)] hover:text-white bg-transparent border-none cursor-pointer text-[14px] md:text-[16px]">
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          <h4 className="text-[16px] md:text-[20px] font-semibold mb-[16px] md:mb-[24px]">Location</h4>
          <p className="text-[rgba(255,255,255,0.75)] text-[13px] md:text-[16px] leading-[24px] md:leading-[28px] mb-[12px]">
            <strong className="text-white">Address:</strong> 123 Design Street, New York, United States
          </p>
          <p className="text-[rgba(255,255,255,0.75)] text-[13px] md:text-[16px] leading-[24px] md:leading-[28px] mb-[12px]">
            <strong className="text-white">Phone:</strong> +1 (123) 456-7890
          </p>
          <p className="text-[rgba(255,255,255,0.75)] text-[13px] wrap-anywhere md:text-[16px] leading-[24px] md:leading-[28px]">
            <strong className="text-white">Email:</strong> contact@yamaleducation.com
          </p>
        </div>

        <div className="col-span-2 md:col-span-2 md:ml-18">
          <h4 className="text-[16px] md:text-[20px] font-semibold mb-[16px] md:mb-[24px]">Subscribe Our Newsletter</h4>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-[10px]">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-[14px] py-[12px] rounded-[500px] bg-[rgba(255,255,255,0.2)] border-none text-white placeholder:text-[rgba(255,255,255,0.75)] text-[14px] outline-none focus:bg-[rgba(255,255,255,0.28)] transition-colors"
            />
            <button type="submit" className="bg-[#1099a1] px-[20px] py-[12px] rounded-[500px] uppercase hover:bg-[#0d7d84] transition text-[14px] whitespace-nowrap">Subscribe</button>
          </form>
        </div>
      </div>

      <div className="border-b-2 border-[rgba(255,255,255,0.1)] pb-[24px] md:pb-[32px] flex flex-col md:flex-row justify-between items-center gap-[16px]">
        <div className="flex flex-wrap items-center justify-center gap-[24px] md:gap-[32px] text-[rgba(255,255,255,0.75)] text-[13px] md:text-[16px]">
          <a href="#terms" className="hover:text-white">Terms & Conditions</a>
          <a href="#privacy" className="hover:text-white">Privacy Policy</a>
          <a href="#cookies" className="hover:text-white">Cookie Preferences</a>
        </div>
        <div className="flex gap-[10px] md:gap-[12px]">
          {socials.map(({ href, icon }) => (
            <a key={href} href={href} className="w-[34px] h-[34px] md:w-[38px] md:h-[38px] rounded-full border border-[rgba(255,255,255,0.3)] flex items-center justify-center hover:bg-[rgba(255,255,255,0.1)] transition text-white">
              {icon}
            </a>
          ))}
        </div>
      </div>

      <p className="text-center text-[rgba(255,255,255,0.75)] text-[13px] md:text-[16px] mt-[24px] md:mt-[32px]">
        &#169; 2025 Company all rights reserved.
      </p>
    </footer>
  );
}
