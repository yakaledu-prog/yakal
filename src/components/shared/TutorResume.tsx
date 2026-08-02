import { Award, Briefcase, GraduationCap, Languages as LanguagesIcon } from "lucide-react";

import { cn } from "@/utils/cn";

// ============================================================
// A tutor's background.
//
// The booking page's Resume tab was hardcoded, so every tutor in the catalogue
// held the same degree from the same university. This renders whatever that
// tutor actually entered, and renders nothing where they have entered nothing:
// an empty Certifications heading with a rule under it says a tutor has no
// certifications, which is a claim the page has no business making.
//
// The same component on the tutor's own profile and inside the booking flow,
// so what a tutor sees is what a family will read.
// ============================================================

export interface ResumeEducation {
  from?: string;
  to?: string;
  qualification: string;
  institution?: string;
}

export interface ResumeWork {
  from?: string;
  to?: string;
  role: string;
  organisation?: string;
  summary?: string;
}

export interface ResumeCertification {
  year?: string;
  title: string;
  issuer?: string;
}

export interface ResumeLanguage {
  name: string;
  level?: string;
}

export interface TutorResumeData {
  education: ResumeEducation[];
  workExperience: ResumeWork[];
  certifications: ResumeCertification[];
  languages: ResumeLanguage[];
}

/** "2016 - 2020", "2022 - Present", or nothing at all. */
function period(from?: string, to?: string): string {
  if (!from && !to) return "";
  if (from && !to) return `${from} - Present`;
  if (!from) return to!;
  return `${from} - ${to}`;
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 border-b border-border pb-2">
        <span className="inline-flex items-center gap-2 border-b-2 border-[#1099A1] pb-2 text-[16px] font-bold text-foreground">
          {icon} {title}
        </span>
      </div>
      {children}
    </section>
  );
}

/** A dated row: the period on the left, the substance on the right. */
function Entry({
  when,
  title,
  subtitle,
  body,
}: {
  when: string;
  title: string;
  subtitle?: string;
  body?: string;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <div className="w-32 shrink-0 pt-0.5 text-[14px] font-medium text-muted-foreground">
        {when}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-[16px] font-bold text-foreground">{title}</h4>
        {subtitle && <p className="text-[14px] text-muted-foreground">{subtitle}</p>}
        {body && <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>}
      </div>
    </div>
  );
}

export function TutorResume({
  resume,
  emptyText = "This tutor has not filled in their background yet.",
  className,
}: {
  resume: TutorResumeData;
  emptyText?: string;
  className?: string;
}) {
  const { education, workExperience, certifications, languages } = resume;
  const isEmpty =
    education.length === 0 &&
    workExperience.length === 0 &&
    certifications.length === 0 &&
    languages.length === 0;

  if (isEmpty) {
    return <p className="py-16 text-center text-[14px] text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className={cn("space-y-10", className)}>
      {certifications.length > 0 && (
        <Section icon={<Award size={18} />} title="Certifications">
          <div className="space-y-6">
            {certifications.map((c, i) => (
              <Entry key={i} when={c.year ?? ""} title={c.title} subtitle={c.issuer} />
            ))}
          </div>
        </Section>
      )}

      {education.length > 0 && (
        <Section icon={<GraduationCap size={18} />} title="Education">
          <div className="space-y-6">
            {education.map((e, i) => (
              <Entry
                key={i}
                when={period(e.from, e.to)}
                title={e.qualification}
                subtitle={e.institution}
              />
            ))}
          </div>
        </Section>
      )}

      {workExperience.length > 0 && (
        <Section icon={<Briefcase size={18} />} title="Work Experience">
          <div className="space-y-6">
            {workExperience.map((w, i) => (
              <Entry
                key={i}
                when={period(w.from, w.to)}
                title={w.role}
                subtitle={w.organisation}
                body={w.summary}
              />
            ))}
          </div>
        </Section>
      )}

      {languages.length > 0 && (
        <Section icon={<LanguagesIcon size={18} />} title="Languages">
          <div className="space-y-2">
            {languages.map((l, i) => (
              <p key={i} className="text-[15px] text-foreground">
                <span className="font-bold">{l.name}</span>
                {l.level && <span className="text-muted-foreground"> - {l.level}</span>}
              </p>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/** Whatever a profile row holds, in the shape this component renders. */
export function resumeFromProfile(profile: any): TutorResumeData {
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  return {
    education: list(profile?.education),
    workExperience: list(profile?.work_experience),
    certifications: list(profile?.certifications),
    languages: list(profile?.languages),
  };
}
