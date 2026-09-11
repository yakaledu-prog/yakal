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

import argparse, csv, html, json, os, re, sys, time
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
    "essay-topics", "writing-supplement", "apply/writing-supplement",
    "supplemental-essays", "apply/supplemental-essays",
    "first-year/essays", "apply/first-year/essays",
    "how-to-apply/essays", "short-answer-questions",
    "apply/first-year-applicants", "apply/first-year",
    "first-year-applicants", "apply/application-requirements",
]

# What a link has to smell of before we spend a request on it.
WANT = re.compile(
    r"essay|supplement|writing|short[-_ ]?answer|prompt|"
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
SITEMAP_WANT = re.compile(
    r"essay|supplement|writing|prompt|short[-_]?answer|application-requirement",
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
    if re.search(r"essay|prompt|supplement|short[-_]?answer", url, re.I):
        n += 6
    return n


def sitemap_urls(host: str, fetch, log) -> list[str]:
    """Candidate pages named by the site's own sitemap.

    Follows one level of sitemap index, because large sites split theirs, and
    stops there: chasing every shard of a university sitemap is a bigger crawl
    than the one this is meant to avoid.
    """
    found: list[str] = []
    for name in ("sitemap.xml", "sitemap_index.xml", "wp-sitemap.xml"):
        body = fetch(f"{host}/{name}")
        if not body:
            continue

        locs = LOC.findall(body)
        if "<sitemapindex" in body.lower():
            shards = [
                u for u in locs
                if SITEMAP_WANT.search(u) or re.search(r"page|post|content", u, re.I)
            ][:3]
            for shard in shards:
                inner = fetch(shard)
                if inner:
                    locs.extend(LOC.findall(inner))

        for url in locs:
            if SITEMAP_WANT.search(url) and not SITEMAP_AVOID.search(url):
                found.append(url)
        if found:
            break

    # Shortest first: /apply/essays beats /apply/first-year/essays/how-to-think
    # -about-them, and a shorter path is nearly always the canonical one.
    found = sorted(dict.fromkeys(found), key=len)
    if found:
        log(f"      sitemap offered {len(found)}, trying {min(len(found), 4)}")
    return found[:4]


def seeds(website: str):
    """The homepage, and the subdomains US admissions offices actually use."""
    host = up.urlparse(website).netloc
    root = host[4:] if host.startswith("www.") else host
    out = [website]
    for sub in ("admission", "admissions", "apply", "undergrad", "college"):
        out.append(f"https://{sub}.{root}/")
    return out


def discover(website: str, delay: float, budget: int, log) -> tuple[str | None, str | None]:
    """The essay page, and the admissions office's front door.

    The second is worth returning on its own. Finding a school's prompts is
    hard and often fails; finding its admissions site is a DNS lookup, and it
    is the link a student needs on their college list either way. Returning
    only the hard one threw the easy one away.
    """
    seen: set[str] = set()
    host_root = up.urlparse(website).netloc.removeprefix("www.")
    best: tuple[int, str] | None = None
    spent = 0

    def visit(url: str) -> tuple[str, str] | None:
        nonlocal spent, best
        if url in seen:
            return None
        seen.add(url)
        try:
            time.sleep(delay)
            raw, final = get(url)
            spent += 1
        except Exception as exc:  # noqa: BLE001
            log(f"      skip {url} ({type(exc).__name__})")
            return None
        n = prompt_score(final, raw)
        if n and (best is None or n > best[0]):
            best = (n, final)
        return raw, final

    def body_of(url: str) -> str | None:
        """Fetch without scoring: a sitemap is not a candidate page."""
        nonlocal spent
        if url in seen:
            return None
        seen.add(url)
        try:
            time.sleep(delay)
            raw, _ = get(url)
            spent += 1
            return raw
        except Exception:  # noqa: BLE001 - a missing sitemap is the normal case
            return None

    # Which admissions host answers at all. One request each, and the rest of
    # the budget is spent only on hosts that exist.
    live = []
    for seed in seeds(website):
        got = visit(seed)
        if got:
            live.append(up.urlparse(got[1]).scheme + "://" + up.urlparse(got[1]).netloc)
    if not live:
        return None, None
    # Deduplicate while keeping order: several subdomains often redirect to one.
    hosts = list(dict.fromkeys(live))

    # An admissions subdomain, if one answered, in preference to the
    # university homepage. www.upenn.edu is the front door of a research
    # university; admissions.upenn.edu is the front door of the thing a
    # seventeen-year-old is looking for, and its sitemap is the one worth
    # reading.
    def admissions_first(h: str) -> int:
        return 0 if re.search(r"^https?://(admission|admissions|apply|undergrad)\.", h) else 1

    hosts.sort(key=admissions_first)
    admissions = hosts[0] + "/" if admissions_first(hosts[0]) == 0 else None

    for host in hosts[:2]:
        if spent >= budget or (best and best[0] >= 12):
            break
        for url in sitemap_urls(host, body_of, log):
            if spent >= budget:
                break
            visit(url)

    if best and best[0] >= 12:
        return best[1], admissions

    for path in PATHS:
        if spent >= budget or (best and best[0] >= 12):
            break
        for host in hosts[:2]:
            if spent >= budget:
                break
            visit(f"{host}/{path}")

    if best and best[0] >= 8:
        return best[1], admissions

    # (negated rank, url) so the most promising link is popped first.
    queue: list[tuple[int, int, str]] = [(0, 0, h + "/") for h in hosts]
    while queue and spent < budget:
        queue.sort(key=lambda q: (-q[0], q[1]))
        _, depth, url = queue.pop(0)

        got = visit(url)
        if not got:
            continue
        raw, final = got

        if depth >= 2:
            continue

        for href, label in links(raw, final):
            parsed = up.urlparse(href)
            if parsed.scheme not in ("http", "https"):
                continue
            # Stay on the institution: admissions.example.edu counts, a
            # third-party application vendor does not.
            if not parsed.netloc.endswith(host_root):
                continue
            if AVOID.search(href) or not WANT.search(href + " " + label):
                continue
            if href in seen:
                continue
            queue.append((rank(href, label), depth + 1, href))

    return (best[1] if best else None), admissions


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--unitids", help="comma separated; default every row in --out")
    ap.add_argument("--delay", type=float, default=1.0)
    ap.add_argument("--budget", type=int, default=25, help="requests per school")
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
        targets = list(existing)

    found = 0
    for unitid in targets:
        school = catalog.get(unitid)
        if not school or not school.get("website"):
            print(f"----  {unitid} not in catalog, or has no website")
            continue
        row = existing.get(unitid, {})
        if row.get("url") and not args.refresh:
            print(f"have  {school['name'][:44]}")
            continue

        print(f"...   {school['name'][:44]}")
        url, admissions = discover(school["website"], args.delay, args.budget,
                                   lambda m: print(m))
        existing[unitid] = {
            "unitid": unitid,
            "name": school["name"],
            "url": url or "",
            "admissions_url": admissions or row.get("admissions_url", ""),
            "note": "" if url else "essay page not found",
        }
        print(("OK    " if url else "MISS  ") + (url or admissions or school["website"]))
        found += bool(url)

    with open(args.out, "w", newline="") as fh:
        w = csv.DictWriter(
            fh, fieldnames=["unitid", "name", "url", "admissions_url", "note"],
            extrasaction="ignore",
        )
        w.writeheader()
        for unitid in sorted(existing, key=lambda u: existing[u]["name"]):
            w.writerow(existing[unitid])

    with_admissions = sum(1 for r in existing.values() if r.get("admissions_url"))
    print(f"\nessay pages: {found} of {len(targets)}."
          f" admissions pages on file: {with_admissions}. -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
