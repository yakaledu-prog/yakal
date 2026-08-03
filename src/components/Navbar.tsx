import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/images/logo.webp";

// Home is gone: it scrolled to the top of the page, which is what the logo
// already does, and it was spending a slot the counselling tiers needed. Those
// have been on the page all along with nothing pointing at them.
const links = [
  { label: "About Us", id: "about" },
  { label: "Services", id: "services" },
  { label: "Courses", id: "courses" },
  { label: "Counselling", id: "counselling" },
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
    <div className="flex items-center justify-between w-full px-[20px] md:px-[50px] pt-[0px] md:pt-[0px] z-50 relative">
      <div className="h-[40px] md:h-[46.8px] w-[110px] md:w-[130px] shrink-0">
        <img alt="Yakal" className="w-full h-full object-cover" src={logo} />
      </div>

      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-[26px] lg:gap-[32px] text-white text-[16px] min-w-0 overflow-x-auto hide-scrollbar px-[20px] lg:px-[28px]">
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => handleNav(l.id)}
            className="relative bg-transparent border-none text-white cursor-pointer pb-[2px] group whitespace-nowrap shrink-0"
          >
            {l.label}
            <span className="absolute bottom-0 left-0 h-[1.5px] w-0 bg-white rounded transition-all duration-300 group-hover:w-full" />
          </button>
        ))}
      </nav>

      <Link to="/login" className="hidden md:block shrink-0 whitespace-nowrap bg-[#1099a1] px-[24px] py-[8px] rounded-[500px] text-white uppercase hover:bg-[#0d7d84] transition text-[14px]">
        Get Started
      </Link>

      {/* Hamburger */}
      <button
        className={`md:hidden flex-col gap-[5px] p-[8px] z-50 cursor-pointer bg-transparent border-none ${menuOpen ? "hidden" : "flex"}`}
        onClick={() => setMenuOpen(true)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        <span className="block w-[24px] h-[2px] bg-white" />
        <span className="block w-[24px] h-[2px] bg-white" />
        <span className="block w-[24px] h-[2px] bg-white" />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0d2528]/90 backdrop-blur-xl shadow-2xl rounded-b-[24px] flex flex-col pt-[76px] pb-[26px] px-[24px] gap-[4px] text-center">
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="absolute right-[20px] top-[18px] p-[8px] bg-transparent border-none cursor-pointer"
          >
            <span className="block relative w-[24px] h-[24px]">
              <span className="absolute left-0 top-[11px] block w-[24px] h-[2px] bg-white rotate-45" />
              <span className="absolute left-0 top-[11px] block w-[24px] h-[2px] bg-white -rotate-45" />
            </span>
          </button>

          {links.map((l) => (
            <button key={l.id} onClick={() => handleNav(l.id)} className="text-white text-[18px] py-[12px] text-center border-none bg-transparent cursor-pointer border-b border-white/10 last:border-0 hover:text-[#1099a1] transition">
              {l.label}
            </button>
          ))}
          <Link to="/login" className="mt-[12px] bg-[#1099a1] px-[24px] py-[12px] rounded-[500px] text-white uppercase hover:bg-[#0d7d84] transition text-[16px] text-center">
            Get Started
          </Link>
        </div>
      )}
    </div>
  );
}
