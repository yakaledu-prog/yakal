# Yakal College Catalog

Machine-derived reference data for every US bachelor's-granting institution, plus the
scaffolding for the hand-curated slice that no API sells.

Built 2026-07-26. Sources: US Department of Education College Scorecard (June 2026
release) and Wikidata / Wikimedia Commons.

**Status: layer 1 is done and verified. Layer 2 is scaffolded and empty.** Read
section 4 before trusting anything for deadlines.

---

## 1. What is here

```
data/colleges/
  build/
    build_catalog.py            Scorecard + Wikidata -> colleges.ndjson. Re-runnable.
    fetch_image_licenses.py     Commons licence and attribution per image. Required.
    make_curation_template.py   Generates the blank per-cycle CSV for humans.
    fetch_sources.sh            Downloads the two upstream files.
  out/                          Machine-derived. Regenerated. Never hand-edit.
    colleges.ndjson             1,944 institutions
    colleges.csv                same, flat
    image_licenses.ndjson       1,216 image records with licence and attribution
    coverage.md                 field-by-field fill rates, regenerated each run
  curated/
    cycle_2027.csv              300 rows, 28 blank columns. Hand-filled. Empty today.
  schema.sql                    Postgres / Supabase DDL for both layers
```

Regenerate everything:

```bash
cd build
./fetch_sources.sh
python3 build_catalog.py --scorecard ../tmp/Most-Recent-Cohorts-Institution.csv \
                         --wikidata  ../tmp/wikidata_images.csv --out ../out
python3 fetch_image_licenses.py --catalog ../out/colleges.ndjson \
                                --out ../out/image_licenses.ndjson
```

`build/` never writes to `curated/`. That separation is deliberate: refreshing the
machine layer must never destroy a year of human work.

---

## 2. How many colleges are there, and how many do we need

Counted from the Scorecard file, not from memory:

| Set | Count |
|---|---:|
| All Title IV institutions in the file | 6,273 |
| Currently operating | 6,243 |
| Four-year institutions | 2,997 |
| **Four-year, predominantly bachelor's** (what we ship) | **1,944** |
| ... of which private nonprofit | 1,696 |
| ... of which public | 916 |
| ... of which private for-profit | 385 |

Cumulative share of all US undergraduates, bachelor-predominant schools ranked by
enrollment:

| Top N | Share of undergrads |
|---:|---:|
| 100 | 39.6% |
| 200 | 56.6% |
| **300** | **66.8%** |
| 500 | 79.6% |
| 800 | 89.4% |
| 1,200 | 96.2% |

**Recommendation.** Ship the machine layer for all 1,944, because it costs nothing
extra: it is one file. Hand-curate deadlines for the **top 300**, which is the
`curated/cycle_2027.csv` template. Then expand on demand: when a student adds a school
outside the curated set, the record still exists with cost, scores and photo, the
deadline fields are simply blank and marked unverified, and that school enters next
cycle's curation queue automatically. Demand-driven expansion beats guessing.

For an Ethiopian-American family base concentrated in Maryland, Virginia and DC, the
top 300 by national enrollment will still miss regional schools that matter to you.
Before curating, override the ranking to force in every four-year institution in MD,
VA, DC and PA. That is roughly 150 more schools and it is the difference between the
catalog feeling national and feeling relevant.

---

## 3. What is reliable, verified against real records

All of this is machine-fetched, and I spot-checked Johns Hopkins against its published
figures: 6.4% admit rate, 1520-1570 SAT middle 50, 34-36 ACT, 6:1 student-faculty,
93.8% six-year graduation, $85,947 cost of attendance, $18,809 average net price. All
correct.

Fill rates across all 1,944 schools, and across the top 300 where it matters more:

