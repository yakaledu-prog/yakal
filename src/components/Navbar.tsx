import { useState } from "react";
import logo from "@/assets/images/logo.png";

const links = [
  { label: "Home", id: "home" },
  { label: "About Us", id: "about" },
  { label: "Courses", id: "courses" },
  { label: "Parent Resource", id: "resources" },
  { label: "Blog", id: "blog" },
  { label: "Contact", id: "contact" },
];

export default function Navbar({ onNav }: { onNav: (id: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleNav(id: string) {
    setMenuOpen(false);
    onNav(id);
  }

  return (
    <div className="flex items-center justify-between w-full mb-[20px] md:mb-[397px] px-[20px] md:px-[50px] pt-[0px] md:pt-[0px]">
      <div className="h-[40px] md:h-[46.8px] w-[110px] md:w-[130px]">
        <img alt="Yakal" className="w-full h-full object-cover" src={logo} />
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-[35px] text-white text-[16px]">
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => handleNav(l.id)}
            className="relative bg-transparent border-none text-white cursor-pointer pb-[2px] group"
          >
            {l.label}
            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-white rounded transition-all duration-300 group-hover:w-full" />
          </button>
        ))}
      </nav>

      <button className="hidden md:block bg-[#1099a1] px-[24px] py-[8px] rounded-[500px] text-white uppercase hover:bg-[#0d7d84] transition text-[14px]">
        Get Started
      </button>

      {/* Hamburger */}
      <button
        className="md:hidden flex flex-col gap-[5px] p-[8px] z-50 cursor-pointer bg-transparent border-none"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <span className={`block w-[24px] h-[2px] bg-white transition-all ${menuOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
        <span className={`block w-[24px] h-[2px] bg-white transition-all ${menuOpen ? "opacity-0" : ""}`} />
        <span className={`block w-[24px] h-[2px] bg-white transition-all ${menuOpen ? "-rotate-45 -translate-y-[7px]" : ""}`} />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-0 pt-[14px] left-0 right-0 z-10 bg-black/50 backdrop-blur-sm rounded-[20px] rounded-t-[0px] flex flex-col py-[16px] px-[24px] gap-[4px] h-full">
          {links.map((l) => (
            <button key={l.id} onClick={() => handleNav(l.id)} className="text-white text-[18px] py-[12px] text-left border-none bg-transparent cursor-pointer border-b border-white/10 last:border-0 hover:text-[#1099a1] transition">
              {l.label}
            </button>
          ))}
          <button className="mt-[12px] bg-[#1099a1] px-[24px] py-[12px] rounded-[500px] text-white uppercase hover:bg-[#0d7d84] transition text-[16px]">
            Get Started
          </button>
        </div>
      )}
    </div>
  );
}
