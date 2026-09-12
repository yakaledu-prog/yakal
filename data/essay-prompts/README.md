# Essay prompts

The questions colleges actually ask, with their real word limits, so a student
starts an essay from the question rather than from a blank title field.

Two kinds of row, and they are not equally easy to get:

- **Shared applications.** The Common App's seven prompts, the UC's eight
  personal insight questions, the Coalition's six, and the Common App activities
  and honors fields. These are published, stable for a cycle, and used by nearly
  every student. `curated/universal-2026-27.json`.
- **Supplements.** One college's own questions. These are published too, but on
  1,900 different websites in 1,900 different shapes.
  `curated/supplements-2026-27.json`.

Deadlines, fees and recommendation counts are **not** here. They come from the
Common App Requirements Grid: see `data/common-app/README.md`.

---

## The standard of evidence

`data/colleges/README.md` refuses to generate curated data from memory, and it
is right. A prompt in these files got there because **its page was fetched and
read**. Every row carries `source_url` and `verified_on`, both of which are shown
to the student under the prompt and to an admin in `/admin/essay-prompts`.

For the shared applications, where the canonical page renders its prompts in
JavaScript and cannot be fetched, each prompt was read from **two independent
sources that agreed word for word**, and `source_url` points at the canonical
page a counselor should open to check.

Prompts are stored verbatim. Never paraphrased, never tidied: a student answers
the question that was asked.

Why the caution is lighter here than it is for deadlines: a prompt is long,
quoted, and states its own word limit in the sentence, so a bad extraction is
obvious on sight. The failure the colleges README feared, a wrong value that
looks right, is a property of dates, not of paragraphs.

---

## Two ways a prompt gets here

**A person read it.** `curated/supplements-2026-27.json`. Somebody opened the
college's page, read it, and wrote the JSON. `extraction` is `manual` and
`verified_on` is the day they did it. This is the good kind and it does not
scale: it is a few minutes per college.

**A script read it.** `out/supplements-2026-27.machine.json`, written by
`build/extract_prompts.py`. It quotes the sentences on a fetched page that look
like application questions with word limits attached. `extraction` is `machine`
and `verified_on` is null, because nobody has checked it. The picker says so on
the row: "read automatically, worth checking", next to the page it came from.

Both are quotations. Neither is generated. The rule from
`data/colleges/README.md` stands: a plausible invented prompt is far worse than
a missing one, and nothing here is invented.

A college that has been done by hand is never also done by machine. The loader
drops the machine rows for it and `scripts/verify/essay-prompts.ts` asserts it,
because two versions of the same question, one checked and one not, is worse
than either alone.

## What the whole run does

```bash
# 1. Find each college's essay page. Sitemap, then path guesses, then a crawl.
python3 build/discover_pages.py \
  --catalog ../colleges/out/colleges.ndjson \
  --out curated/sources-2026-27.csv --workers 20 --budget 32

# 2. The same, in a browser, for the sites that render their prompts in
#    JavaScript. Slower, so it runs second and only over what step 1 missed.
node build/render_pages.mjs --sources curated/sources-2026-27.csv \
  --out out/pages --workers 6

# 3. Fetch each page found and reduce it to the lines worth reading.
python3 build/fetch_pages.py --sources curated/sources-2026-27.csv --out out/pages

# 4. Quote the prompts out of them.
python3 build/extract_prompts.py --pages out/pages \
  --sources curated/sources-2026-27.csv \
  --catalog ../colleges/out/colleges.ndjson \
  --manual curated/supplements-2026-27.json \
  --out out/supplements-2026-27.machine.json

npm run db:load:admissions
```

## How well it works, measured

A full run over all 951 colleges we hold requirements for, on 2026-09-12:

| | |
|---|---:|
| Colleges tried | 951 |
| Admissions site found | 872 |
| Essay page found by the static pass | 39 |
| Essay page found by the browser pass | **0 of 850** |
| Colleges with prompts extracted | 21 |
| Prompts extracted | 63 |

Add the seven colleges done by hand and the shared applications, and the
catalogue holds **28 colleges and 121 prompts**.

The last four came a different way and it is the way that works: an aggregator
listing which colleges have supplements, used as a worklist, then a
site-restricted search for each one's own page. Amherst publishes its
supplement at `/admission/apply/firstyear/writingsupplement`, one word, which
is why the path list now carries unhyphenated variants; Stanford, Haverford and
Barnard all publish theirs too. **The colleges do put this on the web. Finding
the page is the whole problem, and a search engine solves it in one query.**