| Field | All 1,944 | Top 300 |
|---|---:|---:|
| Name, city, state, website, coordinates | 100% | 100% |
| Control, locale, Carnegie class | 100% | 100% |
| Student-faculty ratio | 99% | 100% |
| Undergraduate enrollment | 99% | 100% |
| Percent Pell | 97% | - |
| Tuition in / out of state | 95% | - |
| Cost of attendance | 91% | 99% |
| Average net price | 91% | 99% |
| Net price for family income under $30k | 89% | - |
| Retention and 6-year graduation rate | 91-92% | - |
| Median earnings 10 years out | 92% | - |
| Admit rate | 82% | 93% |
| Test policy | 82% | 93% |
| SAT middle 50 | 48% | 71% |
| ACT middle 50 | 46% | 70% |
| Campus photo | 63% | 84% |
| Logo | 53% | 76% |

**The SAT and ACT gap is the one to know about.** Only 71% of the top 300 report score
ranges, because test-optional policies collapsed reporting after 2020. The
"where you stand" chart in the Stitch prompts cannot render for the other 29%. Design
the empty state deliberately, do not treat it as an edge case.

**Refresh cadence.** Scorecard publishes annually, most recently June 2026. Once a year
is exactly right for this layer. It is one script and about ten minutes.

---

## 4. What is NOT here, and why you should not trust a scraper for it

The honest part. These fields are what the product actually sells on, and no public API
provides them:

- application deadlines by round (ED, ED II, EA, REA, RD, priority, rolling)
- supplemental essay counts and prompt text
- recommendation letter requirements
- interview policy
- application fee and waiver policy
- admitted-student GPA (Common Data Set section C)
- Common App participation

I tested whether these can be scraped. Three real admissions pages:

| Page | Result |
|---|---|
| `apply.jhu.edu` deadlines page | 764 characters of text. JavaScript-rendered. **Nothing to scrape.** |
| `admissions.psu.edu` deadlines | Text available, but yields "Apply by November 1", "Recommended submission deadline: December 1", and "program's October 14 deadline" on the same page. Which is the RD deadline? A human has to decide. |
| UC freshman admission | "submit it by December 1 (for fall 2026 applicants)". Correct, but UC is a single system with one shared application, not a generalisable pattern. |

So: partially scrapeable, ambiguous where it works, silently empty where it does not.

**I will not generate this data from memory, and you should not let me.** I could
produce a confident-looking `deadlines.json` for 300 schools in a minute and a
meaningful share of the dates would be wrong. For a product whose central promise is
"nobody misses a deadline", a plausible wrong date is far worse than a blank field. A
blank field prompts a counselor to check. A wrong date does not.

**What to do instead.** `curated/cycle_2027.csv` has 300 rows and 28 columns waiting.
Realistic effort is 4 to 8 minutes per school for someone with a template and two
browser tabs, so roughly 25 to 40 hours for the first pass. Subsequent cycles are far
faster because most deadlines do not move: expect 8 to 12 hours to diff and update.

That is one contractor week, once a year. **It is also precisely the moat.** The reason
this data is not in an API is that assembling it is tedious, and tedium is a defensible
barrier in a way that a Scorecard integration never is.

**Timing matters.** Curate in **August**, after Common App opens on August 1 and
supplemental prompts are published for the cycle. Curating in June means guessing at
prompts that do not exist yet.

**One caveat on "once a year is fine".** It mostly is, with two exceptions worth a
mid-cycle check: schools reinstating standardised test requirements (several have since
2024, and `test_policy` from Scorecard lags by more than a year), and occasional
deadline extensions. Add a `verified_on` date to every curated row, surface anything
older than 12 months as unverified in the UI, and give counselors a one-click "flag this
as wrong" that lands in a review queue. The crowd of counselors correcting live data is
cheaper and faster than any re-scrape.

---

## 5. Images

1,216 campus photographs, covering 84% of the top 300. Real photos, not logos:
`UMN-NorthrupMall.jpg`, `Morgan State University - Holmes Hall.JPG`,
`Johns Hopkins' Historic Dome.jpg`.

Two things to know.

**Attribution is legally required for most of them.** Licence breakdown of the 1,216:

