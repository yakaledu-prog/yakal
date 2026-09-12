# The Common App Requirements Grid

Deadlines, application fees, fee waiver policy, test policy and recommendation
counts for every Common App member college. 1,114 schools in the 2026-27 grid,
948 of which join to our catalog on `unitid`.

`data/colleges/README.md` section 4 says this data exists in no public API, that
scraping admissions pages for it yields "plausible wrong" answers, and that the
only honest route is 25 to 40 hours of hand curation. **It was right about the
method it tested and wrong about the conclusion.** It tried three college
websites and got JavaScript, ambiguity and silence. It did not try the file
Common App publishes itself.

That file is here. Every date in it is the college's own answer on Common App's
own form, which is a different class of evidence from a sentence parsed off a
marketing page, and Common App keeps it updated through the cycle. The copy in
`out/` was fetched on 2026-09-11 and its own header says "Updated: 09-11-2026".

---

## Refreshing it

```bash
curl -sSL -o out/ReqGrid-2026-27.pdf https://content.commonapp.org/Files/ReqGrid.pdf

python3 build/parse_reqgrid.py \
  --pdf out/ReqGrid-2026-27.pdf \
  --out out/requirements-2026-27.ndjson

python3 build/match_to_catalog.py \
  --requirements out/requirements-2026-27.ndjson \
  --catalog ../colleges/out/colleges.ndjson \
  --overrides curated/manual_matches.csv \
  --out out/requirements-2026-27.matched.ndjson \
  --unmatched out/requirements-2026-27.unmatched.csv

python3 build/harvest_explore.py --out out/commonapp-explore.ndjson

python3 build/resolve_admissions_host.py \
  --catalog ../colleges/out/colleges.ndjson \
  --requirements out/requirements-2026-27.matched.ndjson \
  --commonapp out/commonapp-explore.ndjson \
  --out out/admissions-urls.csv

npm run db:load:admissions
```

Common App publishes the grid on 1 August and edits it through the autumn, so
**re-run this monthly between August and January** and once more in February.
Deadlines do move: a college extends after a hurricane, or adds an ED II round.

---

## What the grid gives, and what it does not

| Column | In the grid | Notes |
|---|---|---|
| ED, ED II, EA, EA II, REA, RD | yes | Real dates. `Rolling` in the RD column instead of a date |
| Application fee, US and international | yes | Whole dollars, stored as cents |
| Fee waiver policy | yes | Accepted / U.S. only / Not Accepted |
| Common App personal essay required | yes | Blank means not required, which is an answer, not missing data |
| Courses and Grades required | yes | |
| Portfolio | yes | `SR` is SlideRoom, `COL` the college's own system |
| **Writing supplement required** | **column exists, empty for every school** | See below |
| Test policy | yes | A / F / I / N / S: Always, Flexible, Ignored, Never, Sometimes |
| Tests used, English proficiency | yes | Often "See website" |
| Teacher evals, other evals, midyear report, counselor rec | yes | Counts and flags |
| Supplemental essay prompt text | **no** | That is `data/essay-prompts` |
| Admitted GPA, Common Data Set figures | no | Still hand work |

**The Writing column is empty in 2026-27.** Every school's cell is blank, so we
store `NULL` rather than reading it as "no college requires a supplement". The
prompts themselves answer that question better anyway: a school with six
supplements on file plainly requires them.

**Only Common App members are here.** The UC system, and a few large publics
that run their own application, are not. They need their own source.

---

## Why the parsing is the way it is

The grid is a PDF print of a Google Sheet, so it has no text structure at all,
only words at coordinates. `parse_reqgrid.py` recovers columns by x position
against the header and rows by anchoring on the School type cell (Coed / Women /
Men / Coordinate), which appears exactly once per school and sits vertically
centred on its row. Anchoring on the name does not work: long names wrap onto
two or three lines.

Two things bit during the build and are pinned by comments in the script:

- The page footer ("Page 53") lands in whichever cells its x position falls in,
  and without a bound it joined the bottom row of every page. The notes block on
  the last page did the same thing to Yeshiva University, at length.
- **Column geometry is the thing that silently breaks.** If Common App adds a
  column, every value shifts one place and nothing throws.
  `scripts/verify/essay-prompts.ts` asserts six known dates read off the
  published grid, which is the canary.

## Why the join is timid

The grid names a school the way the school does ("Caltech"); IPEDS names it the
way the federal government does ("California Institute of Technology"). So the
join is by name, and a name join is where wrong data comes from.

A first draft matched **Columbia University to Columbia College** because it
stripped "university" and "college" as noise. That would have shown a student
Columbia College's deadline under Columbia's name, which is exactly the
"plausible wrong date" the colleges README refuses to ship. The rules now:

- the institution word must agree, so Columbia University can never become
  Columbia College
- a parenthetical or trailing state is a state hint, and a hint that disagrees
  with the catalog rejects the match
- a campus suffix or a longer IPEDS name is only accepted when exactly one
  catalog row survives, which is why "Indiana University" matches nothing: it
  prefixes eight campuses
