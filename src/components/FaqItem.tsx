import { useRef } from "react";
import { Plus, Minus } from "lucide-react";

export type Faq = { q: string; a: string };

export default function FaqItem({
  faq,
  isOpen,
  onToggle,
}: {
  faq: Faq;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="bg-white rounded-[20px] md:rounded-[30px] px-[16px] sm:px-[20px] md:px-[28px] pt-[18px] md:pt-[28px] pb-[18px] md:pb-[28px] cursor-pointer w-full max-w-full overflow-hidden box-border"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-[12px]">
        <h4 className="text-[15px] md:text-[20px] font-medium flex-1 leading-[22px] md:leading-[28px]">{faq.q}</h4>
        <div
          className="w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0 transition-colors duration-300"
          style={{ backgroundColor: isOpen ? "#1099a1" : "#f6f6f6" }}
        >
          {isOpen
            ? <Minus size={14} strokeWidth={2.5} className="text-white" />
            : <Plus size={14} strokeWidth={2.5} className="text-black" />
          }
        </div>
      </div>

      {/* Animated body */}
      <div
        ref={bodyRef}
        style={{
          maxHeight: isOpen ? (bodyRef.current ? bodyRef.current.scrollHeight + "px" : "400px") : "0px",
          opacity: isOpen ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.35s ease, opacity 0.25s ease",
        }}
      >
        <p className="text-[#4a4a4a] text-[14px] md:text-[17px] leading-[22px] md:leading-[27px] mt-[14px] md:mt-[16px] pb-[4px]">
          {faq.a}
        </p>
      </div>
    </div>
  );
}
