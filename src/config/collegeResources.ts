/**
 * The outside sites a family needs during an application cycle.
 *
 * Kept here rather than inline in the roadmap, because all three roles read
 * the same tab through the same component, and because these are the kind of
 * URL that moves: College Board reorganises, FAFSA changes its entry point
 * most years. One list is one place to correct them.
 *
 * Every one is a real destination. They shipped as `#`, so all eight looked
 * like links, hovered like links, and did nothing.
 */
export interface CollegeResource {
  title: string;
  desc: string;
  url: string;
}

export const COLLEGE_RESOURCES: CollegeResource[] = [
  {
    title: "Common App",
    desc: "Apply to 1,000+ colleges in one place",
    url: "https://www.commonapp.org/",
  },
  {
    title: "FAFSA - Federal Student Aid",
    desc: "Federal grants, loans and work-study",
    // The apply page rather than studentaid.gov, which is a portal that buries
    // the form somebody actually came for.
    url: "https://studentaid.gov/h/apply-for-aid/fafsa",
  },
  {
    title: "CSS Profile",
    desc: "Institutional aid at many private colleges",
    url: "https://cssprofile.collegeboard.org/",
  },
  {
    title: "BigFuture (College Board)",
    desc: "College search, planning and scholarships",
    url: "https://bigfuture.collegeboard.org/",
  },
  {
    title: "Digital SAT and Bluebook",
    desc: "Register and practice for the digital SAT",
    url: "https://satsuite.collegeboard.org/digital",
  },
  {
    title: "The ACT",
    desc: "Register and prep for the ACT",
    url: "https://www.act.org/content/act/en/products-and-services/the-act.html",
  },
  {
    title: "Khan Academy",
    desc: "Free SAT prep and academic help",
    url: "https://www.khanacademy.org/",
  },
  {
    title: "College Essay Guy",
    desc: "Step-by-step walkthroughs and essay guides",
    url: "https://www.collegeessayguy.com/",
  },
];