**The browser pass found nothing, and that is the most useful result here.**
It was built on the assumption that the blocker was JavaScript, since Brown,
Duke, Columbia and Vanderbilt all serve empty shells to curl. Rendering them
changed nothing: 0 of 850. The blocker is not rendering, it is that these
pages are not reachable by crawling from the admissions homepage at all. Given
the URL, the browser pass does work and is worth keeping for that
(`--fetchOnly`): Columbia answers curl with a 403 and a browser with the page.

So the ceiling on *finding* pages is low, and it breaks down as:

- **Many colleges never publish the text.** The supplement exists only inside
  the Common App, behind a login. Nothing can scrape what is not on the web,
  and this is most of the 951.
- **Some are not linked from anywhere a crawler starts.** Two hops from the
  admissions homepage does not reach them and more hops finds noise.
- **Some name the page something unguessable.** Princeton's lives at
  `/apply/princeton-specific-questions`, which is why the sitemap filter looks
  for "question" as well as "essay".

**What would actually move this.** A search engine. One query per college,
"<college> supplemental essay prompts 2026-27", returns the right URL nearly
every time, and `--fetchOnly` turns a URL into prompts reliably. We have no
search API key; a person with a browser, or a key, is the unlock. Everything
downstream of the URL already works.

## What the extractor throws away

Precision matters more than recall here, so the filters are aggressive and
each one is a real page that fooled an earlier version:

- **A limit belonging to somebody else.** Pages say "the Common App essay is
  650 words" near the top, and every question below it inherited 650, so an
  admissions FAQ came out as four 650-word prompts.
- **The college's own copy of the Common App prompts.** Purdue reprints all
  seven; we already hold those once, correctly, for everybody.
- **FAQs in the applicant's voice.** "I am an international student. What is
  different about the admission process for me?"
- **Instructions.** "Please keep your essay between 500-650 words."
- **Lines cut off by the layout**, which end on a preposition.
- **Form fields.** "What is your religious affiliation? * African Methodist ..."

A stated limit reaches only five lines down the page. Without that bound, MIT's
"40 to 50 words each" landed on the paragraph about their activities form.

Three bugs in step 1 were each invisible from outside, and all three reported
the same thing: that colleges do not publish their prompts.

- The `<loc>` pattern had been double-escaped by a patch script, so it matched
  a literal backslash and **every sitemap returned zero URLs**.
- Sitemaps may hold relative paths. Princeton's are all `/apply/...`, so even a
  working pattern yielded nothing without resolving them against the sitemap.
- The crawl could never start: its queue was seeded with pages already marked
  visited, so it emptied before its first request.

If the yield ever drops to near zero again, suspect the finder rather than the
colleges.

## Adding a college

```bash
# 1. Find its essay page. Writes into the sources csv.
python3 build/discover_pages.py \
  --catalog ../colleges/out/colleges.ndjson \
  --out curated/sources-2026-27.csv \
  --unitids 130794,166027

# 2. Fetch those pages and reduce each to the lines that look like questions.
python3 build/fetch_pages.py \
  --sources curated/sources-2026-27.csv \
  --out out/pages

# 3. Read out/pages/<unitid>.txt yourself and write the prompts into
#    curated/supplements-2026-27.json. This step is a person. See below.

npm run db:load:admissions
```

**Step 3 is not automatable and should not be.** The fetch script scores lines
and hands you a shortlist; it does not decide what a prompt is. Read the page.
Harvard's fifth short answer is "Top 3 things your roommates might like to know
about you." It has no question mark, no verb the scorer looks for, and no word
limit of its own because the limit was stated once above all five, so it scored
zero. There is now a rule that rescues a line following a run of prompts, and
the general point stands: the shortlist is to make your reading short, not to
replace it.

## How well discovery works

Honestly: **it works for server-rendered sites and fails for the rest.** Yale,
Harvard, MIT, Rice, Pomona, Wellesley and Penn all yield clean prompts with
their word limits. Princeton, Brown, Dartmouth and Duke render theirs in
JavaScript and come back empty however you fetch them. Those need a person with
a browser, and that is the tedium the colleges README correctly identifies as
the moat.

