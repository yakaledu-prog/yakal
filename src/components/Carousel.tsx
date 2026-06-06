import { useState, useEffect, useRef, type ReactNode } from "react";

const GAP = 16; // px gap between slides
const DURATION = 500; // ms — keep in sync with the transition below

type CarouselProps = {
  slides: ReactNode[];
  intervalMs?: number;
  activeColor?: string;
  inactiveColor?: string;
};

export default function Carousel({
  slides,
  intervalMs = 3000,
  activeColor = "#1099a1",
  inactiveColor = "rgba(0,0,0,0.2)",
}: CarouselProps) {
  const n = slides.length;
  // Clone the last slide at the front and the first at the end so the track
  // can loop seamlessly in either direction.
  const track = [slides[n - 1], ...slides, slides[0]];

  const [index, setIndex] = useState(1); // start on the first real slide
  const [animate, setAnimate] = useState(true);
  const startX = useRef(0);
  const moved = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const onScreen = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => {
      // Only advance while the carousel is actually visible — prevents the
      // index from running away while the tab is hidden or it's off-screen.
      if (onScreen.current && !document.hidden) { setAnimate(true); setIndex((i) => i + 1); }
    }, intervalMs);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => { startTimer(); return stopTimer; }, []);

  // Pause auto-advance when scrolled out of view.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { onScreen.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Whenever the index lands outside the real slides (a clone, or an
  // overshoot), jump back to the matching real slide without animation. A
  // timeout fires reliably even if the transition/tab is throttled, so the
  // index can never drift out of bounds and leave the track blank.
  useEffect(() => {
    if (index >= 1 && index <= n) return; // already on a real slide
    const t = setTimeout(() => {
      setAnimate(false);
      setIndex(((index - 1 + n) % n + n) % n + 1); // normalize to [1, n]
    }, DURATION + 30);
    return () => clearTimeout(t);
  }, [index, n]);

  // Re-enable the transition on the frame after an instant snap.
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const active = (index - 1 + n) % n;

  function go(i: number) { stopTimer(); setAnimate(true); setIndex(i + 1); startTimer(); }

  function onTouchStart(e: React.TouchEvent) {
    stopTimer();
    moved.current = false;
    startX.current = e.touches[0].clientX;
  }
  function onTouchMove(e: React.TouchEvent) {
    if (Math.abs(e.touches[0].clientX - startX.current) > 8) moved.current = true;
  }
  function onTouchEnd(e: React.TouchEvent) {
    const diff = startX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) { setAnimate(true); setIndex((i) => i + (diff > 0 ? 1 : -1)); }
    startTimer();
  }
  // Stop a swipe gesture from also firing a click on interactive slides.
  function onClickCapture(e: React.MouseEvent) {
    if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; }
  }

  return (
    <div className="w-full" ref={rootRef}>
      <div
        className="overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClickCapture={onClickCapture}
      >
        <div
          className="flex"
          style={{
            gap: `${GAP}px`,
            transform: `translateX(calc(${-index} * (100% + ${GAP}px)))`,
            transition: animate ? `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)` : "none",
          }}
        >
          {track.map((node, i) => (
            <div key={i} className="min-w-full">{node}</div>
          ))}
        </div>
      </div>

      {/* pill indicators */}
      <div className="flex justify-center items-center gap-[6px] mt-[18px]">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className="border-none cursor-pointer rounded-full transition-all duration-300"
            style={{
              height: "4px",
              width: i === active ? "28px" : "8px",
              backgroundColor: i === active ? activeColor : inactiveColor,
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}
