// Tiny dependency-free confetti burst. Appends a fixed, click-through canvas to
// <body>, animates particles, then removes itself, so it survives a route change.

const COLORS = ["#1099A1", "#CAA25F", "#97CE9D", "#e08a3c", "#d96c6c", "#0d848b"];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rot: number; vr: number; life: number;
}

export function fireConfetti(durationMs = 2200): void {
  if (typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const particles: Particle[] = [];

  // Two bursts from the lower-left and lower-right, arcing up and out.
  const spawn = (originX: number, dir: number) => {
    for (let i = 0; i < 70; i++) {
      const angle = (Math.PI / 2) * dir + (Math.random() - 0.5) * 1.1;
      const speed = 8 + Math.random() * 9;
      particles.push({
        x: originX,
        y: H + 10,
        vx: Math.cos(angle) * speed,
        vy: -Math.abs(Math.sin(angle)) * speed - 6,
        size: 5 + Math.random() * 6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1,
      });
    }
  };
  spawn(W * 0.15, 0.75);
  spawn(W * 0.85, 1.25);

  const start = performance.now();
  const gravity = 0.28;

  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.vr;
      if (elapsed > durationMs - 600) p.life -= 0.03;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < durationMs) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
}
