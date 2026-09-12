#!/usr/bin/env python3
"""
Find each college's essay page, rather than guessing its URL.

Hand-writing 50 admissions URLs produced 7 working pages and 43 wrong ones.
Admissions sites are reorganised constantly and the path that was right last
cycle is a 404 this one, so the URL itself has to be discovered every run.

Three cheap moves, in order. First read sitemap.xml, which most admissions
sites publish and which names every page they have: filtering it for essay,
supplement or writing finds the page outright and costs one request. Penn keeps
its prompts at /how-to-apply/preparing-your-application/writing, which no path
guess would ever reach and the sitemap hands over immediately.

Failing that, guess: admissions offices put this page at one
of about fifteen paths ("/apply/essays", "/essay-prompts", "/writing-supplement")
on one of about five subdomains, so probing that grid finds the page outright
for most schools and costs a handful of requests. Failing that, crawl: follow
only links whose text or href talks about essays, supplements, writing or
first-year applying, and stop at depth 2.

Either way every page that answers is scored and the BEST one wins, rather than
the first one that looked plausible. That distinction is the whole difference
between working and not: a first-match version returned Princeton's optional
*arts* supplement and Dartmouth's glossary entry for the phrase "writing
supplement", both of which technically mention essays and word counts and
neither of which is the page anybody wants.

Politeness matters here: these are real institutions and the whole crawl is one
request every DELAY seconds per school, one school at a time, with a cache so
re-running costs them nothing.

    python3 discover_pages.py --catalog ../../colleges/out/colleges.ndjson \
        --unitids 130794,166027 --out ../curated/sources-2026-27.csv
"""

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parent))

import argparse, csv, html, json, os, re, sys, threading
from concurrent.futures import ThreadPoolExecutor

from _discover_core import discover
import urllib.parse as up
import urllib.request, urllib.error

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

LIMIT = re.compile(r"\b\d{2,4}\s*(?:-|–)?\s*(?:word|character)s?\b", re.I)
WORDY = re.compile(r"\bword\s*(?:count|limit|maximum)\b", re.I)
ASKS = re.compile(
    r"\b(describe|tell us|why (are|do|did|would)|what|how|reflect|share|"
    r"discuss|explain|elaborate|imagine|choose|respond)\b",
    re.I,
)

# Where admissions offices actually keep this page. Ordered by how specific the
# path is, so a hit on /essay-prompts is preferred to one on /first-year.
PATHS = [
    "essay-prompts", "essays", "apply/essays", "apply/essay-prompts",
    "essay-topics", "essay-questions", "apply/essay-questions",
    "writing-supplement", "apply/writing-supplement",
    "supplemental-essays", "apply/supplemental-essays",
    "application-questions", "apply/application-questions",
    "short-answer-questions", "apply/short-answer-questions",
    "first-year/essays", "apply/first-year/essays",
    "how-to-apply/essays",
    "apply/first-year-applicants", "apply/first-year",
    "first-year-applicants", "apply/application-requirements",
]

# What a link has to smell of before we spend a request on it.
WANT = re.compile(
    r"essay|supplement|writing|short[-_ ]?answer|prompt|question|"
    r"first[-_ ]?year|freshman|apply|application|requirement",
    re.I,
)
# Pages that match WANT but never hold prompts. Following these is most of the
# wasted crawl: a school's news section will happily match "application".
AVOID = re.compile(
    r"\.(pdf|jpg|jpeg|png|gif|svg|zip|docx?|xlsx?)$|"
    r"/news|/events|/blog|/give|/giving|/alumni|/athletics|/calendar|"
    r"transfer|graduate|international|financial[-_ ]?aid|scholarship|"
    r"visit|tour|login|portal|search|privacy|accessibility",
    re.I,
)
# Ranked: a page whose URL says "essay" is worth reading before one that says
# "apply", and reading in the right order is what keeps the crawl to depth 2.
RANK = [
    (re.compile(r"essay|prompt|short[-_ ]?answer|writing[-_ ]?supplement", re.I), 3),
    (re.compile(r"supplement", re.I), 2),
    (re.compile(r"first[-_ ]?year|freshman", re.I), 1),
]


def get(url: str, timeout: int = 12) -> tuple[str, str]:
    """Body and final URL after redirects."""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ctype = r.headers.get("Content-Type", "")
        if not re.search(r"html|xml", ctype, re.I):
            raise ValueError(f"not html: {ctype}")
        charset = r.headers.get_content_charset() or "utf-8"
        return r.read(3_000_000).decode(charset, errors="replace"), r.geturl()


def text_of(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", raw)
    return html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw))


LINK = re.compile(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.I | re.S)
def rank(url: str, text: str) -> int:
    n = 0
    for pattern, weight in RANK:
        if pattern.search(url) or pattern.search(text):
            n = max(n, weight)
    return n


def get(url: str, timeout: int = 12) -> tuple[str, str]:
    """Body and final URL after redirects."""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ctype = r.headers.get("Content-Type", "")
        if not re.search(r"html|xml", ctype, re.I):
            raise ValueError(f"not html: {ctype}")
        charset = r.headers.get_content_charset() or "utf-8"
        return r.read(3_000_000).decode(charset, errors="replace"), r.geturl()


