import { useEffect, useRef, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: "up" | "left" | "right" | "none" | "scale";
};

export default function Reveal({
  children,
  className = "",
  delay = 0,
  from = "up",
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  const initialTransform =
    from === "up"    ? "translateY(22px)" :
    from === "left"  ? "translateX(-22px)" :
    from === "right" ? "translateX(22px)" :
    from === "scale" ? "scale(0.88)" :
    "none";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = from === "scale" ? "scale(1)" : "translate(0,0)";
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [from]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: initialTransform,
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.34,1.1,0.64,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
