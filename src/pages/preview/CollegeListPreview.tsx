import { useQuery } from "@tanstack/react-query";
import { ListBalance } from "@/components/college/ListBalance";
import { CollegeListRow } from "@/components/college/CollegeListRow";
import { loadCatalog } from "@/services/collegeCatalogService";
import { CollegeListItem } from "@/services/collegeService";

/**
 * DEV_PREVIEW only. Renders the populated college list against fixtures so the
 * rows and balance strip can be worked on without a seeded student.
 */
const STUDENT = { sat: 1310, act: null, gpa: 3.7 };

const FIXTURES: CollegeListItem[] = [
  {
    id: "1", student_id: "s", school_name: "Johns Hopkins University", unitid: 162928,
    tier: "dream", deadline: "2026-11-01", deadline_round: "ed1", status: "applying",
    notes: null, created_at: "", updated_at: "",
    application_url: "https://apply.jhu.edu/", verified_by: "c1",
    verified_at: "2026-07-10T00:00:00Z", supp_essay_count: 1, why_school: null,
  },
  {
    id: "2", student_id: "s", school_name: "University of Maryland-College Park",
    unitid: 163286, tier: "target", deadline: "2026-08-04", deadline_round: "ea",
    status: "considering", notes: null, created_at: "", updated_at: "",
    application_url: null, verified_by: null, verified_at: null,
    supp_essay_count: 3, why_school: null,
  },
  {
    id: "3", student_id: "s", school_name: "Towson University", unitid: 164076,
    tier: "safety", deadline: null, deadline_round: null, status: "considering",
    notes: null, created_at: "", updated_at: "",
    application_url: null, verified_by: null, verified_at: null,
    supp_essay_count: null, why_school: null,
  },
  {
    id: "4", student_id: "s", school_name: "Addis Ababa University", unitid: null,
    tier: "target", deadline: "2027-01-15", deadline_round: "rd",
    status: "considering", notes: null, created_at: "", updated_at: "",
    application_url: null, verified_by: null, verified_at: null,
    supp_essay_count: null, why_school: null,
  },
];

export function CollegeListPreview() {
  const { data: catalog } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const match = (s: CollegeListItem) =>
    (s.unitid ? catalog?.find((c) => c.unitid === s.unitid) : undefined) ?? null;

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-10">
      <ListBalance counts={{ dream: 1, target: 2, safety: 1 }} mismatches={1} />
      <div className="space-y-2">
        {FIXTURES.map((s) => (
          <CollegeListRow
            key={s.id}
            item={s}
            college={match(s)}
            student={STUDENT}
            onStatusChange={() => {}}
            onRemove={() => {}}
          />
        ))}
      </div>
      <ListBalance counts={{ dream: 5, target: 2, safety: 0 }} />
    </div>
  );
}
