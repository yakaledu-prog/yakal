#!/usr/bin/env python3
"""
Fetch each college's own essay page and reduce it to readable text.

Prompts are the one part of the curated layer that a college does publish in
plain HTML. data/colleges/README.md tested scraping for *deadlines* and was
right to give up: three admissions pages gave JavaScript, ambiguity and
nothing. Prompts read differently. They are long, quoted, and carry their own
word limit in the sentence ("in 400 words or fewer"), so a page either has them
or obviously does not, and a wrong extraction looks wrong immediately in a way
a wrong date never does.

This script does not decide what a prompt is. It fetches, strips, and scores,
then a person reads the candidates and writes prompts.json. The scoring exists
to make that reading short, not to replace it.

A page that comes back without a single word-limit phrase is reported as EMPTY
rather than written out, because that is almost always a dead URL or a page
that renders its prompts in JavaScript, and a silent empty file is how a school
ends up in the product with no prompts and nobody noticing.

    python3 fetch_pages.py --sources ../curated/sources-2026-27.csv --out ../out/pages
"""

import argparse, csv, html, os, re, sys, textwrap
import urllib.request, urllib.error

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# "(250 words or fewer)", "200 character limit", "in no more than 35 words".
LIMIT = re.compile(
    r"\b(\d{2,4})\s*(?:-|–)?\s*(word|character)s?\b"
    r"|\bword\s*(?:count|limit)\b|\bcharacter\s*limit\b",
    re.I,
)
ASKS = re.compile(
    r"\b(describe|tell us|why (are|do|did|would)|what|how|reflect|share|"
    r"discuss|explain|elaborate|imagine|choose|respond)\b",
    re.I,
)


def strip_html(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", raw)
    raw = re.sub(r"(?is)</(p|div|li|h[1-6]|br|tr)\s*>", "\n", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    text = html.unescape(raw)
    lines = [" ".join(l.split()) for l in text.split("\n")]
    return "\n".join(l for l in lines if l)


def fetch(url: str, timeout: int = 30) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        charset = r.headers.get_content_charset() or "utf-8"
        return r.read().decode(charset, errors="replace")


def score(line: str) -> int:
    """How much this line looks like an application question."""
    if len(line) < 40:
        return 0
    n = 0
    if LIMIT.search(line):
        n += 2
    if ASKS.search(line):
        n += 1
    if line.rstrip().endswith("?"):
        n += 1
    if len(line) > 120:
        n += 1
    return n


def keep(lines: list[str]) -> list[str]:
    """The lines worth a person reading.

    Scoring alone loses questions that are not phrased as questions. Harvard's
    fifth short answer is "Top 3 things your roommates might like to know about
    you." - no question mark, no verb we look for, no word limit of its own,
    because the limit was stated once above all five. So a line sandwiched
    between two that did score is kept as well: a real prompt list is a run of
    them, and the run is the evidence.
    """
    strong = [i for i, l in enumerate(lines) if score(l) >= 2]
    chosen = set(strong)

    # A gap inside a run of prompts: the limit was stated once at the top and
    # the middle item forgot to ask a question.
    for a, b in zip(strong, strong[1:]):
        if b - a <= 4:
            chosen.update(
                i for i in range(a + 1, b) if len(lines[i].strip()) >= 40
            )

    # One line past the end of a run of three or more. That is where Harvard's
    # roommates question sits, and the next real heading is short enough that
    # the length floor keeps it out.
    run = 0
    for i, line in enumerate(lines):
        if i in chosen and score(line) >= 2:
            run += 1
            continue
        if run >= 3 and len(line.strip()) >= 40:
            chosen.add(i)
        run = 0

    return [lines[i].strip() for i in sorted(chosen)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", help="fetch one unitid")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    rows = list(csv.DictReader(open(args.sources)))
    ok = empty = failed = 0

    for row in rows:
        unitid, url = row["unitid"].strip(), row["url"].strip()
        if not unitid or not url:
            continue
        if args.only and unitid != args.only:
            continue

        try:
            text = strip_html(fetch(url))
        except Exception as exc:  # noqa: BLE001 - the reason is for a human
            print(f"FAIL  {row['name'][:40]:42s} {type(exc).__name__}: {exc}")
            failed += 1
            continue

        lines = keep(text.split("\n"))
        if not any(LIMIT.search(l) for l in lines):
            print(f"EMPTY {row['name'][:40]:42s} no word limit found, check {url}")
            empty += 1
            continue

        path = os.path.join(args.out, f"{unitid}.txt")
        with open(path, "w") as fh:
            fh.write(f"# {row['name']}\n# {url}\n\n")
            fh.write("\n\n".join(textwrap.fill(l, 100) for l in lines))
        print(f"OK    {row['name'][:40]:42s} {len(lines):3d} candidates")
        ok += 1

    print(f"\n{ok} fetched, {empty} with nothing prompt-shaped, {failed} failed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
