import { useState, useEffect, useRef } from "react";

export type Testimonial = { name: string; text: string; img: string };

export default function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const n = items.length;

  function advance() { setCurrent((c) => (c + 1) % n); }

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(advance, 4000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => { startTimer(); return stopTimer; }, []);

  function go(i: number) { stopTimer(); setCurrent(i); startTimer(); }

  function onTouchStart(e: React.TouchEvent) {
    stopTimer();
    touchStartX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      setCurrent((c) => diff > 0 ? (c + 1) % n : (c - 1 + n) % n);
    }
    startTimer();
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-[20px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="flex"
          style={{ transform: `translateX(-${current * 100}%)`, transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)" }}
        >
          {items.map((t, i) => (
            <div key={i} className="min-w-full bg-white rounded-[20px] p-[24px] flex flex-col gap-[24px]">
              <p className="text-[#4a4a4a] text-[16px] leading-[26px]">{t.text}</p>
              <div className="flex gap-[14px] items-center">
                <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-[#f3f3f3] shrink-0">
                  <img src={t.img} alt={t.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-[16px] font-medium">{t.name}</p>
                  <p className="text-[rgba(255,255,255,0.65)] text-[13px]">Pro Member</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* pill indicators */}
      <div className="flex justify-center items-center gap-[6px] mt-[18px]">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className="border-none cursor-pointer rounded-full transition-all duration-300"
            style={{
              height: "4px",
              width: i === current ? "28px" : "8px",
              backgroundColor: i === current ? "#fff" : "rgba(255,255,255,0.35)",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
