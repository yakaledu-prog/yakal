#!/usr/bin/env python3
"""
Build the Yakal college catalog from public sources.

Layer 1 only. This script produces machine-derived data and is safe to re-run:
it never touches anything in ../curated/.

Inputs (see fetch_sources.sh):
  Most-Recent-Cohorts-Institution.csv   College Scorecard bulk institution file
  wikidata_images.csv                   Wikidata IPEDS-to-image join

Outputs (../out/):
  colleges.ndjson        one JSON object per line, keyed by unitid
  colleges.csv           same data, flat, for spreadsheet review
  coverage.md            field-by-field fill rates, regenerated every run

Usage:
  python3 build_catalog.py --scorecard PATH --wikidata PATH --out ../out
"""

import argparse
import json
import math
import os
import sys
from datetime import date

import pandas as pd

SCORECARD_COLS = [
    "UNITID", "OPEID6", "INSTNM", "CITY", "STABBR", "ZIP", "INSTURL", "NPCURL",
    "LATITUDE", "LONGITUDE", "CONTROL", "ICLEVEL", "PREDDEG", "LOCALE", "CCBASIC",
    "HBCU", "MENONLY", "WOMENONLY", "RELAFFIL", "CURROPER",
    "ADM_RATE", "ADM_RATE_ALL", "ADMCON7",
    "SATVR25", "SATVR75", "SATMT25", "SATMT75", "SAT_AVG", "ACTCM25", "ACTCM75",
    "UGDS", "STUFACR",
    "COSTT4_A", "TUITIONFEE_IN", "TUITIONFEE_OUT",
    "NPT4_PUB", "NPT4_PRIV", "NPT41_PUB", "NPT41_PRIV",
    "PCTPELL", "C150_4", "RET_FT4", "MD_EARN_WNE_P10",
]

CONTROL = {1: "public", 2: "private_nonprofit", 3: "private_for_profit"}

# ADMCON7, "test score requirements" in the Scorecard data dictionary.
# Only 1, 3 and 5 appear in the current file. Anything else is passed through
# as null rather than guessed at.
TEST_POLICY = {1: "required", 3: "not_considered", 5: "considered_not_required"}

# LOCALE, NCES urbanisation code, collapsed to the four families families care about.
LOCALE = {1: "city", 2: "suburb", 3: "town", 4: "rural"}


def clean(v):
    """Scorecard uses NaN, 'NULL' and 'PrivacySuppressed' for missing values."""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    if isinstance(v, str) and v.strip() in ("", "NULL", "PrivacySuppressed"):
        return None
    return v


def num(v, cast=float):
    v = clean(v)
    if v is None:
        return None
    try:
        return cast(v)
    except (TypeError, ValueError):
        return None


def pct(v):
    """Scorecard rates are 0-1 floats. Store as a percentage with one decimal."""
    v = num(v)
    return round(v * 100, 1) if v is not None else None


def net_price(row):
    """Public and private net price live in different columns. Only one is populated."""
    pub, priv = num(row.get("NPT4_PUB")), num(row.get("NPT4_PRIV"))
    return pub if pub is not None else priv


def net_price_lowest_bracket(row):
    """Average net price for families earning $0-30k, the number that matters most."""
    pub, priv = num(row.get("NPT41_PUB")), num(row.get("NPT41_PRIV"))
    return pub if pub is not None else priv


def sat_range(row):
    """Composite middle-50 from the two section ranges. Sections are reported
    separately, so the composite band is the sum of the section bands."""
    v25, v75 = num(row.get("SATVR25")), num(row.get("SATVR75"))
    m25, m75 = num(row.get("SATMT25")), num(row.get("SATMT75"))
    if None in (v25, v75, m25, m75):
        return None, None
    return int(v25 + m25), int(v75 + m75)


