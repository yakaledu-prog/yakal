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