| Licence | Count |
|---|---:|
| CC BY-SA (2.0 / 2.5 / 3.0 / 4.0) | 679 |
| Public domain | 252 |
| CC BY (1.0 / 2.0 / 2.5 / 3.0 / 4.0) | 192 |
| CC0 | 71 |
| Attribution | 12 |
| GFDL 1.2, FAL, other | 8, flagged for review |

**873 of 1,216 require visible photographer credit.** `image_licenses.ndjson` carries
`artist`, `license`, `license_url` and `descriptionurl` per file for exactly this. Put a
small credit line under each photo or in a per-page attributions block. Do not ship
these without it. The 8 flagged files (GFDL 1.2 and FAL) should be replaced or dropped.

**Quality is uneven.** Wikidata's P18 gives you *a* photo, not the *best* photo. Harvard
resolves to `Sanders theater 2009y.JPG` and Michigan State to `MSU Computer Center.jpg`,
neither of which is the shot you would choose. Budget one hour for a human to click
through 300 thumbnails and swap the bad ones, using the Commons category
(`Category:<University> buildings`) as the replacement source. That is a small job with
a large visual payoff.

Serve them through your own CDN with a `width=800` transform rather than hotlinking
`upload.wikimedia.org`. Commons asks you not to hotlink at volume, and the originals are
multi-megabyte.

The 16% of the top 300 with no photo are mostly online institutions (Southern New
Hampshire, Western Governors, Phoenix, ASU Digital) that have no campus to photograph.
Design a typographic fallback tile rather than hunting for images that do not exist.

---

## 6. Storage format

Three layers, deliberately separate.

**Layer 1, machine-derived.** `colleges.ndjson`, one JSON object per line, keyed by
`unitid` (the IPEDS unit ID, the only stable national identifier for a US institution;
use it as your primary key and never invent your own). NDJSON because it diffs
line-by-line in git, streams without loading 2 MB into memory, and loads into Postgres
with a single `COPY`. Committed to the repo so any change is reviewable in a PR.

**Layer 2, human-curated, versioned by cycle.** `curated/cycle_2027.csv`, one file per
admissions cycle, joined to layer 1 on `unitid`. CSV, not JSON, because a human edits it
in Google Sheets or Excel. Never overwritten by the build. Keeping cycles as separate
files means you can diff 2027 against 2028 to see exactly which deadlines moved, which
is a genuinely useful artifact.

**Layer 3, student-specific.** Lives in your application database, never in these files:
the student's category call, their rationale, their notes, their essays. A student's
college list row is a foreign key to `colleges.unitid` plus their own fields. This is
what kills the duplicate-Towson-with-two-different-prices bug in the current demo data.

See `schema.sql` for the Postgres DDL. The shape is:

```
colleges              (unitid PK, machine-derived, refreshed annually)
college_cycles        (unitid + cycle PK, hand-curated deadlines and essays)
college_images        (unitid + file PK, licence and attribution)
student_college_list  (student_id + unitid, the student's own judgement)
```

Load layer 1 and 2 into Supabase as read-only tables with RLS allowing anonymous select.
The catalog is public data and it is the free tier, so there is no reason to gate it.

---

## 7. Honest summary of what I can and cannot do here

**Done, verified, ready to use:** 1,944 institutions with cost, net price by income,
admit rate, test scores where reported, ratios, outcomes, coordinates, websites, and
1,216 licensed campus photos. Spot-checked against published figures. Refreshable in ten
minutes by re-running two scripts.

**Scaffolded, not filled:** deadlines, essay prompts, rec requirements, admitted GPA. The
template exists with the right columns in the right order. The work is real and it needs
a human. I can help build tooling around it, a review UI, a diff report between cycles,
a validator that rejects a February ED deadline, and I can help verify individual schools
one at a time where we can read a real source together. I will not bulk-generate it.

**The thing to internalise:** the free data is the commodity, and every competitor has
it. The 28 hand-filled columns are the product. Do not let the fact that I could produce
them quickly and wrongly tempt you into skipping the week that makes them right.