def https(url):
    url = clean(url)
    if not url:
        return None
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def build_row(row, wd):
    unitid = int(row["UNITID"])
    sat25, sat75 = sat_range(row)
    w = wd.get(unitid, {})

    return {
        # identity
        "unitid": unitid,
        "opeid6": (lambda v: f"{v:06d}" if v is not None else None)(
            num(row.get("OPEID6"), int)
        ),
        "name": clean(row.get("INSTNM")),
        "city": clean(row.get("CITY")),
        "state": clean(row.get("STABBR")),
        "zip": clean(row.get("ZIP")),
        "lat": num(row.get("LATITUDE")),
        "lon": num(row.get("LONGITUDE")),
        "website": https(row.get("INSTURL")),
        "net_price_calculator_url": https(row.get("NPCURL")),

        # classification
        "control": CONTROL.get(num(row.get("CONTROL"), int)),
        "locale": LOCALE.get(
            int(str(int(num(row.get("LOCALE"), int) or 0))[0])
            if num(row.get("LOCALE"), int) and num(row.get("LOCALE"), int) > 0
            else 0
        ),
        "carnegie_basic": num(row.get("CCBASIC"), int),
        "hbcu": bool(num(row.get("HBCU"), int)),
        "men_only": bool(num(row.get("MENONLY"), int)),
        "women_only": bool(num(row.get("WOMENONLY"), int)),
        "religious_affiliation_code": num(row.get("RELAFFIL"), int),

        # admissions
        "admit_rate_pct": pct(row.get("ADM_RATE")),
        "test_policy": TEST_POLICY.get(num(row.get("ADMCON7"), int)),
        "sat_total_25": sat25,
        "sat_total_75": sat75,
        "sat_ebrw_25": num(row.get("SATVR25"), int),
        "sat_ebrw_75": num(row.get("SATVR75"), int),
        "sat_math_25": num(row.get("SATMT25"), int),
        "sat_math_75": num(row.get("SATMT75"), int),
        "sat_avg": num(row.get("SAT_AVG"), int),
        "act_composite_25": num(row.get("ACTCM25"), int),
        "act_composite_75": num(row.get("ACTCM75"), int),

        # size and outcomes
        "undergrads": num(row.get("UGDS"), int),
        "student_faculty_ratio": num(row.get("STUFACR")),
        "retention_rate_pct": pct(row.get("RET_FT4")),
        "grad_rate_6yr_pct": pct(row.get("C150_4")),
        "median_earnings_10yr": num(row.get("MD_EARN_WNE_P10"), int),

        # cost
        "cost_of_attendance": num(row.get("COSTT4_A"), int),
        "tuition_in_state": num(row.get("TUITIONFEE_IN"), int),
        "tuition_out_of_state": num(row.get("TUITIONFEE_OUT"), int),
        "avg_net_price": num(net_price(row), int),
        "avg_net_price_income_0_30k": num(net_price_lowest_bracket(row), int),
        "pct_pell": pct(row.get("PCTPELL")),

        # media, from Wikidata
        "image_url": w.get("image"),
        "logo_url": w.get("logo"),
        "wikidata_label": w.get("label"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scorecard", required=True)
    ap.add_argument("--wikidata", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--all-levels",
        action="store_true",
        help="Include 2-year and non-bachelor institutions. Default is "
        "currently-operating 4-year bachelor-predominant only.",
    )
    args = ap.parse_args()

    df = pd.read_csv(args.scorecard, usecols=SCORECARD_COLS, low_memory=False)
    before = len(df)
    if not args.all_levels:
        df = df[(df.CURROPER == 1) & (df.ICLEVEL == 1) & (df.PREDDEG == 3)]
    print(f"scorecard rows: {before} -> {len(df)} after filter", file=sys.stderr)

    wdf = pd.read_csv(args.wikidata)
    wdf["ipeds"] = pd.to_numeric(wdf["ipeds"], errors="coerce")
    wdf = wdf.dropna(subset=["ipeds"]).drop_duplicates("ipeds")
    wd = {
        int(r.ipeds): {
            "image": clean(r.image),
            "logo": clean(r.logo),
            "label": clean(r.itemLabel),
        }
        for r in wdf.itertuples()
    }
    print(f"wikidata rows: {len(wd)}", file=sys.stderr)

    rows = [build_row(r, wd) for r in df.to_dict("records")]
    rows.sort(key=lambda r: (-(r["undergrads"] or 0), r["name"] or ""))

    os.makedirs(args.out, exist_ok=True)

    ndjson = os.path.join(args.out, "colleges.ndjson")
    with open(ndjson, "w") as f:
        for r in rows:
            f.write(json.dumps(r, separators=(",", ":")) + "\n")

    pd.DataFrame(rows).to_csv(os.path.join(args.out, "colleges.csv"), index=False)

    # Coverage report. This is the honest part: it says exactly how much of each
    # field is actually populated, so nobody builds UI on a field that is 30% null.
    total = len(rows)
    lines = [
        "# Catalog coverage",
        "",
        f"Generated {date.today().isoformat()} from College Scorecard and Wikidata.",
        f"Institutions: **{total}** "
        "(currently operating, 4-year, predominantly bachelor's).",
        "",
        "Regenerated by `build_catalog.py` on every run. Do not edit by hand.",
        "",
        "| Field | Filled | % |",
        "|---|---:|---:|",
    ]
    for k in rows[0]:
        n = sum(1 for r in rows if r[k] not in (None, "", False))
        lines.append(f"| `{k}` | {n} | {n / total * 100:.0f}% |")

    top = rows[:300]
    lines += [
        "",
        "## Top 300 by undergraduate enrollment",
        "",
        "The subset that will cover the overwhelming majority of real applications.",
        "",
        "| Field | Filled | % |",
        "|---|---:|---:|",
    ]
    for k in ("admit_rate_pct", "sat_total_25", "act_composite_25", "avg_net_price",
              "cost_of_attendance", "student_faculty_ratio", "test_policy",
              "image_url", "logo_url"):
        n = sum(1 for r in top if r[k] not in (None, "", False))
        lines.append(f"| `{k}` | {n} | {n / len(top) * 100:.0f}% |")

    lines += [
        "",
        "## Not in this file",
        "",
        "These are the fields no public API supplies. They live in `../curated/` and",
        "are maintained by hand, once per admissions cycle:",
        "",
        "- application deadlines by round (ED, ED II, EA, REA, RD, rolling)",
        "- supplemental essay counts and prompt text",
        "- number of recommendation letters required",
        "- admitted-student GPA (Common Data Set section C, not in any API)",
        "- Common App participation",
        "- application fee and fee-waiver policy",
    ]

    with open(os.path.join(args.out, "coverage.md"), "w") as f:
        f.write("\n".join(lines) + "\n")

    print(f"wrote {total} institutions to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
