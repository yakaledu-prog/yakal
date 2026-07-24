// Shared branded header band for admin pages: teal background with the same
// SVG wave pattern used across the app, plus a row of stats. No page title in
// the body - the breadcrumb indicates the active page.

export interface HeaderStat {
  label: string;
  value: string | number;
}

export function AdminHeader({ stats, children }: { stats: HeaderStat[]; children?: React.ReactNode }) {
  return (
    <div className="bg-[#1099A1] text-white pt-6 md:pt-10 px-6 md:px-10 relative overflow-hidden shrink-0">
      <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
        <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
        <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
        <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
        <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
      </svg>
      <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/20 pb-8">
        {stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-10 gap-y-5">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-3xl md:text-4xl font-bold tracking-tight leading-none">{s.value}</span>
                <span className="text-[12px] uppercase tracking-wider text-white/70 font-medium mt-2">{s.label}</span>
              </div>
            ))}
          </div>
        )}
        {children && <div className="flex items-center gap-3">{children}</div>}
      </div>
    </div>
  );
}
