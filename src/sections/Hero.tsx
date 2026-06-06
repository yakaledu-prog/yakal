import Navbar from "@/components/Navbar";
import imgHeader1 from "@/assets/images/hero-overlay.png";

export default function Hero({ onNav }: { onNav: (id: string) => void }) {
  return (
    <div id="home" className="relative rounded-[20px] md:rounded-[30px] w-full max-w-[1440px]">
      <div className="absolute inset-0 pointer-events-none rounded-[20px] md:rounded-[30px]">
        {/* <div className="absolute inset-0 overflow-hidden rounded-[20px] md:rounded-[30px]">
          <img alt="" className="absolute h-full left-0 max-w-none top-0 w-full object-cover" src={imgHeader} />
        </div> */}
        <img alt="" className="absolute max-w-none object-cover rounded-[20px] rounded-t-[0px] md:rounded-[30px] size-full" src={imgHeader1} />
        <div className="absolute bg-gradient-to-b from-[rgba(0,0,0,0)] inset-0 rounded-[20px] md:rounded-[30px] to-[rgba(0,0,0,0.87)]" />
      </div>

      <div className="relative flex flex-col items-start px-[24px] md:px-[73px] py-[20px]">
        <Navbar onNav={onNav} />

        {/* Hero */}
        <div className="max-w-[986px] pb-[40px] md:pb-0">
          <h1 className="text-white text-[36px] md:text-[68px] font-semibold leading-[46px] md:leading-[86px] mb-[20px] md:mb-[26px]">
            Personalized Tutoring for Students Who Want to Excel
          </h1>
          <p className="text-white text-[16px] md:text-[18px] leading-[26px] md:leading-[30px] mb-[32px] md:mb-[48px] max-w-[807px]">
            One-on-one academic support designed to help students excel in Math, Science, and SAT prep with flexible online and in-person options tailored to every learning style.
          </p>
          <button className="btn-shimmer px-[25px] md:px-[35px] py-[12px] md:py-[15px] rounded-[500px] text-white text-[14px] md:text-[16px] uppercase shadow-lg hover:opacity-90 transition-opacity">
            Book a Free Consultation
          </button>
        </div>
      </div>
    </div>
  );
}
