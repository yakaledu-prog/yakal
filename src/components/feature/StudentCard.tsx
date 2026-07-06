import { MessageSquare } from "lucide-react";
import { TutorStudent } from "@/services/tutorService";
import { dicebearUrl } from "@/utils/avatar";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Rich student card used on the Students page and the course Students tab. */
export function StudentCard({ student: s, onMessage }: { student: TutorStudent; onMessage: (id: string) => void }) {
  return (
    <div className="student-card bg-white dark:bg-[#202c33] border border-[#e9edef] dark:border-[#2a3942] rounded-2xl p-5 shadow-sm">
      <div className="student-card__head flex items-center gap-4 mb-4">
        <img src={s.avatar_url || dicebearUrl(s.full_name)} alt={s.full_name} className="w-14 h-14 rounded-full object-cover" />
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-[#111] dark:text-white truncate">{s.full_name}</h3>
          {s.email && <p className="text-[13px] text-[#54656f] dark:text-[#aebac1] truncate">{s.email}</p>}
        </div>
      </div>
      <div className="student-card__stats grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#f8f9fa] dark:bg-[#182329] rounded-lg p-3">
          <p className="text-[20px] font-bold text-[#111] dark:text-white leading-none">{s.sessionCount}</p>
          <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mt-1">Sessions ({s.completedCount} done)</p>
        </div>
        <div className="bg-[#f8f9fa] dark:bg-[#182329] rounded-lg p-3">
          <p className="text-[14px] font-semibold text-[#111] dark:text-white leading-tight">{formatDate(s.lastDate)}</p>
          <p className="text-[12px] text-[#54656f] dark:text-[#aebac1] mt-1">Last session</p>
        </div>
      </div>
      {s.subjects.length > 0 && (
        <div className="student-card__subjects flex flex-wrap gap-1.5 mb-4">
          {s.subjects.map((sub) => (
            <span key={sub} className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">{sub}</span>
          ))}
        </div>
      )}
      <button
        onClick={() => onMessage(s.id)}
        className="student-card__message w-full flex items-center justify-center gap-2 h-10 rounded-lg border border-[#e9edef] dark:border-[#2a3942] text-[14px] font-semibold text-[#54656f] dark:text-[#aebac1] hover:bg-[#f8f9fa] dark:hover:bg-[#182329] transition-colors"
      >
        <MessageSquare size={15} /> Message
      </button>
    </div>
  );
}
