# Can we get the prompts from Common App directly?

Researched September 2026, after five outside prompt sources all turned out to
be downstream of the same place.

## The finding

**Supplemental essay prompts live inside the logged-in Common App application.**
mysupplementals.com says so in its own FAQ, asked where its data comes from:
"Straight from each school's Common App application for the current cycle." Every
aggregator we checked is a transcription of that, done by hand.

Four independent checks agree:

- Vassar's own first-year page lists deadlines and a checklist and never uses the
  word "essay".
- A site-restricted search on `vassar.edu`, `emory.edu` and `wpi.edu` returns
  nothing; the same search on `nd.edu` returns Notre Dame's prompts page at once.
- A crawl of 158 targeted colleges, each started from its correct admissions
  page, found two usable pages.
- No open dataset exists. GitHub has three repositories in total across every
  query; the only real one was scraped from CollegeVine and last touched in 2022.

Common App's own public site does **not** carry them either. `commonapp.org`
publishes a page per member college, and `data/common-app/build/harvest_explore.py`
reads all 1,167 of them: admissions links, IPEDS ids, aliases, logos, application
facts. No prompts.

## What the partner programme actually is

Common App runs an **integration service for college counselling software**.
Named partners include BridgeU, Cialfo, MaiaLearning, Naviance, Parchment, Xello,
SchooLinks, OverGrad and Unifrog. Yakal is genuinely that category of product.

What it is documented to cover is **student and application data flow**: roster
sync, recommendation submission, application status. There is **no public
evidence that it exposes a catalogue of writing requirements or prompts**, and
the public partner page publishes no terms, cost or data scope at all - only a
contact form.

## Why Scoir can show prompts and we cannot

Scoir shows supplemental prompts because **colleges type them into Scoir**. It
can ask them to because it hosts the Coalition application. That leverage comes
from being an application host, which we are not and have no reason to become.

## What to do

This is a phone call, not a task. Send the form at
`https://www.commonapp.org/contact-partner/` with two specific questions:

1. Does the integration service expose per-college writing requirements or
   supplemental prompts, or only student and application data?
2. What does partner eligibility require of a counselling platform, and what does
   it cost?

The answer decides whether hand-entering `data/essay-prompts/curated/worklist-2026-27.csv`
is a stopgap or the permanent arrangement. No code either way.

## What we will not do

Drive a logged-in Common App account to harvest prompts at scale. An account
belongs to one applicant and shows only the colleges on that student's list, so
reaching 300 colleges means adding 300 colleges to one account, which is not a
student applying. If it is a staff account it misrepresents us as an applicant;
if it is a student's, we are using a client's credentials to build inventory.
