import { DocumentSection } from "./driveService";

/**
 * The documents a US applicant is actually asked for.
 *
 * Modelled as named slots rather than folders you drop things into, because
 * the set is small, known in advance, and time-triggered. "Mid-year report,
 * usually due January" is a deadline reminder wearing an upload button; an
 * empty folder called Transcripts teaches nobody anything.
 *
 * It also replaces the "Other" bucket, which was a smell: everything that
 * landed there had a real name.
 */

export type SlotId =
  | "transcript_official"
  | "transcript_midyear"
  | "transcript_final"
  | "transcript_previous"
  | "score_sat"
  | "score_act"
  | "score_ap"
  | "score_english"
  | "extra_resume"
  | "extra_portfolio"
  | "extra_awards";

export interface Slot {
  id: SlotId;
  label: string;
  /** What it is and why a college wants it. Shown when the slot is empty. */
  description: string;
  /** When it is normally due. Empty for things with no schedule. */
  timing?: string;
  /** Optional slots stay visible but recede until they hold something. */
  required: boolean;
  /** Physical Drive subfolder. Slots are metadata, folders are storage. */
  section: DocumentSection;
  /** Several slots legitimately hold more than one file. */
  multiple?: boolean;
}

export interface SlotGroup {
  key: string;
  title: string;
  slots: Slot[];
}

export const SLOT_GROUPS: SlotGroup[] = [
  {
    key: "transcript",
    title: "Transcript",
    slots: [
      {
        id: "transcript_official",
        label: "Official transcript",
        description: "Your full high school record. Every college sees this one.",
        timing: "Sent with your application",
        required: true,
        section: "Transcripts",
      },
      {
        id: "transcript_midyear",
        label: "Mid-year report",
        description: "First-semester senior grades. Most colleges require it and will not finish reviewing you without it.",
        timing: "January to February of senior year",
        required: true,
        section: "Transcripts",
      },
      {
        id: "transcript_final",
        label: "Final transcript",
        description: "Proof you graduated, sent only to the college you enrol at.",
        timing: "After graduation",
        required: false,
        section: "Transcripts",
      },
      {
        id: "transcript_previous",
        label: "Previous school",
        description: "Only if you transferred high schools, or took college courses for credit.",
        required: false,
        section: "Transcripts",
        multiple: true,
      },
    ],
  },
  {
    key: "scores",
    title: "Test scores",
    slots: [
      {
        id: "score_sat",
        label: "SAT score report",
        description: "Your own copy. Colleges that need an official one get it from College Board directly.",
        required: false,
        section: "Test scores",
        multiple: true,
      },
      {
        id: "score_act",
        label: "ACT score report",
        description: "Only if you took the ACT. Nobody needs both.",
        required: false,
        section: "Test scores",
        multiple: true,
      },
      {
        id: "score_ap",
        label: "AP scores",
        description: "Useful for placement and credit once you enrol.",
        required: false,
        section: "Test scores",
        multiple: true,
      },
      {
        id: "score_english",
        label: "TOEFL or Duolingo",
        description: "English proficiency, if a college asks for it.",
        required: false,
        section: "Test scores",
      },
    ],
  },
  {
    key: "extras",
    title: "Supporting documents",
    slots: [
      {
        id: "extra_resume",
        label: "Activities résumé",
        description: "A one-page summary of what you do outside class. Some colleges accept it, many do not.",
        required: false,
        section: "Other",
      },
      {
        id: "extra_portfolio",
        label: "Portfolio or arts supplement",
        description: "Art, music, design or writing samples, where a college invites them.",
        required: false,
        section: "Other",
        multiple: true,
      },
      {
        id: "extra_awards",
        label: "Awards and certificates",
        description: "Anything you might reference in an essay or activity list.",
        required: false,
        section: "Other",
        multiple: true,
      },
    ],
  },
];

export const ALL_SLOTS: Slot[] = SLOT_GROUPS.flatMap((g) => g.slots);

export function findSlot(id: string | undefined | null): Slot | undefined {
  return ALL_SLOTS.find((s) => s.id === id);
}
