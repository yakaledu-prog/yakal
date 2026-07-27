import { useState } from "react";
import { RequirementsMatrix } from "@/components/college/RequirementsMatrix";
import { RecommendersPanel } from "@/components/college/RecommendersPanel";
import { EssaysPanel } from "@/components/college/EssaysPanel";
import { CollegeListItem, Essay, Recommendation } from "@/services/collegeService";
import { StudentContext } from "@/services/requirementsService";

/**
 * DEV_PREVIEW only. Renders the tracker panels against fixtures so they can be
 * worked on without a seeded student or a configured Shared Drive.
 */
const SCHOOLS: CollegeListItem[] = [
  {
    id: "s1", student_id: "u", school_name: "Johns Hopkins University", unitid: 162928,
    tier: "dream", deadline: "2026-11-01", deadline_round: "ed1", status: "applying",
    notes: null, created_at: "", updated_at: "", supp_essay_count: 3, requirements: [],
  },
  {
    id: "s2", student_id: "u", school_name: "University of Maryland-College Park",
    unitid: 163286, tier: "target", deadline: "2026-08-06", deadline_round: "ea",
    status: "submitted", notes: null, created_at: "", updated_at: "",
    supp_essay_count: 3, requirements: [],
  },
  {
    id: "s3", student_id: "u", school_name: "Towson University", unitid: 164076,
    tier: "safety", deadline: "2026-12-01", deadline_round: "rd", status: "considering",
    notes: null, created_at: "", updated_at: "", supp_essay_count: 0,
    requirements: [
      { id: "r1", college_list_item_id: "s3", label: "Application", is_complete: true, due_date: null },
    ],
  },
];

const ESSAYS: Essay[] = [
  {
    id: "e1", student_id: "u", title: "Common App personal statement",
    kind: "personal_statement", college_list_item_id: null, status: "in_review",
    content: null, drive_url: "https://docs.google.com/document/d/x",
    due_date: null, updated_at: "2026-07-24", word_limit: 650,
    prompt: "Share an essay on any topic of your choice. It can be one you have already written.",
  },
  {
    id: "e2", student_id: "u", title: "Why Hopkins? supplement", kind: "supplement",
    college_list_item_id: "s1", status: "drafting", content: null,
    drive_url: "https://docs.google.com/document/d/y",
    due_date: "2026-10-15", updated_at: "2026-07-20",
    word_limit: 300,
    prompt:
      "How has your life experience contributed to your personal story, and how will it shape your time at Hopkins?",
  },
  {
    id: "e3", student_id: "u", title: "UMD honors essay", kind: "supplement",
    college_list_item_id: "s2", status: "done", content: null, drive_url: null,
    due_date: null, updated_at: "",
  },
];

const RECS: Recommendation[] = [
  {
    id: "c1", student_id: "u", recommender_name: "Daniel Tesfaye",
    recommender_email: "dtesfaye@school.edu", relationship: "AP Biology teacher",
    status: "submitted", notes: null,
  },
  {
    id: "c2", student_id: "u", recommender_name: "Sara Ahmed",
    recommender_email: "sahmed@school.edu", relationship: "AP US History teacher",
    status: "requested", notes: null,
  },
];

export function TrackerPreview() {
  const [tab, setTab] = useState<"req" | "essays" | "recs">("req");

  const ctx: StudentContext = {
    academics: {
      id: "a", student_id: "u", gpa: 3.82, gpa_scale: 4, sat_score: 1480,
      act_score: null, toefl_score: null, ap_courses: null,
    },
    essays: ESSAYS,
    recommendations: RECS,
    hasTranscript: true,
    fafsaSubmitted: true,
    cssSubmitted: false,
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-8">
      <div className="flex gap-2">
        {(["req", "essays", "recs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-[13px] ${
              tab === t ? "bg-[#1099A1] text-white" : "bg-[#f3f3f5]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "req" && (
        <RequirementsMatrix schools={SCHOOLS} ctx={ctx} onToggle={() => {}} />
      )}
      {tab === "essays" && (
        <EssaysPanel
          essays={ESSAYS}
          schools={SCHOOLS}
          onAdd={() => {}}
          onStatusChange={() => {}}
          onCreateDoc={() => {}}
          onAskReview={() => {}}
          onSetSuppCount={() => {}}
          creatingDoc={null}
          saving={false}
          counts={new Map([["x", 631], ["y", 318]])}
        />
      )}
      {tab === "recs" && (
        <RecommendersPanel
          recommendations={RECS}
          earliestDeadline="2026-08-06"
          onAdd={() => {}}
          onStatusChange={() => {}}
          onRemove={() => {}}
          saving={false}
        />
      )}
    </div>
  );
}
