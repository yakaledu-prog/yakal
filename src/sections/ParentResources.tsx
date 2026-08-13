import { ArrowRight } from "lucide-react";
import { useSiteSettings, openBookingUrl } from "@/hooks/useSiteSettings";
import { useNavigate } from "react-router-dom";
import { cn } from "@/utils/cn";
import imgPrograms1 from "@/assets/images/landing-page/book-session.webp";
import imgPrograms3 from "@/assets/images/landing-page/parent-resources.webp";

export default function ParentResources() {
  const { bookingUrl } = useSiteSettings();
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

        {/* Two feature rows sharing one treatment, so the section reads as a
            pair rather than two loosely stacked blocks: a framed image with a
            soft brand-tinted shadow, an eyebrow, and copy centred against it.
            They alternate side on desktop; on a phone the image always leads. */}
        <div className="flex flex-col gap-[64px] md:gap-[110px]">
          {/* Book a session: copy left, image right on desktop. */}
          <FeatureRow
            eyebrow="One-on-one tutoring"
            title="Book a free session"
            body="Schedule a one-on-one tutoring session with our expert instructors. Choose the time, subject, and learning mode that works best for your student."
            cta="Book a free session"
            onCta={() => openBookingUrl(bookingUrl)}
            image={imgPrograms1}
            imageAlt="Book a session"
            imageSide="right"
          />

          {/* Blogs: image left, copy right on desktop. */}
          <FeatureRow
            eyebrow="Guides for parents"
            title="Blogs"
            body="Explore our collection of articles and guides written for parents and students, from study strategies at home to navigating academic growth."
            cta="See all blogs"
            onCta={() => navigate("/posts")}
            image={imgPrograms3}
            imageAlt="Yakal blog"
            imageSide="left"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One image-and-copy feature. The image is framed the same way each time - a
 * 4:3 crop, a generous radius and a soft teal-tinted shadow - so the two rows
 * feel like one system. The image leads on a phone; on desktop it sits on the
 * side asked for and the copy centres against it.
 */
function FeatureRow({
  eyebrow,
  title,
  body,
  cta,
  onCta,
  image,
  imageAlt,
  imageSide,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
  image: string;
  imageAlt: string;
  imageSide: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-[32px] md:gap-[72px]",
        imageSide === "right" ? "md:flex-row-reverse" : "md:flex-row"
      )}
    >
      <div className="w-full md:flex-1 md:max-w-[520px]">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-[28px] shadow-[0_24px_60px_-24px_rgba(16,153,161,0.45)]">
          <img src={image} alt={imageAlt} className="h-full w-full object-cover" />
        </div>
      </div>

      <div className="flex w-full flex-col items-center text-center md:flex-1 md:max-w-[520px] md:items-start md:text-left">
        <span className="mb-[14px] text-[13px] font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </span>
        <h3 className="mb-[16px] text-[36px] md:text-[52px] font-medium leading-[44px] md:leading-[60px]">
          {title}
        </h3>
        <p className="mb-[32px] max-w-[480px] text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] text-[#4a4a4a]">
          {body}
        </p>
        <button
          onClick={onCta}
          className="btn-shimmer flex items-center gap-[8px] rounded-[500px] px-[28px] py-[14px] text-[16px] md:text-[18px] uppercase text-white shadow-lg transition-opacity hover:opacity-90"
        >
          {cta} <ArrowRight size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
