import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type { ResumeSection } from "@/components/shared/TutorResume";

// ============================================================
// Adding one line to a resume.
//
// Four shapes, one dialog, because the difference between a degree and a job
// is which words label the boxes. A form per section would be four files that
// drift apart the first time one of them gains a field.
//
// Only the first field is required. A tutor who remembers the year can put it
// in; one who does not should still be able to say where they studied.
// ============================================================

interface Field {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  /** Half width, so a from and a to sit on one line. */
  half?: boolean;
}

const FIELDS: Record<ResumeSection, { title: string; fields: Field[] }> = {
  certifications: {
    title: "Add a certification",
    fields: [
      { key: "title", label: "Certification", placeholder: "College Board SAT Instructor", required: true },
      { key: "issuer", label: "Issued by", placeholder: "College Board" },
      { key: "year", label: "Year", placeholder: "2023", half: true },
    ],
  },
  education: {
    title: "Add education",
    fields: [
      { key: "qualification", label: "Qualification", placeholder: "B.Sc. in Mathematics", required: true },
      { key: "institution", label: "Institution", placeholder: "Addis Ababa University" },
      { key: "from", label: "From", placeholder: "2016", half: true },
      { key: "to", label: "To", placeholder: "2020, or leave blank if ongoing", half: true },
    ],
  },
  workExperience: {
    title: "Add a role",
    fields: [
      { key: "role", label: "Role", placeholder: "Senior Mathematics Instructor", required: true },
      { key: "organisation", label: "Organisation", placeholder: "Yakal Education Services" },
      { key: "from", label: "From", placeholder: "2022", half: true },
      { key: "to", label: "To", placeholder: "Leave blank if this is current", half: true },
      { key: "summary", label: "What you did", multiline: true },
    ],
  },
  languages: {
    title: "Add a language",
    fields: [
      { key: "name", label: "Language", placeholder: "Amharic", required: true },
      { key: "level", label: "Level", placeholder: "Native, Fluent, Conversational" },
    ],
  },
};

export function ResumeEntryDialog({
  section,
  onSave,
  onClose,
}: {
  section: ResumeSection;
  onSave: (entry: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { title, fields } = FIELDS[section];
  const [values, setValues] = useState<Record<string, string>>({});

  const required = fields.filter((f) => f.required);
  const canSave = required.every((f) => (values[f.key] ?? "").trim());

  const save = () => {
    if (!canSave) return;
    // Blank optional fields are dropped rather than stored as empty strings, so
    // "2016 - " never renders where somebody simply left the year out.
    const entry: Record<string, string> = {};
    for (const f of fields) {
      const value = (values[f.key] ?? "").trim();
      if (value) entry[f.key] = value;
    }
    onSave(entry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-popover shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap gap-4 overflow-y-auto p-5">
          {fields.map((f) => (
            <label key={f.key} className={f.half ? "w-[calc(50%-0.5rem)]" : "w-full"}>
              <span className="mb-1.5 block text-[13px] font-medium text-foreground">
                {f.label}
                {!f.required && <span className="text-muted-foreground"> (optional)</span>}
              </span>
              {f.multiline ? (
                <textarea
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full resize-none rounded-lg border border-border bg-transparent p-3 text-[14px] text-foreground outline-none focus:border-[#1099A1]"
                />
              ) : (
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-[14px] text-foreground outline-none focus:border-[#1099A1]"
                />
              )}
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border p-5">
          <Button variant="outline" onClick={onClose} className="h-11 px-5">
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={save} className="h-11 px-6 font-semibold">
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