def text_of(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", raw)
    return html.unescape(re.sub(r"(?s)<[^>]+>", " ", raw))


LINK = re.compile(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.I | re.S)
LOC = re.compile(r"<loc>\\s*([^<\\s]+)\\s*</loc>", re.I)

# A sitemap is every page a site has, so the filter has to be tight. These are
# the words that mean the essay questions, minus the ones that mean a student
# blog post about writing an essay, which is most of what matches otherwise.
# "questions" is in here because of Princeton, whose prompts live at
# /apply/princeton-specific-questions and which a filter looking only for the
# word essay walks straight past. Several colleges name the page that way.
SITEMAP_WANT = re.compile(
    r"essay|supplement|writing|prompt|short[-_]?answer|"
    r"specific-questions|application-question|essay-question|"
    r"personal-statement|application-requirement",
    re.I,
)
SITEMAP_AVOID = re.compile(
    r"/blog|/news|/stories|/follow|/voices|/post|/article|/profiles?/|"
    r"/gazette|/magazine|/podcast|/event|transfer|graduate|/faculty",
    re.I,
)


def links(raw: str, base: str):
    for href, label in LINK.findall(raw):
        href = html.unescape(href.split("#")[0]).strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:")):
            continue
        label = " ".join(html.unescape(re.sub(r"(?s)<[^>]+>", " ", label)).split())
        yield up.urljoin(base, href), label


def prompt_score(url: str, raw: str) -> int:
    """How much this page looks like the college's essay questions.

    Counts the lines that read like a question rather than counting question
    marks anywhere on the page, because an admissions FAQ is nothing but
    question marks and has no prompts on it at all.
    """
    body = text_of(raw)
    if not (LIMIT.search(body) or WORDY.search(body)):
        return 0

    lines = [" ".join(l.split()) for l in re.split(r"[\n\r]+|(?<=[.?])\s{2,}", body)]
    asks = [
        l for l in lines
        if len(l) >= 45 and ASKS.search(l) and (l.endswith("?") or LIMIT.search(l))
    ]
    if len(asks) < 2:
        return 0

    n = min(len(asks), 12)
    # A page that says so in its own address is the one the college means.
    if re.search(r"essay|prompt|supplement|short[-_]?answer|question", url, re.I):
        n += 6
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--unitids", help="comma separated; default every row in --out")
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--budget", type=int, default=25, help="requests per school")
    ap.add_argument("--verbose", action="store_true", help="say what it tried")
    ap.add_argument("--workers", type=int, default=1,
                    help="schools at a time. Each worker talks to a different "
                         "institution, so this is not extra load on anybody")
    ap.add_argument("--refresh", action="store_true",
                    help="re-discover schools that already have a url")
    args = ap.parse_args()

    catalog = {c["unitid"]: c for c in
               (json.loads(l) for l in open(args.catalog))}

    existing: dict[int, dict] = {}
    if os.path.exists(args.out):
        for row in csv.DictReader(open(args.out)):
            existing[int(row["unitid"])] = row

    if args.unitids:
        targets = [int(u) for u in args.unitids.split(",") if u.strip()]
    else:
        # Selective schools first. They are the ones that ask for supplements
        # at all, and the ones most students apply to, so a run that is cut
        # short has still done the part that matters. Alphabetical put four
        # hundred open-admission colleges ahead of the Ivy League.
        def demand(unitid: int) -> tuple[float, float]:
            c = catalog.get(unitid) or {}
            rate = c.get("admit_rate_pct")
            return (101.0 if rate is None else float(rate), -(c.get("undergrads") or 0))

        targets = sorted(existing, key=demand)

    lock = threading.Lock()
    found = 0
    done = 0

    def write_out() -> None:
        """Checkpoint. A crawl of a thousand schools takes long enough that
        losing it to one exception is a real cost."""
        tmp = args.out + ".tmp"
        with open(tmp, "w", newline="") as fh:
            w = csv.DictWriter(
                fh, fieldnames=["unitid", "name", "url", "admissions_url", "note"],
                extrasaction="ignore",
            )
            w.writeheader()
            for uid in sorted(existing, key=lambda u: existing[u]["name"]):
                w.writerow(existing[uid])
        os.replace(tmp, args.out)

    def work(unitid: int) -> None:
        nonlocal found, done
        school = catalog.get(unitid)
        row = existing.get(unitid, {})
        if not school or not school.get("website"):
            return
        if row.get("url") and not args.refresh:
            return

        url, admissions = discover(
            school["website"], args.delay, args.budget,
            (lambda m: print(m, flush=True)) if args.verbose else (lambda _m: None),
            get, prompt_score, links,
            admissions=row.get("admissions_url") or None,
        )
        with lock:
            existing[unitid] = {
                "unitid": unitid,
                "name": school["name"],
                "url": url or "",
                "admissions_url": admissions or row.get("admissions_url", ""),
                "note": "" if url else "essay page not found",
            }
            found += bool(url)
            done += 1
            print(f"{'OK  ' if url else 'MISS'} {done}/{len(targets)} {school['name'][:44]}"
                  + (f"  {url}" if url else ""), flush=True)
            if done % 25 == 0:
                write_out()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(work, targets))

    write_out()

    with_admissions = sum(1 for r in existing.values() if r.get("admissions_url"))
    print(f"\nessay pages: {found} of {len(targets)}."
          f" admissions pages on file: {with_admissions}. -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
