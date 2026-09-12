#!/usr/bin/env python3
"""
Common App's own page for each of its 1,167 member colleges.

Found while checking three competitor prompt aggregators. One of them says
outright where its data comes from: "straight from each school's Common App
application". That is true of all of them, and it is why none of them is worth
copying. The application itself needs a student login, so the prompts are not
here. Everything else about a member college is.

What this is for is the join key and the fields we were guessing at:

  field_su_ipeds              IPEDS unitid, stated. match_to_catalog.py exists
                              because the requirements grid gives only a name,
                              and name matching is where that file's careful
                              rules come from. Here the id is simply given, so
                              nothing has to be inferred.
  field_su_addr_fy_adm_website
                              the first-year admissions page, from the college
                              itself via its Common App membership record.
                              resolve_admissions_host.py guesses this by asking
                              whether admission.<domain> answers and reached 872
                              of 951. This is the answer rather than a guess,
                              and it is first-year specific, which the guess
                              cannot be.
  field_su_alternate_names    "VU, Vandy" for Vanderbilt. The college search
                              matches on the catalogue name only, so a student
                              typing Vandy currently gets nothing.
  field_su_img_logo           the college's own logo, as supplied to Common App.
  field_su_ff_fy_*            per-college application facts: personal essay
                              required, recommendations required, fee, test
                              policy.

robots.txt allows this (it blocks training crawlers by name and allows
everything else), the pages are in the published sitemap, and each is one
static JSON built by Gatsby, so this reads the same bytes a browser would and
asks for nothing a visitor does not get.

    python3 harvest_explore.py --out ../out/commonapp-explore.ndjson
"""

import argparse, json, os, sys, time
import urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

SITEMAP = "https://www.commonapp.org/sitemap-0.xml"
BASE = "https://www.commonapp.org"


def get(url: str, tries: int = 3) -> bytes:
    last = None
    for n in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (n + 1))
    raise last


def slugs() -> list[str]:
    """The member colleges, from the sitemap rather than a guessed range."""
    import re
    xml = get(SITEMAP).decode("utf-8", "replace")
    found = re.findall(r"<loc>\s*https://www\.commonapp\.org/explore/([^<\s/]+)\s*</loc>", xml)
    return sorted(dict.fromkeys(found))


def pick(slug: str) -> dict | None:
    """One college, flattened to the fields worth keeping.

    Gatsby serves the page's data at a parallel /page-data path, which is the
    same content the rendered page shows without the markup around it.
    """
    raw = get(f"{BASE}/page-data/explore/{slug}/page-data.json")
    doc = json.loads(raw)
    node = (doc.get("result", {}).get("data", {}) or {}).get("nodeSchool")
    if not node:
        return None
    su = (node.get("relationships", {}) or {}).get("field_site_update") or {}
    rel = (su.get("relationships", {}) or {})

    def asset(key: str) -> str | None:
        f = (rel.get(key) or {}).get("localFile") or {}
        url = f.get("publicURL")
        return BASE + url if url else None

    ipeds = su.get("field_su_ipeds")
    # A real IPEDS unitid is six digits. Georgetown University in Qatar is
    # recorded as 5555540, which is a placeholder for a campus that has no
    # unitid because it is not a US institution. Treated as absent: a made-up
    # id that looks like a number is worse than a blank, because it joins.
    unitid = int(ipeds) if str(ipeds or "").isdigit() else None
    if unitid is not None and not (100_000 <= unitid <= 999_999):
        unitid = None
    return {
        "slug": slug,
        # Stated by the college on its membership record. Kept as an int so it
        # joins to the catalogue without a cast at every use.
        "unitid": unitid,
        "name": node.get("title"),
        "member_id": node.get("field_member_id"),
        "alternate_names": su.get("field_su_alternate_names"),
        "admissions_url": su.get("field_su_addr_fy_adm_website")
        or su.get("field_su_addr_adm_website"),
        "admissions_email": su.get("field_su_addr_adm_email"),
        "admissions_phone": su.get("field_su_addr_adm_phone"),
        "city": su.get("field_su_addr_city"),
        "state": su.get("field_su_addr_state"),
        "country": su.get("field_su_addr_country"),
        "type": su.get("field_su_details_type"),
        "setting": su.get("field_su_details_campus_setting"),
        "size": su.get("field_su_details_enroll_size"),
        # First-year application facts. "per" is the personal essay, "rec_req"
        # recommendations, "caf" the application fee, "tp" the test policy.
        "fy_personal_essay": su.get("field_su_ff_fy_per"),
        "fy_recommendations": su.get("field_su_ff_fy_rec_req"),
        "fy_fee": su.get("field_su_ff_fy_caf"),
        "fy_test_policy": su.get("field_su_ff_fy_tp"),
        "logo_url": asset("field_su_img_logo"),
        "hero_url": asset("field_school_hero"),
        "source_url": f"{BASE}/explore/{slug}",
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="../out/commonapp-explore.ndjson")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    names = slugs()
    if args.limit:
        names = names[: args.limit]
    print(f"{len(names)} member colleges in the sitemap", file=sys.stderr)

    rows: list[dict] = []
    done = 0

    def one(slug: str):
        nonlocal done
        try:
            row = pick(slug)
        except Exception as exc:  # noqa: BLE001
            print(f"  skip {slug} ({type(exc).__name__})", file=sys.stderr)
            row = None
        done += 1
        if done % 100 == 0:
            print(f"  {done}/{len(names)}", file=sys.stderr)
        return row

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for row in pool.map(one, names):
            if row:
                rows.append(row)

    rows.sort(key=lambda r: r["name"] or "")
    out = os.path.abspath(os.path.join(os.path.dirname(__file__), args.out))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    withid = sum(1 for r in rows if r["unitid"])
    withadm = sum(1 for r in rows if r["admissions_url"])
    withlogo = sum(1 for r in rows if r["logo_url"])
    withalt = sum(1 for r in rows if r["alternate_names"])
    print(
        f"{len(rows)} colleges: {withid} with an IPEDS id, {withadm} with an "
        f"admissions link, {withlogo} with a logo, {withalt} with aliases",
        file=sys.stderr,
    )
    print(f"wrote {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
