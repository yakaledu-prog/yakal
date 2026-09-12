"""
Finding one page on a college's website: the sitemap, then guesses, then a crawl.

Kept apart from discover_pages.py because this is the part that was wrong three
times and each mistake was invisible from the outside: the run simply reported
that colleges do not publish their prompts.

  - The <loc> pattern had been double-escaped by a patch script, so it matched a
    literal backslash and every sitemap came back with zero URLs.
  - Sitemaps may hold relative paths. Princeton's are all "/apply/...", so even
    a working pattern yielded nothing usable without resolving them.
  - The crawl could never start. Its queue was seeded with the homepages, which
    the first pass had already put in `seen`, so every seed was skipped and the
    queue emptied immediately. Only sitemap and path hits ever worked.

The order is cheapest first and each step is allowed to stop the rest: a sitemap
is one request and names every page a site has, a path guess is one request and
right about a third of the time, and a crawl is expensive and last.
"""

from __future__ import annotations

import re
import time
import urllib.parse as up

LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)

# A sitemap lists every page a site has, so the filter has to be tight. These
# are the words that mean the essay questions. "question" is in here because of
# Princeton, whose prompts live at /apply/princeton-specific-questions and which
# a filter looking only for "essay" walks straight past.
SITEMAP_WANT = re.compile(
    r"essay|supplement|writing|prompt|short[-_]?answer|"
    r"specific-question|application-question|essay-question|"
    r"personal-statement|application-requirement",
    re.I,
)

# Matches the filter and is never the question: a student blog about writing an
# essay, the news, the arts portfolio.
SITEMAP_AVOID = re.compile(
    r"/blog|/news|/stories|/follow|/voices|/post/|/article|/profiles?/|"
    r"/gazette|/magazine|/podcast|/event|transfer|graduate|/faculty|"
    r"arts-supplement|optional-arts|music-supplement|portfolio",
    re.I,
)

# Where admissions offices keep this page, most specific first.
PATHS = [
    "essay-prompts", "essays", "apply/essays", "apply/essay-prompts",
    "essay-topics", "essay-questions", "apply/essay-questions",
    "writing-supplement", "apply/writing-supplement",
    "supplemental-essays", "apply/supplemental-essays",
    "application-questions", "apply/application-questions",
    "short-answer-questions", "apply/short-answer-questions",
    "first-year/essays", "apply/first-year/essays",
    # Found by searching for the pages this crawler had missed. Each one is a
    # real college's real URL, kept so the next run reaches it directly.
    "how-to-apply/first-year-applicants/cornell-first-year-writing-supplement-prompts",
    "faqs/writing-supplements", "apply/how-apply",
    "how-to-apply/essays", "apply/first-year-applicants",
    "apply/first-year", "first-year-applicants",
    "apply/application-requirements",
]

WANT = re.compile(
    r"essay|supplement|writing|short[-_ ]?answer|prompt|question|"
    r"first[-_ ]?year|freshman|apply|application|requirement",
    re.I,
)

AVOID = re.compile(
    r"\.(pdf|jpg|jpeg|png|gif|svg|zip|docx?|xlsx?)$|"
    r"/news|/events|/blog|/give|/giving|/alumni|/athletics|/calendar|"
    r"transfer|graduate|international|financial[-_ ]?aid|scholarship|"
    r"visit|tour|login|portal|search|privacy|accessibility",
    re.I,
)

RANK = [
    (re.compile(r"essay|prompt|short[-_ ]?answer|writing[-_ ]?supplement|question", re.I), 3),
    (re.compile(r"supplement", re.I), 2),
    (re.compile(r"first[-_ ]?year|freshman", re.I), 1),
]


def rank(url: str, text: str) -> int:
    best = 0
    for pattern, weight in RANK:
        if pattern.search(url) or pattern.search(text):
            best = max(best, weight)
    return best


def subdomain_seeds(website: str, admissions: str | None) -> list[str]:
    """Where to start. The admissions site first when we already know it."""
    host = up.urlparse(website).netloc
    root = host[4:] if host.startswith("www.") else host
    out = [admissions] if admissions else []
    out.append(website)
    for sub in ("admission", "admissions", "apply", "undergrad", "college"):
        out.append(f"https://{sub}.{root}/")
    return list(dict.fromkeys(u for u in out if u))


