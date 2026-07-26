#!/usr/bin/env python3
"""
Build the browser-facing catalog bundle.

The full catalog is 2.1 MB of NDJSON, which is too much to ship to a phone. This
emits a compact array-of-arrays payload with only the fields the Explore page
filters and renders, plus the image attribution the CC BY licences require.

Array-of-arrays rather than array-of-objects: repeating 14 key names across 1,944
records costs roughly 250 KB before compression and buys nothing. The column
order is emitted in the payload header so the client stays in sync automatically.

Usage:
  python3 make_client_bundle.py --catalog ../out/colleges.ndjson \
      --licenses ../out/image_licenses.ndjson \
      --out ../../../public/data/colleges.json
"""

import argparse
import json
import os
import urllib.parse

# Column order. The client reads this from the payload, so adding a field here
# and in `pick()` is the only change needed on this side.
COLUMNS = [
    "unitid",
    "name",
    "city",
    "state",
    "control",       # 0 public, 1 private nonprofit, 2 private for-profit
    "locale",        # 0 city, 1 suburb, 2 town, 3 rural
    "undergrads",
    "admitRate",     # percent, one decimal
    "testPolicy",    # 0 required, 1 considered not required, 2 not considered
    "satLow",
    "satHigh",
    "actLow",
    "actHigh",
    "netPrice",
    "cost",
    "ratio",
    "gradRate",
    "image",         # Commons filename only, the client builds the URL
    "credit",        # photographer, for the attribution line
]

CONTROL = {"public": 0, "private_nonprofit": 1, "private_for_profit": 2}
LOCALE = {"city": 0, "suburb": 1, "town": 2, "rural": 3}
TEST_POLICY = {"required": 0, "considered_not_required": 1, "not_considered": 2}


def commons_filename(url):
    if not url or "FilePath/" not in url:
        return None
    return urllib.parse.unquote(url.split("FilePath/")[-1])


def rnd(v, digits=0):
    if v is None:
        return None
    return int(round(v)) if digits == 0 else round(v, digits)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--licenses", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    # unitid -> photographer, so every rendered photo can carry its credit.
    credits = {}
    for line in open(args.licenses):
        rec = json.loads(line)
        if not rec.get("commercial_use_ok"):
            continue  # never ship an image we are not licensed to use
        artist = rec.get("artist") if rec.get("attribution_required") else None
        for uid in rec.get("unitids", []):
            credits[uid] = artist or ""

    rows, dropped = [], 0
    for line in open(args.catalog):
        r = json.loads(line)
        uid = r["unitid"]
        img = commons_filename(r.get("image_url"))

        # An image whose licence we could not confirm is treated as no image.
        if img and uid not in credits:
            img = None
            dropped += 1

        rows.append([
            uid,
            r.get("name"),
            r.get("city"),
            r.get("state"),
            CONTROL.get(r.get("control")),
            LOCALE.get(r.get("locale")),
            r.get("undergrads"),
            r.get("admit_rate_pct"),
            TEST_POLICY.get(r.get("test_policy")),
            r.get("sat_total_25"),
            r.get("sat_total_75"),
            r.get("act_composite_25"),
            r.get("act_composite_75"),
            r.get("avg_net_price"),
            r.get("cost_of_attendance"),
            rnd(r.get("student_faculty_ratio"), 1),
            rnd(r.get("grad_rate_6yr_pct")),
            img,
            credits.get(uid) or None,
        ])

    rows.sort(key=lambda x: -(x[6] or 0))

    payload = {
        "version": 1,
        "source": "US Dept of Education College Scorecard (Jun 2026) + Wikidata",
        "columns": COLUMNS,
        "rows": rows,
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    size = os.path.getsize(args.out)
    with_img = sum(1 for r in rows if r[17])
    print(f"wrote {len(rows)} schools to {args.out}")
    print(f"  {size / 1024:.0f} KB raw")
    print(f"  {with_img} with a licensed image, {dropped} dropped for unclear licence")


if __name__ == "__main__":
    main()