Three passes, cheapest first:

1. **sitemap.xml**, filtered for essay, supplement, writing or prompt. Precise
   and one request. Penn keeps its prompts at
   `/how-to-apply/preparing-your-application/writing`, which no guess would
   reach and the sitemap hands over immediately.
2. **Path guesses** on the admissions subdomains: `/essays`, `/essay-prompts`,
   `/writing-supplement` and a dozen more.
3. **A shallow crawl**, depth 2, following only links that talk about essays or
   applying.

Every page that answers is scored and the **best** one wins rather than the
first plausible one. That distinction is the whole difference between working
and not: a first-match version returned Princeton's optional *arts* supplement
and Dartmouth's glossary entry for the phrase "writing supplement". Both
technically mention essays and word counts. Neither is the page anyone wants.

A page with no word-limit phrase on it is reported as empty rather than written
out, because a silent empty file is how a college ends up in the product with no
prompts and nobody noticing.

## The shape of a prompt

```json
{
  "slug": "yale-2026-27-long-community",
  "title": "A community you feel connected to",
  "prompt": "Reflect on your membership in a community ...",
  "word_limit": 400,
  "requirement": "choice",
  "choice_group": "yale-400",
  "choose_count": 1,
  "app_key": "common_app"
}
```

`slug` is the stable handle. A re-import updates a prompt in place on
`(cycle, slug)`, so it must not change once students have written against it.

`choice_group` and `choose_count` matter more than they look. Yale asks seven
questions of which the last three are one question with three ways in, and the
Common App's seven prompts are a choice of **one**. Without these a student
could reasonably think they owe seven personal statements. The picker prints
"Choose 1 of the following" above each group, and warns if more are ticked than
the college asked for, rather than blocking: drafting two and choosing later is
a real thing counselors tell students to do.

Either `word_limit` or `char_limit`, never both. Colleges publish one or the
other, and converting between them is wrong by a third.

---

## When to do this work

**August.** Common App opens on 1 August and that is when supplemental prompts
are published for the cycle. Curating in June means guessing at questions that
do not exist yet.

A correction mid-cycle does not need any of this. `/admin/essay-prompts` edits
the row a student's picker reads, and stamps today as the day it was checked.
Fix the data file too, or the next import will undo it.

## The worklist

`curated/worklist-2026-27.csv` is the 158 colleges that two prompt aggregators
list and we hold nothing for, most selective first. It exists because automated
discovery has a ceiling and we hit it: a crawl of exactly these 158 found two
usable pages.

The reason is not a weak crawler. **Most selective colleges do not publish their
supplements outside the Common App application**, which needs a student login.
Vassar's own first-year page gives deadlines and a checklist and never uses the
word "essay"; a site-restricted search on `vassar.edu`, `emory.edu` or `wpi.edu`
returns nothing, while the same search on `nd.edu` returns Notre Dame's prompts
page immediately. Some colleges publish, most do not, and no crawler fix changes
the second group.

So these are filled in by hand. For each row:

1. Open the college's section of the Common App, or its own prompts page if it
   has one. `admissions_url` is the starting point and is filled for 152 of the
   158, mostly stated by the college itself via its Common App membership record.
2. Copy each prompt **verbatim**. Do not paraphrase and do not tidy. A plausible
   invented prompt is far worse than a missing one, which is the rule the whole
   of `data/colleges/README.md` is built on.
3. Record the URL you read it from in `source_url`. A prompt nobody can check is
   not worth having.
4. Add the college to `curated/supplements-2026-27.json`, not to the machine
   file. The loader drops machine rows for any college that appears in the
   curated one, and `scripts/verify/essay-prompts.ts` asserts a college is never
   in both.

`extraction` becomes `manual` when `verified_on` is set; a migration trigger
does that, so a hand-checked prompt stops carrying the "read automatically,
worth checking" caveat in the picker.

**Where not to get them.** The aggregators that list these colleges are useful
as a worklist and nothing else. Their prompt text is their transcription work,
carries no source we can check, and goes stale when they update and we do not.
One of them, mysupplementals.com, forbids it outright in its terms. The
QuestBridge community spreadsheet has a further problem: those are QuestBridge
Match prompts, which differ from regular-decision prompts at the same college -
its own Amherst row reads "No for match; Yes for RD" - so for an ordinary
applicant a good fraction of it is not stale but wrong.
