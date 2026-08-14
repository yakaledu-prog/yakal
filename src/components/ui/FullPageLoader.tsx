import logoImg from "@/assets/images/logo.webp";

// ============================================================
// What is on screen while the session resolves.
//
// It replaced the string "Loading...", left-aligned in the middle of an empty
// page, which is what a returning user saw on every cold load.
//
// Deliberately still: no spinner. This is usually gone in under a second, and
// a spinner that flashes for 300ms reads as a stutter rather than as progress.
// The logo fades in over 400ms, so a fast resolve shows almost nothing and a
// slow one has something to look at.
// ============================================================

export function FullPageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background"
    >
      <img
        src={logoImg}
        alt=""
        className="h-12 w-auto animate-in fade-in duration-500"
      />

      {/* A bar rather than a ring. It reads as "this is progressing" without
          the spin, and its width is honest: we do not know how long this will
          take, so it sweeps rather than filling. */}
      <div className="h-[3px] w-32 overflow-hidden rounded-full bg-primary/15">
        <div className="h-full w-1/3 animate-[loader-sweep_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
}
