# Pre-production audit, September 2026

A walk through the two flows that were blocking a production decision: college
counselling and payments. Everything here was checked in a real browser against
a real database, or against Stripe's test API. Where something was not verified,
it says so.

## The documents

| File | What it covers |
| --- | --- |
| `01-how-us-admissions-works.md` | The process the counselling product is modelling, written for someone who has not been through it |
| `02-promises-vs-delivery.md` | Every line of every tier, against what the software actually does |
| `03-counsellor-experience.md` | The counsellor's own screens, and the mock data on them |
| `04-essays.md` | The review loop, and why it currently carries no feedback |
| `05-recommendations.md` | Recommenders, FERPA, and what the model already supports |
| `10-payments-findings.md` | Escrow, refunds, payouts, subscriptions, tested end to end |
| `11-pricing-model.md` | Monthly against one-time against instalments, with the numbers |
| `12-discounts.md` | Why a discount is not an admin price change, and how to build one |
| `90-fix-list.md` | Everything found, ordered by whether it blocks launch |

## How things were tested

A real headed Chrome, driven step by step, with a screenshot read at each stage.
This matters because the first attempt at this audit used a browser attached
over the debugging protocol, and its synthetic clicks were being silently
dropped: every page looked broken when nothing was wrong. That was caught by
logging `click` at the document capture phase and getting an empty array. The
setup was rebuilt so the browser is launched by the test harness, and real input
was confirmed working before any finding below was recorded.

Assertions were deliberately not the method. An assertion only ever checks the
thing you already suspected, which is why earlier rounds of automated testing
kept missing what a person found in five minutes.
