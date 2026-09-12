import { Award, Briefcase, GraduationCap, Languages as LanguagesIcon } from "lucide-react";

import { cn } from "@/utils/cn";
import { Entry, Section, SectionEmpty, period } from "@/components/shared/ResumeParts";

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

export type ResumeSection = "certifications" | "education" | "workExperience" | "languages";

export function TutorResume({
  resume,
  emptyText = "This tutor has not filled in their background yet.",
  /** Given, each section offers a way to add to it and each entry to remove itself. */
  onAdd,
  onRemove,
  className,
}: {
  resume: TutorResumeData;
  emptyText?: string;
  onAdd?: (section: ResumeSection) => void;
  onRemove?: (section: ResumeSection, index: number) => void;
  className?: string;
}) {
  const { education, workExperience, certifications, languages } = resume;
  const isEmpty =
    education.length === 0 &&
    workExperience.length === 0 &&
    certifications.length === 0 &&
    languages.length === 0;

  // Somebody else's empty resume is a sentence. Your own is four headings and
  // four ways to start filling them, because the point of the page is doing it.
  if (isEmpty && !onAdd) {
    return <p className="py-16 text-center text-[14px] text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className={cn("space-y-10", className)}>
      {(certifications.length > 0 || onAdd) && (
        <Section
          icon={<Award size={18} />}
          title="Certifications"
          addLabel="Add a certification"
          onAdd={onAdd && (() => onAdd("certifications"))}
        >
          <div className="space-y-6">
            {certifications.length === 0 && (
              <SectionEmpty />
            )}
            {certifications.map((c, i) => (
              <Entry
                key={i}
                when={c.year ?? ""}
                title={c.title}
                subtitle={c.issuer}
                onRemove={onRemove && (() => onRemove("certifications", i))}
              />
            ))}
          </div>
        </Section>
      )}

      {(education.length > 0 || onAdd) && (
        <Section
          icon={<GraduationCap size={18} />}
          title="Education"
          addLabel="Add education"
          onAdd={onAdd && (() => onAdd("education"))}
        >
          <div className="space-y-6">
            {education.length === 0 && (
              <SectionEmpty />
            )}
            {education.map((e, i) => (
              <Entry
                key={i}
                when={period(e.from, e.to)}
                title={e.qualification}
                subtitle={e.institution}
                onRemove={onRemove && (() => onRemove("education", i))}
              />
            ))}
          </div>
        </Section>
      )}

      {(workExperience.length > 0 || onAdd) && (
        <Section
          icon={<Briefcase size={18} />}
          title="Work Experience"
          addLabel="Add a role"
          onAdd={onAdd && (() => onAdd("workExperience"))}
        >
          <div className="space-y-6">
            {workExperience.length === 0 && (
              <SectionEmpty />
            )}
            {workExperience.map((w, i) => (
              <Entry
                key={i}
                when={period(w.from, w.to)}
                title={w.role}
                subtitle={w.organisation}
                body={w.summary}
                onRemove={onRemove && (() => onRemove("workExperience", i))}
              />
            ))}
          </div>
        </Section>
      )}

      {(languages.length > 0 || onAdd) && (
        <Section
          icon={<LanguagesIcon size={18} />}
          title="Languages"
          addLabel="Add a language"
          onAdd={onAdd && (() => onAdd("languages"))}
        >
          <div className="space-y-2">
            {languages.length === 0 && (
              <SectionEmpty />
            )}
            {languages.map((l, i) => (
              <div key={i} className="group flex items-center gap-3">
                <p className="text-[15px] text-foreground">
                  <span className="font-bold">{l.name}</span>
                  {l.level && <span className="text-muted-foreground"> - {l.level}</span>}
                </p>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove("languages", i)}
                    className="text-[13px] text-muted-foreground opacity-0 transition-opacity hover:text-secondary focus:opacity-100 group-hover:opacity-100"
                  >
                    Remove
                  </button>
                )}
              </div>
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
