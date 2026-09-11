#!/usr/bin/env python3
"""
Find each college's admissions site, which is the link a student needs.

Separate from the essay-page crawl in data/essay-prompts/build, and much
cheaper, because it is a different problem. Finding a college's prompts means
identifying one page out of thousands and often fails. Finding its admissions
office means asking whether admission.<domain> answers, which nearly every US
institution has arranged for, and it is four requests.

Worth doing on its own: the add-a-college form used to prefill the application
link with the university's homepage, and a student who lands on a research
university's front page still has to go and find admissions. This is the field
Binyam asked to fill in rather than ask for, and a blank one is fine: the form
still takes a typed URL.

Threaded because every request is to a different institution, so there is no
one host being hammered. Each host is asked at most once per run.

    python3 resolve_admissions_host.py --catalog ../../colleges/out/colleges.ndjson \
        --requirements ../out/requirements-2026-27.matched.ndjson \
        --out ../out/admissions-urls.csv
"""

import argparse, csv, json, os, re, sys
import urllib.parse as up
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# In the order a student would guess, which is also roughly how common each is.
SUBDOMAINS = ["admission", "admissions", "apply", "undergrad", "college"]

# Only a fifth of colleges put admissions on its own subdomain. The rest keep
# it as a path off the main site, so the subdomain pass alone found 195 of 948
# and left the majority prefilling a university homepage, which is the thing
# this was meant to stop.
PATHS = [
    "admissions", "admission", "apply", "admissions/apply",
    "undergraduate-admissions", "admissions/undergraduate",
    "future-students", "apply-now",
]


# The FIRST path segment has to begin with one of these. "admissions-aid" is a
# real admissions page and passes; "task-force-on-antisemitism/admissions-and-
# early-student-experiences" has the word only in its second segment and does
# not, which is the case this exists for.
ADMISSIONS_WORD = re.compile(
    r"^(admission|apply|applying|applicant|undergrad|future-student|prospective)",
    re.I,
)


def looks_like_admissions(path: str) -> bool:
    first = path.strip("/").split("/")[0]
    return bool(first) and bool(ADMISSIONS_WORD.match(first))


def reachable(url: str, timeout: int = 8) -> str | None:
    """The URL after redirects, or None. GET rather than HEAD: a surprising
    number of university servers answer HEAD with 405."""
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if r.status != 200:
                return None
            r.read(2048)
            # Some servers hand back the default port explicitly. A student
            # should not be shown "https://www.college.columbia.edu:443/".
            return re.sub(r":(?:80|443)(?=/|$)", "", r.geturl())
    except Exception:  # noqa: BLE001 - every failure means the same thing here
        return None


def resolve(website: str) -> str | None:
    host = up.urlparse(website).netloc
    root = host.removeprefix("www.")

    for sub in SUBDOMAINS:
        found = reachable(f"https://{sub}.{root}/")
        if not found:
            continue
        # A subdomain that redirects back to the homepage has told us nothing.
        if up.urlparse(found).netloc.removeprefix("www.") == root:
            continue
        return found

    base = website.rstrip("/")
    for path in PATHS:
        found = reachable(f"{base}/{path}")
        if not found:
            continue
        # Soft 404. Plenty of university sites answer every path with 200 and
        # then redirect somewhere else entirely, so the status code proves
        # nothing and the landing URL has to be read. Harvard answers
        # /admissions by redirecting to /programs/, which is a real page, is
        # not a 404, and is not admissions.
        landed = up.urlparse(found)
        if landed.path.strip("/") in ("", "index.html"):
            continue
        # The word has to be the FIRST segment, not merely somewhere in the
        # path. Harvard answers /admissions by redirecting to
        # /task-force-on-antisemitism/admissions-and-early-student-experiences/,
        # which contains "admissions", is a real page, and is emphatically not
        # where a seventeen-year-old should be sent.
        if not looks_like_admissions(landed.path):
            continue
        return found

    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--requirements", help="only resolve schools in this file")
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()

    catalog = {c["unitid"]: c for c in
               (json.loads(l) for l in open(args.catalog))}

    if args.requirements:
        wanted = [json.loads(l)["unitid"] for l in open(args.requirements)]
    else:
        wanted = list(catalog)

    # Anything already resolved stays resolved: a re-run should cost the
    # colleges nothing for the ones we have.
    have: dict[int, str] = {}
    if os.path.exists(args.out):
        for row in csv.DictReader(open(args.out)):
            if row.get("admissions_url"):
                have[int(row["unitid"])] = row["admissions_url"]

    todo = [u for u in wanted if u in catalog and catalog[u].get("website") and u not in have]
    print(f"{len(have)} already on file, resolving {len(todo)}")

    done = 0

    def work(unitid: int) -> tuple[int, str | None]:
        nonlocal done
        url = resolve(catalog[unitid]["website"])
        done += 1
        if done % 25 == 0:
            print(f"  {done}/{len(todo)}", flush=True)
        return unitid, url

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for unitid, url in pool.map(work, todo):
            if url:
                have[unitid] = url

    with open(args.out, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["unitid", "name", "admissions_url"])
        for unitid in sorted(have, key=lambda u: catalog[u]["name"]):
            w.writerow([unitid, catalog[unitid]["name"], have[unitid]])

    print(f"{len(have)} of {len(wanted)} have an admissions site -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
