import { Instagram, Linkedin } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import logo from "@/assets/images/logo.webp";
import NewsletterSignup from "@/components/NewsletterSignup";

const quickLinks = [
  { label: "Home", id: "home" },
  { label: "About Us", id: "about" },
  { label: "Courses", id: "courses" },
  { label: "Blogs", id: "blogs" },
  { label: "Contact", id: "contact" },
];

// The LinkedIn link is the public company page, not the /admin/dashboard URL
// the page owner sees: that one only opens for admins and leaks the admin path.
/** The icons. The addresses come from settings, so they are editable. */
const SOCIAL_ICONS = {
  instagram: { label: "Instagram", icon: <Instagram size={15} strokeWidth={2} /> },
  x: { label: "X", icon: <XIcon size={14} /> },
  linkedin: { label: "LinkedIn", icon: <Linkedin size={15} strokeWidth={2} /> },
} as const;
import { useNavigate } from "react-router-dom";
// Contact and social addresses come from admin-editable site settings (kept
// from main), while the newsletter box is the branch's standalone
// NewsletterSignup component - so the old inline email state and
// subscribeToNewsletter are gone.
import { useSiteSettings } from "@/hooks/useSiteSettings";
export default function Footer({ scrollTo }: { scrollTo: (id: string) => void }) {
  const { contact: CONTACT, social } = useSiteSettings();

  const socials = (Object.keys(SOCIAL_ICONS) as (keyof typeof SOCIAL_ICONS)[])
    .map((k) => ({ ...SOCIAL_ICONS[k], href: social[k] }))
    .filter((s) => s.href);
  const navigate = useNavigate();

  return (
    <footer id="footer" className="bg-black text-white rounded-[20px] rounded-b-none md:rounded-[30px] px-[24px] md:px-[73px] py-[40px] pt-[20px] pb-[20px] md:py-[60px] md:pb-[20px] w-full max-w-[1440px]">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-[40px] mb-[48px] md:mb-[80px]">
        <div className="hidden md:block md:col-span-1">
          <div className="h-[40px] md:w-[120px] md:h-[47px]">
            <img alt="Yakal" className="w-full h-full object-cover" src={logo} />
          </div>
        </div>

        <div>
          <h4 className="text-[16px] md:text-[20px] font-semibold mb-[16px] md:mb-[24px]">Quick Links</h4>
          <nav className="space-y-[12px] md:space-y-[16px]">
            {quickLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  if (link.id === "blogs") {
                    navigate("/posts");
                  } else {
                    scrollTo(link.id);
                  }
                }}
                className="block text-[rgba(255,255,255,0.75)] hover:text-white bg-transparent border-none cursor-pointer text-[14px] md:text-[16px]"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        <div>
          <h4 className="text-[16px] md:text-[20px] font-semibold mb-[16px] md:mb-[24px]">Location</h4>
          <p className="text-[rgba(255,255,255,0.75)] text-[13px] md:text-[16px] leading-[24px] md:leading-[28px] mb-[12px]">
            <strong className="text-white">Address:</strong> {CONTACT.address}
          </p>
          <p className="text-[rgba(255,255,255,0.75)] text-[13px] md:text-[16px] leading-[24px] md:leading-[28px] mb-[12px]">
            <strong className="text-white">Phone:</strong> {CONTACT.phone}
          </p>
          <p className="text-[rgba(255,255,255,0.75)] text-[13px] wrap-anywhere md:text-[16px] leading-[24px] md:leading-[28px]">
            <strong className="text-white">Email:</strong> <a href={`mailto:${CONTACT.email}`} className="text-primary">{CONTACT.email}</a>
          </p>
        </div>

        <div className="col-span-2 md:col-span-2 md:ml-18">
          <h4 className="text-[16px] md:text-[20px] font-semibold mb-[16px] md:mb-[24px]">Subscribe Our Newsletter</h4>
          <NewsletterSignup />
        </div>
      </div>

      <div className="border-b-2 border-[rgba(255,255,255,0.1)] pb-[24px] md:pb-[32px] flex flex-col md:flex-row justify-between items-center gap-[16px]">
        <div className="flex flex-wrap items-center justify-center gap-[24px] md:gap-[32px] text-[rgba(255,255,255,0.75)] text-[13px] md:text-[16px]">
          <a href="/terms" className="hover:text-white">Terms & Conditions</a>
          <a href="/privacy" className="hover:text-white">Privacy Policy</a>
          <a href="/cookies" className="hover:text-white">Cookie Preferences</a>
          <a href="/cancellation-policy" className="hover:text-white">Cancellation Policy</a>
        </div>
        <div className="flex gap-[10px] md:gap-[12px]">
          {socials.map(({ href, label, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="w-[34px] h-[34px] md:w-[38px] md:h-[38px] rounded-full ring ring-[rgba(255,255,255,0.3)] flex items-center justify-center hover:bg-[rgba(255,255,255,0.1)] transition text-white"
            >
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
