import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, Phone, X, GraduationCap, BookOpen, Video, CalendarClock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTutorAvailability } from "@/services/availability";
import type { ChatContact } from "@/services/messageService";
import { cn } from "@/utils/cn";
import { normalizeRole } from "./RoleIcon";

// ============================================================
// Contact info beside a conversation.
//
// Only shows what the profile actually holds. The previous panel filled this
// space with invented media, links, course lists and availability grids that
// were connected to nothing, which made it impossible to tell real data from
// placeholder while testing. The availability block at the bottom is the real
// tutor_availability row.
// ============================================================

interface ProfileDetail {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  subjects: string[] | null;
  grade_level: string | null;
  zoom_link: string | null;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// time_grid is 13 rows, one per hour from 8 AM through 8 PM.
const FIRST_HOUR = 8;

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

/** Turn the 13x7 grid into "9 AM - 12 PM" style runs per weekday. */
function summarize(timeGrid: number[][], disabledDays: number[]): { day: string; slots: string[] }[] {
  const disabled = new Set(disabledDays);
  return DAY_LABELS.map((day, dayIndex) => {
    if (disabled.has(dayIndex)) return { day, slots: [] };

    const slots: string[] = [];
    let runStart: number | null = null;

    for (let row = 0; row <= timeGrid.length; row++) {
      const on = row < timeGrid.length && timeGrid[row]?.[dayIndex] === 1;
      if (on && runStart === null) runStart = row;
      if (!on && runStart !== null) {
        slots.push(`${hourLabel(FIRST_HOUR + runStart)} - ${hourLabel(FIRST_HOUR + row)}`);
        runStart = null;
      }
    }
    return { day, slots };
  });
}

function Field({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="w-9 h-9 rounded-full bg-[#1099A1]/10 text-[#1099A1] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-[#8696a0]">{label}</p>
        <p
          className={cn(
            "text-[13.5px] break-words",
            href ? "text-[#1099A1] hover:underline" : "text-[#111] dark:text-white"
          )}
        >
          {value}
        </p>
      </div>
    </>
  );

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-start gap-3 px-4 py-3">
      {body}
    </a>
  ) : (
    <div className="flex items-start gap-3 px-4 py-3">{body}</div>
  );
}

function AvailabilityBlock({ tutorId }: { tutorId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["tutor-availability", tutorId],
    queryFn: () => getTutorAvailability(tutorId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-5">
        <Loader2 className="animate-spin text-[#1099A1]" size={18} />
      </div>
    );
  }

  const week = data?.time_grid?.length ? summarize(data.time_grid, data.disabled_days ?? []) : null;
  const hasAny = week?.some((d) => d.slots.length > 0);

  return (
    <div className="px-4 py-4">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#8696a0] mb-3">
        <CalendarClock size={13} className="text-[#1099A1]" />
        Weekly availability
      </p>

      {!hasAny ? (
        <p className="text-[13px] text-[#667781] dark:text-[#8696a0]">
          This tutor has not published any hours yet.
        </p>
      ) : (
        <div className="space-y-2">
          {week!.map(({ day, slots }) => (
            <div key={day} className="flex items-start gap-3">
              <span className="w-8 shrink-0 text-[12px] font-semibold text-[#111] dark:text-white pt-0.5">
                {day}
              </span>
              <div className="flex-1 min-w-0">
                {slots.length === 0 ? (
                  <span className="text-[12px] text-[#8696a0]">Unavailable</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {slots.map((slot) => (
                      <span
                        key={slot}
                        className="px-2 py-0.5 rounded-md bg-[#97CE9D]/25 text-[#1099A1] dark:text-[#97CE9D] text-[12px] font-medium"
                      >
                        {slot}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContactInfoPanel({
  contact,
  onClose,
  className,
}: {
  contact: ChatContact;
  onClose: () => void;
  className?: string;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-detail", contact.id],
    queryFn: async (): Promise<ProfileDetail | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url, email, phone, bio, subjects, grade_level, zoom_link")
        .eq("id", contact.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const role = normalizeRole(profile?.role ?? contact.role);
  const subjects = profile?.subjects?.filter(Boolean) ?? [];
  const hasDetails =
    !!profile?.bio ||
    !!profile?.email ||
    !!profile?.phone ||
    !!profile?.grade_level ||
    !!profile?.zoom_link ||
    subjects.length > 0;

  return (
    <aside
      className={cn(
        // There is no room for a third column on a phone, so below lg the panel
        // covers the conversation instead of sitting beside it. Its close
        // button is the way back either way.
        "absolute inset-0 z-30 w-full flex flex-col overflow-y-auto bg-white dark:bg-[#111b21]",
        "lg:static lg:z-auto lg:w-[300px] lg:shrink-0 lg:border-l lg:border-[#e9edef] lg:dark:border-[#2a3942]",
        className
      )}
    >
      {/* No avatar, name or role here: the header directly above already
          carries all three.
          The wrapper is zero height so the button costs no row, and sticky so
          it stays reachable once the panel scrolls. The content below reserves
          headroom for it, otherwise the first label runs underneath. */}
      <div className="sticky top-0 z-10 h-0 flex justify-end pointer-events-none">
        <button
          onClick={onClose}
          aria-label="Close contact info"
          className="relative pointer-events-auto mt-2 mr-2 p-1.5 rounded-full hover:opacity-85 transition ease-in-out text-[#54656f] dark:text-[#aebac1]"
        >
          <X size={18} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-[#1099A1]" size={20} />
        </div>
      ) : (
        <div className="pt-4 divide-y divide-[#e9edef] dark:divide-[#2a3942]">
          {profile?.bio && (
            <div className="px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-[#8696a0] mb-1">About</p>
              <p className="text-[13.5px] text-[#111] dark:text-[#e9edef] leading-relaxed">
                {profile.bio}
              </p>
            </div>
          )}

          {profile?.email && (
            <Field
              icon={<Mail size={16} />}
              label="Email"
              value={profile.email}
              href={`mailto:${profile.email}`}
            />
          )}
          {profile?.phone && (
            <Field icon={<Phone size={16} />} label="Phone" value={profile.phone} href={`tel:${profile.phone}`} />
          )}
          {profile?.grade_level && (
            <Field icon={<GraduationCap size={16} />} label="Grade" value={profile.grade_level} />
          )}
          {subjects.length > 0 && (
            <Field icon={<BookOpen size={16} />} label="Subjects" value={subjects.join(", ")} />
          )}
          {profile?.zoom_link && (
            <Field
              icon={<Video size={16} />}
              label="Meeting room"
              value="Open meeting link"
              href={profile.zoom_link}
            />
          )}

          {!hasDetails && role !== "tutor" && (
            <p className="px-4 py-6 text-center text-[13px] text-[#667781] dark:text-[#8696a0]">
              This profile has no extra details yet.
            </p>
          )}

          {/* Tutors get their published hours at the bottom, so a student can
              see when to book without leaving the conversation. */}
          {role === "tutor" && <AvailabilityBlock tutorId={contact.id} />}
        </div>
      )}
    </aside>
  );
}