- a college the grid lists **more than once** is dropped, not merged. Siena
  University appears three times with three different regular-decision dates,
  presumably three programmes, and picking one would be right for some
  applicants and wrong for others.

Everything unmatched goes to `out/requirements-<cycle>.unmatched.csv`. Most of
it should be unmatched: the grid carries foreign universities and community
colleges, and our catalog is US four-year bachelor's-predominant by design. To
correct a join, put the unitid in `curated/manual_matches.csv`. That file
overrides everything, so fixing a join is an edit to data rather than to code.

## The admissions link

`resolve_admissions_host.py` finds where to apply. Only a fifth of colleges put
admissions on its own subdomain, so it tries `admission.`, `admissions.`,
`apply.` and `undergrad.` first and then the common paths off the main site.

The trap is the soft 404. University sites answer almost any path with a 200 and
then redirect somewhere unrelated: **Harvard answers `/admissions` by
redirecting to `/programs/`**, which is a real page, is not an error, and is not
admissions. So the landing URL is read, not the status code, and a redirect that
loses the admissions words from its path is treated as a miss.

This is prefill, never a requirement. A student adding a college still gets a
field they can type into.

---

## The other file Common App publishes

The grid is not the only thing. `commonapp.org/explore` carries a page for each
of its **1,167 member colleges**, listed in the published sitemap, and Gatsby
serves each one's data as static JSON at a parallel `/page-data` path.
`build/harvest_explore.py` reads it into `out/commonapp-explore.ndjson`.

It was found by checking three competitor prompt aggregators. One of them says
in its own FAQ where its data comes from: "straight from each school's Common
App application". That is true of all of them, and it settles a question this
repo had been circling. The supplemental prompts are inside the logged-in
application, which is why no crawl of public college pages will ever find them
all, and why each of those sites represents real transcription work rather than
a lookup somebody automated. We use them as a worklist of which colleges to go
and read, never as a source of text.

The prompts are not in this file. These are:

| Field | Why it matters |
|---|---|
| `unitid` | The IPEDS id, **stated**. `match_to_catalog.py` exists because the grid gives only a name; here the join key is given outright. 1,098 of 1,167 carry one, 1,051 join to our catalogue |
| `admissions_url` | The college's own first-year admissions page. 1,149 of 1,167. The probe in `resolve_admissions_host.py` reached 872 of 951; with these it reaches 931, and 869 of the links are now stated rather than inferred |
| `alternate_names` | "VU, Vandy" for Vanderbilt. 854 colleges. The college search matches the catalogue name only, so a student typing Vandy currently gets nothing |
| `logo_url` | The college's own logo as supplied to Common App, 1,077 of them. `CollegeLogo` falls through Commons crest, then favicon, then a monogram; this is the college's answer |
| `fy_personal_essay`, `fy_recommendations`, `fy_fee`, `fy_test_policy` | First-year application facts, agreeing with the grid and covering colleges the grid does not |

`robots.txt` allows this. It blocks the training crawlers by name and allows
everything else, the pages are in the sitemap, and each fetch is the same static
JSON a browser gets. Nothing here is asked for that a visitor is not given.

### The logos are real, and the wrong shape

`logo_url` is a genuine logo, not a campus photo: Amherst's is its crest and
wordmark on transparency. It is deliberately **not** wired into `CollegeLogo`,
because measuring a 16-college sample killed the idea:

| | |
|---|---|
| Median aspect ratio | **1.60**, and only 4 of 16 were near-square. These are wordmarks. `CollegeLogo` draws a 40px square, so an 800x500 wordmark lands as an illegible 40x25 smear |
| Median file size | **65 KB**, one of them 428 KB, for an icon drawn at 40px, with no resizing service in front of it |
| Colour modes | mixed, including CMYK. Yale's is a 641 KB CMYK JPEG, which some browsers render with the colours inverted |
| URL stability | Gatsby content hashes, which change when the image changes, so links rot silently |

The gain would have been 256 colleges over the 1,024 Commons crests we already
ship. Not worth a worse image for the other 1,024.

To revisit: run them through Cloudinary or a Python pass to square-crop,
flatten CMYK to sRGB and resize, then ship the result the way the house rule
says public images go (`src/lib/cloudinary.ts`). The field stays in the NDJSON
for that day. What would suit these without any of that work is a wide slot,
where a wordmark reads properly, rather than the square avatar.

**The stated admissions link is not always the better one.** Common App's is
usually more specific, `/admissions/first-year/apply` where the probe stopped at
`/admissions`. Sometimes it is worse: Alverno's points at `/visit`, and a few
are recorded as `http` on sites that answer `https`. So the harvest is filtered
through the same `is_admissions_link` guard the probe uses, and upgraded to
`https`, rather than trusted wholesale. That guard tests the host as well as the
path: a dedicated admissions subdomain is the answer whatever it lands on, and a
path-only version rejected `https://admission.brown.edu/` for having an empty
path.
