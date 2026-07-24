// Shared branded header band for admin pages: teal background with the app's
// SVG wave pattern. Title/subtitle sit on the LEFT, stats on the RIGHT.

export interface HeaderStat {
  label: string;
  value: string | number;
}

export function AdminHeader({
  title,
  subtitle,
  stats = [],
  children,
}: {
  title?: string;
  subtitle?: string;
  stats?: HeaderStat[];
  children?: React.ReactNode;
}) {
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
        <div className="min-w-0">
          {title && <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>}
          {subtitle && <p className="text-white/80 text-[14px] mt-1">{subtitle}</p>}
          {children}
        </div>
        {stats.length > 0 && (
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4 shrink-0">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-2xl md:text-3xl font-bold tracking-tight leading-none">{s.value}</span>
                <span className="text-[11px] uppercase tracking-wider text-white/70 font-medium mt-2">{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
