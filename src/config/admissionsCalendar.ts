/**
 * The fixed dates of a US application cycle.
 *
 * Published facts, not per-student data and not pretending to be. FAFSA opens
 * on 1 October and closes on 30 June every year; the College Board and ACT
 * publish their test dates a year ahead. Nothing here is derived from a
 * student, so nothing here can be wrong about one.
 *
 * Kept as month and day rather than full dates, so the list does not silently
 * expire: the year is worked out from today. Anything already past this year
 * belongs to next year's cycle, which is what somebody looking at a deadline
 * list in November wants to see.
 *
 * Test dates move by a week or so each year and are the part most likely to
 * drift. Check them against the source each summer.
 */
export interface CycleDate {
  label: string;
  month: number; // 1-12
  day: number;
  /** Where to confirm or act on it, matched to the resource list. */
  url: string;
}

export const ADMISSIONS_CALENDAR: CycleDate[] = [
  {
    label: "FAFSA opens",
    month: 10,
    day: 1,
    url: "https://studentaid.gov/h/apply-for-aid/fafsa",
  },
  {
    label: "CSS Profile opens",
    month: 10,
    day: 1,
    url: "https://cssprofile.collegeboard.org/",
  },
  {
    label: "Early Decision and Early Action deadlines",
    month: 11,
    day: 1,
    url: "https://www.commonapp.org/",
  },
  {
    label: "Most Regular Decision deadlines",
    month: 1,
    day: 1,
    url: "https://www.commonapp.org/",
  },
  {
    label: "Decisions released",
    month: 3,
    day: 31,
    url: "https://www.commonapp.org/",
  },
  {
    label: "National college decision day",
    month: 5,
    day: 1,
    url: "https://www.commonapp.org/",
  },
  {
    label: "FAFSA closes",
    month: 6,
    day: 30,
    url: "https://studentaid.gov/h/apply-for-aid/fafsa",
  },
];

export interface UpcomingDate extends CycleDate {
  date: Date;
  daysAway: number;
}

/**
 * The next few dates, soonest first.
 *
 * `today` is a parameter so the caller passes one value per render rather than
 * this reading the clock, which the React Compiler rules count as an impure
 * call during render and which makes the result untestable.
 */
export function upcomingDates(today: Date, count = 3): UpcomingDate[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return ADMISSIONS_CALENDAR
    .map((d) => {
      let date = new Date(today.getFullYear(), d.month - 1, d.day);
      // Already gone this year means it belongs to the next cycle.
      if (date < startOfToday) date = new Date(today.getFullYear() + 1, d.month - 1, d.day);
      const daysAway = Math.round((date.getTime() - startOfToday.getTime()) / 86_400_000);
      return { ...d, date, daysAway };
    })
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, count);
}