def sitemap_candidates(host: str, fetch, log) -> list[str]:
    """Pages the site's own sitemap names, filtered to the ones worth reading.

    Follows one level of sitemap index, because large sites split theirs, and
    stops there: chasing every shard of a university sitemap is a bigger crawl
    than the one this exists to avoid.
    """
    found: list[str] = []
    for name in ("sitemap.xml", "sitemap_index.xml", "wp-sitemap.xml", "sitemap-index.xml"):
        base = f"{host}/{name}"
        body = fetch(base)
        if not body:
            continue

        locs = LOC.findall(body)
        if "<sitemapindex" in body.lower():
            shards = [
                up.urljoin(base, u)
                for u in locs
                if SITEMAP_WANT.search(u) or re.search(r"page|post|content", u, re.I)
            ][:3]
            for shard in shards:
                inner = fetch(shard)
                if inner:
                    locs.extend(LOC.findall(inner))

        for loc in locs:
            # Princeton's sitemap is all relative paths, so an absolute URL is
            # not something to assume.
            url = up.urljoin(base, loc)
            if SITEMAP_WANT.search(url) and not SITEMAP_AVOID.search(url):
                found.append(url)
        if found:
            break

    # Shortest first: a shorter path is nearly always the canonical one.
    found = sorted(dict.fromkeys(found), key=len)
    if found:
        log(f"      sitemap offered {len(found)}")
    return found[:6]


def discover(
    website: str,
    delay: float,
    budget: int,
    log,
    get,
    score,
    links,
    admissions: str | None = None,
) -> tuple[str | None, str | None]:
    """The essay page, and the admissions office's front door.

    The second is worth returning on its own: finding a school's prompts is
    hard and often fails, finding its admissions site is a DNS lookup, and it
    is the link a student needs on their college list either way.
    """
    seen: set[str] = set()
    best: tuple[int, str] | None = None
    spent = 0
    # Kept from the first pass so the crawl has somewhere to start. Without
    # this the crawl seeded itself with URLs already in `seen` and stopped
    # before its first request.
    landed: list[tuple[str, str]] = []

    def visit(url: str) -> str | None:
        nonlocal spent, best
        if url in seen or spent >= budget:
            return None
        seen.add(url)
        try:
            time.sleep(delay)
            raw, final = get(url)
            spent += 1
        except Exception as exc:  # noqa: BLE001
            log(f"      skip {url} ({type(exc).__name__})")
            return None
        n = score(final, raw)
        if n and (best is None or n > best[0]):
            best = (n, final)
        return raw

    def body_only(url: str) -> str | None:
        """A sitemap is not a candidate page, so it is fetched without scoring."""
        nonlocal spent
        if url in seen or spent >= budget:
            return None
        seen.add(url)
        try:
            time.sleep(delay)
            raw, _ = get(url)
            spent += 1
            return raw
        except Exception:  # noqa: BLE001 - a missing sitemap is the normal case
            return None

    # 1. Which hosts answer at all.
    live: list[str] = []
    for seed in subdomain_seeds(website, admissions):
        raw = visit(seed)
        if raw is None:
            continue
        parsed = up.urlparse(seed)
        live.append(f"{parsed.scheme}://{parsed.netloc}")
        landed.append((seed, raw))
    if not live:
        return None, None

    def admissions_first(h: str) -> int:
        return 0 if re.search(r"^https?://(admission|admissions|apply|undergrad)\.", h) else 1

    hosts = sorted(dict.fromkeys(live), key=admissions_first)
    front_door = hosts[0] + "/" if admissions_first(hosts[0]) == 0 else admissions

    # 2. The sitemap.
    for host in hosts[:2]:
        if best and best[0] >= 12:
            break
        for url in sitemap_candidates(host, body_only, log):
            visit(url)

    if best and best[0] >= 12:
        return best[1], front_door

    # 3. Path guesses.
    for path in PATHS:
        if spent >= budget or (best and best[0] >= 12):
            break
        for host in hosts[:2]:
            visit(f"{host}/{path}")

    if best and best[0] >= 8:
        return best[1], front_door

    # 4. A shallow crawl, from the pages already in hand.
    queue: list[tuple[int, int, str]] = []
    for url, raw in landed:
        for href, label in links(raw, url):
            parsed = up.urlparse(href)
            if parsed.scheme not in ("http", "https"):
                continue
            root = up.urlparse(website).netloc.removeprefix("www.")
            if not parsed.netloc.endswith(root):
                continue
            if AVOID.search(href) or not WANT.search(f"{href} {label}"):
                continue
            queue.append((rank(href, label), 1, href))

    while queue and spent < budget:
        queue.sort(key=lambda q: (-q[0], q[1]))
        _, depth, url = queue.pop(0)
        raw = visit(url)
        if raw is None or depth >= 2:
            continue
        for href, label in links(raw, url):
            parsed = up.urlparse(href)
            root = up.urlparse(website).netloc.removeprefix("www.")
            if parsed.scheme not in ("http", "https") or not parsed.netloc.endswith(root):
                continue
            if AVOID.search(href) or not WANT.search(f"{href} {label}") or href in seen:
                continue
            queue.append((rank(href, label), depth + 1, href))

    return (best[1] if best and best[0] >= 8 else None), front_door
