import Navbar from "@/components/Navbar";
import { openBooking } from "@/config/links";
import imgHeader1 from "@/assets/images/landing-page/hero-cover.jpg";

export default function Hero({ onNav }: { onNav: (id: string) => void }) {
  return (
    <div id="home" className="relative rounded-[20px] md:rounded-[30px] rounded-t-none w-full max-w-[1440px]">
      <div className="absolute inset-0 pointer-events-none rounded-[20px] md:rounded-[30px] rounded-t-none">
        {/* <div className="absolute inset-0 overflow-hidden rounded-[20px] md:rounded-[30px]">
          <img alt="" className="absolute h-full left-0 max-w-none top-0 w-full object-cover" src={imgHeader} />
        </div> */}
        <img alt="" className="absolute max-w-none object-cover rounded-[20px] md:rounded-[30px] rounded-t-none size-full" src={imgHeader1} />
        <div className="absolute bg-gradient-to-r from-black/80 via-black/40 to-transparent inset-0 rounded-[20px] md:rounded-[30px] rounded-t-none" />
      </div>

      <div className="relative flex flex-col items-start py-[20px]">
        <Navbar onNav={onNav} />

        {/* Hero */}
        <div className="max-w-[700px] pt-[60px] md:pt-[120px] pb-[60px] md:pb-[140px] px-[24px] md:px-[73px]">
          <h1 className="text-white text-[36px] md:text-[56px] font-semibold leading-[46px] md:leading-[66px] mb-[20px] md:mb-[26px]">
            Personalized Tutoring for Students Who Want to Excel
          </h1>
          <p className="text-white/90 text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[32px] md:mb-[48px] max-w-[550px]">
            One-on-one academic support designed to help students excel in Math, Science, and SAT prep with flexible online and in-person options tailored to every learning style.
          </p>
          <button onClick={openBooking} className="btn-shimmer px-[25px] md:px-[35px] py-[12px] md:py-[15px] rounded-[500px] text-white text-[14px] md:text-[16px] uppercase shadow-lg hover:opacity-90 transition-opacity">
            Book a Free Consultation
          </button>
        </div>
      </div>
    </div>
  );
}
