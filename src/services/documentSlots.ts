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

/**
 * Who actually sends this to colleges, because it is almost never the student
 * and almost never us.
 *
 * Nothing on this page is submitted to a college from Yakal, and a student who
 * assumes otherwise misses a deadline believing they are done. Saying so on
 * every slot is the difference between a filing cabinet and a checklist.
 *
 *   school   the high school counselor sends it, through Common App's School
 *            Report or a service like Parchment
 *   agency   the testing body sends it: College Board for SAT and AP, ACT for
 *            the ACT
 *   student  the student uploads it themselves, into Common App or SlideRoom
 *   yakal    it never leaves here. Working material for the counselor
 */
export type Sender = "school" | "agency" | "student" | "yakal";

export interface Slot {
  id: SlotId;
  label: string;
  /** What it is and why a college wants it. Shown when the slot is empty. */
  description: string;
  /** When it is normally due. Empty for things with no schedule. */
  timing?: string;
  /** Who actually gets it to the college. */
  sender: Sender;
  /** Where that happens, when there is one page to send a student to. */
  senderUrl?: string;
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
        sender: "school",
        label: "Official transcript",
        description: "Your full high school record. Every college sees this one.",
        timing: "Sent with your application",
        required: true,
        section: "Transcripts",
      },
      {
        id: "transcript_midyear",
        sender: "school",
        label: "Mid-year report",
        description: "First-semester senior grades. Most colleges require it and will not finish reviewing you without it.",
        timing: "January to February of senior year",
        required: true,
        section: "Transcripts",
      },
      {
        id: "transcript_final",
        sender: "school",
        label: "Final transcript",
        description: "Proof you graduated, sent only to the college you enrol at.",
        timing: "After graduation",
        required: false,
        section: "Transcripts",
      },
      {
        id: "transcript_previous",
        sender: "school",
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
        sender: "agency",
        senderUrl: "https://satsuite.collegeboard.org/sat/scores/sending-scores",
        label: "SAT score report",
        description: "Your own copy. Colleges that need an official one get it from College Board directly.",
        required: false,
        section: "Test scores",
        multiple: true,
      },
      {
        id: "score_act",
        sender: "agency",
        senderUrl: "https://www.act.org/content/act/en/products-and-services/the-act/scores/sending-your-scores.html",
        label: "ACT score report",
        description: "Only if you took the ACT. Nobody needs both.",
        required: false,
        section: "Test scores",
        multiple: true,
      },
      {
        id: "score_ap",
        sender: "agency",
        senderUrl: "https://apstudents.collegeboard.org/sending-scores",
        label: "AP scores",
        description: "Useful for placement and credit once you enrol.",
        required: false,
        section: "Test scores",
        multiple: true,
      },
      {
        id: "score_english",
        sender: "agency",
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
        sender: "student",
        senderUrl: "https://apply.commonapp.org/",
        label: "Activities résumé",
        description: "A one-page summary of what you do outside class. Some colleges accept it, many do not.",
        required: false,
        section: "Other",
      },
      {
        id: "extra_portfolio",
        sender: "student",
        senderUrl: "https://www.slideroom.com/",
        label: "Portfolio or arts supplement",
        description: "Art, music, design or writing samples, where a college invites them.",
        required: false,
        section: "Other",
        multiple: true,
      },
      {
        id: "extra_awards",
        sender: "yakal",
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

/**
 * The sentence a student needs on a slot they have just filled.
 *
 * Deliberately blunt about the fact that uploading here sends nothing. The
 * upload is still worth doing: the counselor has to read a transcript to
 * advise on rigour, and a resume gets copied into Common App and a portfolio
 * into SlideRoom, so having them named and in one place saves the work twice.
 */
export const SENDER_NOTE: Record<Sender, string> = {
  school: "Your school counselor sends this to colleges, not you.",
  agency: "The testing body sends the official copy straight to colleges.",
  student: "You upload this yourself when you apply.",
  yakal: "Kept here for you and your counselor. Nothing sends it anywhere.",
};

/** Label for the link, where a slot has somewhere to send a student. */
export const SENDER_LINK_LABEL: Record<Sender, string> = {
  school: "How schools send it",
  agency: "Send your scores",
  student: "Where it goes",
  yakal: "",
};
