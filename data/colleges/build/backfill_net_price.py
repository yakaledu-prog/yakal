#!/usr/bin/env python3
"""
Fill the net price income bands into an existing catalog, without rebuilding it.

build_catalog.py reads the Scorecard bulk CSV and now carries all five bands.
Running it is an annual, whole-catalog operation: it downloads a 200 MB release
and replaces every field for all 1,944 colleges, so using it to add four
columns would churn admit rates, test bands and costs at the same time.

The Scorecard API serves the identical fields from the identical release, so
this asks for those four and leaves everything else exactly as it is. After the
next annual refresh this script has nothing to do, which is the intended end
state rather than a limitation.

    python3 backfill_net_price.py --catalog ../out/colleges.ndjson

DEMO_KEY is rate limited but sufficient: this is 1,944 colleges in pages of 100,
about twenty requests, run once.
"""

import argparse, json, os, sys, time
import urllib.parse as up
import urllib.request

API = "https://api.data.gov/ed/collegescorecard/v1/schools"

# The four bands build_catalog.py did not previously keep, plus the one it did,
# so a row that is missing all five is filled in one pass.
BANDS = [
    ("avg_net_price_income_0_30k", "0-30000"),
    ("avg_net_price_income_30_48k", "30001-48000"),
    ("avg_net_price_income_48_75k", "48001-75000"),
    ("avg_net_price_income_75_110k", "75001-110000"),
    ("avg_net_price_income_110k_plus", "110001-plus"),
]


def fields() -> str:
    """Public and private net price live in separate trees, as in the CSV."""
    out = ["id"]
    for _, band in BANDS:
        out.append(f"latest.cost.net_price.public.by_income_level.{band}")
        out.append(f"latest.cost.net_price.private.by_income_level.{band}")
    return ",".join(out)


def fetch(ids: list[int], key: str) -> dict[int, dict]:
    query = up.urlencode({
        "api_key": key,
        "id": ",".join(str(i) for i in ids),
        "fields": fields(),
        "per_page": len(ids),
    })
    req = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": "YakalCollegeCatalog/0.1"})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())

    out: dict[int, dict] = {}
    for row in body.get("results", []):
        unitid = row.get("id")
        if not unitid:
            continue
        vals = {}
        for name, band in BANDS:
            pub = row.get(f"latest.cost.net_price.public.by_income_level.{band}")
            priv = row.get(f"latest.cost.net_price.private.by_income_level.{band}")
            v = pub if pub is not None else priv
            vals[name] = int(v) if isinstance(v, (int, float)) else None
        out[int(unitid)] = vals
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--key", default=os.environ.get("SCORECARD_API_KEY", "DEMO_KEY"))
    ap.add_argument("--chunk", type=int, default=100)
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(args.catalog)]
    ids = [int(r["unitid"]) for r in rows]
    print(f"{len(rows)} colleges", file=sys.stderr)

    got: dict[int, dict] = {}
    for i in range(0, len(ids), args.chunk):
        batch = ids[i:i + args.chunk]
        for attempt in range(3):
            try:
                got.update(fetch(batch, args.key))
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 2:
                    print(f"  giving up on {batch[0]}..{batch[-1]}: {exc}", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
        print(f"  {min(i + args.chunk, len(ids))}/{len(ids)}", file=sys.stderr)

    filled = 0
    for r in rows:
        vals = got.get(int(r["unitid"]))
        if not vals:
            continue
        for name, _ in BANDS:
            r[name] = vals[name]
        if any(vals[name] is not None for name, _ in BANDS):
            filled += 1

    with open(args.catalog, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    for name, _ in BANDS:
        n = sum(1 for r in rows if r.get(name) is not None)
        print(f"  {name:34} {n:5}/{len(rows)}", file=sys.stderr)
    print(f"{filled} colleges have at least one band -> {args.catalog}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
