#!/usr/bin/env python3
"""
Generate the per-cycle curation template.

Produces a CSV pre-populated with identity columns from the machine catalog and
blank columns for everything a human has to look up. One row per school, sorted
so the highest-volume schools get curated first and a partial pass is still useful.

The output is the ONLY file in this project that is edited by hand. Never
overwrite a filled-in cycle file: pass --out to a new path for each cycle.

Usage:
  python3 make_curation_template.py --catalog ../out/colleges.ndjson \
      --cycle 2027 --top 300 --out ../curated/cycle_2027.csv
"""

import argparse
import csv
import json
import os

# Filled by the curator. Column order is the order a person will work through a
# school's admissions page, which matters when you are doing 300 of them.
CURATED_COLUMNS = [
    "common_app",              # yes / no
    "coalition_app",           # yes / no
    "own_application",         # yes / no
    "application_fee",         # integer dollars, 0 if free
    "fee_waiver_available",    # yes / no
    "deadline_ed1",            # YYYY-MM-DD, blank if not offered
    "deadline_ed2",
    "deadline_ea",
    "deadline_rea",            # restrictive / single-choice early action
    "deadline_rd",
    "deadline_rolling",        # yes / no
    "deadline_priority",       # priority or scholarship deadline
    "notify_ed1",              # decision release date
    "notify_rd",
    "supplemental_essay_count",
    "supplemental_essays_json",  # [{"prompt": "...", "word_limit": 300, "required": true}]
    "recs_teacher_required",
    "recs_counselor_required",
    "recs_max_optional",
    "interview",               # required / optional / evaluative / none
    "portfolio_required",      # yes / no
    "admitted_gpa_avg",        # Common Data Set section C, unweighted
    "admitted_gpa_scale",      # 4.0 / weighted
    "cds_url",                 # link to the Common Data Set PDF used
    "source_url",              # the admissions page the curator read
    "verified_by",             # initials
    "verified_on",             # YYYY-MM-DD
    "notes",
]

IDENTITY_COLUMNS = [
    "unitid", "name", "state", "control", "undergrads", "admit_rate_pct", "website",
]


def priority(r):
    """Curation order.

    Ranking purely by enrollment puts the online mega-universities first
    (Southern New Hampshire, Western Governors, Phoenix), which are almost never
    what a Yakal family is applying to. They also have no meaningful deadlines to
    curate: they are open-admission and rolling.

    So: rank by size, but damp schools that admit essentially everyone, and damp
    schools with no admissions data at all. This is a heuristic for ordering the
    work queue, not a quality judgement about any institution.
    """
    ugds = r.get("undergrads") or 0
    rate = r.get("admit_rate_pct")

    if rate is None:
        selectivity = 0.35        # no admissions data, likely open enrollment
    elif rate >= 95:
        selectivity = 0.15        # effectively open admission
    elif rate >= 80:
        selectivity = 0.60
    else:
        selectivity = 1.0

    # Test scores on file is a decent signal that this is a traditional
    # application-driven undergraduate institution.
    if r.get("sat_total_25") or r.get("act_composite_25"):
        selectivity *= 1.35

    return ugds * selectivity


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--cycle", required=True, help="e.g. 2027 for fall 2027 entry")
    ap.add_argument("--top", type=int, default=300)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if os.path.exists(args.out):
        raise SystemExit(
            f"refusing to overwrite {args.out}. Curated files are hand-edited. "
            "Pass a new --out path, or delete the file deliberately."
        )

    rows = [json.loads(line) for line in open(args.catalog)]
    rows.sort(key=lambda r: -priority(r))
    rows = rows[: args.top]

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["cycle"] + IDENTITY_COLUMNS + CURATED_COLUMNS)
        for r in rows:
            w.writerow(
                [args.cycle] + [r.get(c, "") for c in IDENTITY_COLUMNS]
                + [""] * len(CURATED_COLUMNS)
            )

    print(f"wrote {len(rows)} rows to {args.out}")
    print(f"{len(CURATED_COLUMNS)} columns per school need a human.")


if __name__ == "__main__":
    main()
