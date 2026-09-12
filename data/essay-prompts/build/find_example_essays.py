#!/usr/bin/env python3
"""
Colleges that publish essays which were actually admitted, and where.

Not part of the prompts pipeline. It is here because the crawl is already
visiting every admissions site in the country and a handful of them publish
"Essays That Worked": Johns Hopkins, Hamilton, Tufts, Connecticut College and
others put real admitted-student essays online with the admissions office's own
commentary on why they worked. For a counselling product that is the single
most useful thing a student can read before drafting, and there is no list of
which colleges do it.

**URLs only, deliberately.** The essays are student work and the commentary is
the college's; both are somebody else's copyright and neither belongs in our
database. A link is a link.

    python3 find_example_essays.py --sources ../curated/sources-2026-27.csv \
        --out ../out/example-essays.csv
"""

import argparse, csv, os, re, sys, threading
import urllib.parse as up
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# What colleges call the page. "Essays that worked" is the common one; the rest
# are variations seen in the wild.
PATHS = [
    "essays-that-worked",
    "application-process/essays-that-worked",
    "apply/essays-that-worked",
    "essays-that-worked-2026",
    "sample-essays",
    "admitted-student-essays",
    "college-essays-that-worked",
    "apply/sample-essays",
]

# The page has to actually carry essays, not a blog post about them.
MARKERS = re.compile(
    r"essays?\s+that\s+worked|admitted\s+student\s+essay|"
    r"sample\s+(application\s+)?essay|read\s+(their|the)\s+essay",
    re.I,
)


def get(url: str, timeout: int = 10) -> tuple[str, str] | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            if r.status != 200 or "html" not in r.headers.get("Content-Type", ""):
                return None
            charset = r.headers.get_content_charset() or "utf-8"
            return r.read(1_200_000).decode(charset, errors="replace"), r.geturl()
    except Exception:  # noqa: BLE001 - a missing page is the normal case
        return None


def find(admissions: str) -> str | None:
    base = admissions.rstrip("/")
    root = f"{up.urlparse(base).scheme}://{up.urlparse(base).netloc}"
    for path in PATHS:
        for host in dict.fromkeys([base, root]):
            got = get(f"{host}/{path}")
            if not got:
                continue
            body, final = got
            text = re.sub(r"(?s)<[^>]+>", " ", body)
            if MARKERS.search(text):
                return final
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()

    rows = [r for r in csv.DictReader(open(args.sources)) if r.get("admissions_url")]
    have: dict[str, dict] = {}
    if os.path.exists(args.out):
        for r in csv.DictReader(open(args.out)):
            have[r["unitid"]] = r

    lock = threading.Lock()
    done = 0

    def work(row) -> None:
        nonlocal done
        if row["unitid"] in have:
            return
        url = find(row["admissions_url"])
        with lock:
            done += 1
            if url:
                have[row["unitid"]] = {
                    "unitid": row["unitid"], "name": row["name"], "url": url
                }
                print(f"OK   {row['name'][:42]}  {url}", flush=True)

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(work, rows))

    with open(args.out, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["unitid", "name", "url"])
        w.writeheader()
        for uid in sorted(have, key=lambda u: have[u]["name"]):
            w.writerow(have[uid])

    print(f"\n{len(have)} colleges publish admitted essays -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
