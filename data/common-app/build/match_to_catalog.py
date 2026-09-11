#!/usr/bin/env python3
"""
Join the Common App requirements grid to the college catalog on unitid.

The grid names schools the way a school names itself ("Caltech", "Anderson
University (IN)"); the catalog uses IPEDS, which names them the way the federal
government does ("California Institute of Technology", "Bowling Green State
University-Main Campus"). So the join is by name, and a name join is where
wrong data comes from.

The failure that matters is not a miss, it is a confident wrong match. A first
draft matched "Columbia University" to "Columbia College" because it stripped
the words "university" and "college" as noise. That would have shown a student
Columbia College's deadline under Columbia's name, which is precisely the
"plausible wrong date" data/colleges/README.md refuses to ship.

So the rules are deliberately timid:

  - the institution word (university / college / institute / academy / school)
    must agree, so Columbia University can never become Columbia College
  - a parenthetical or trailing state is read as a state hint, never dropped
    silently, and a hint that disagrees with the catalog's state rejects
  - a campus suffix after a hyphen is only ignored when exactly one catalog
    row survives without it
  - a prefix match ("Columbia University" inside "Columbia University in the
    City of New York") is taken only when exactly one catalog row has it, which
    is why "Indiana University" matches nothing: it prefixes eight campuses
  - the one exception to that: where several candidates differ only by campus
    and exactly one of them is the main campus, the main campus wins
  - curated/manual_matches.csv overrides everything, so correcting a join is
    an edit to a data file rather than to this script
  - a college the grid lists more than once is dropped, not merged. Siena
    University appears three times with three different regular-decision dates,
    which are presumably three programmes; picking one of them would put a date
    on the screen that is right for some applicants and wrong for others
  - anything left over goes to unmatched.csv for a person to look at

Unmatched is mostly correct behaviour: the grid carries foreign universities
and community colleges, and the catalog is US four-year bachelor's-predominant
by design. Those should not match.

    python3 match_to_catalog.py --requirements ../out/requirements-2026-27.ndjson \
                                --catalog ../../colleges/out/colleges.ndjson \
                                --out ../out/requirements-2026-27.matched.ndjson \
                                --unmatched ../out/requirements-2026-27.unmatched.csv
"""

import argparse, csv, json, re, sys, unicodedata

STATES = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
    "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC",
    "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
    "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
    "district of columbia": "DC", "washington dc": "DC",
}
ABBR = set(STATES.values())

# The word that says what kind of institution this is. Two names that disagree
# on it are two different schools, however similar the rest reads.
KINDS = ["university", "college", "institute", "academy", "school",
         "seminary", "conservatory", "institution"]


def strip_accents(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def norm(name: str) -> str:
    s = strip_accents(name).lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = " ".join(s.split())
    # IPEDS writes "The College of Wooster", the grid writes "College of
    # Wooster". A leading article is never what distinguishes two schools.
    return s[4:] if s.startswith("the ") else s


def kind_of(name: str) -> str | None:
    words = norm(name).split()
    for k in KINDS:
        if k in words:
            return k
    return None


PAREN = re.compile(r"\s*\(([^)]*)\)\s*")


def split_hint(name: str) -> tuple[str, str | None]:
    """'Anderson University (IN)' -> ('Anderson University', 'IN')."""
    hint = None
    for inner in PAREN.findall(name):
        key = norm(inner)
        if key.upper() in ABBR:
            hint = key.upper()
        elif key in STATES:
            hint = STATES[key]
    base = PAREN.sub(" ", name)

    # 'Bethel University-TN' and 'Concordia University, St. Paul'
    m = re.search(r"[-,]\s*([A-Za-z .]+)$", base)
    if m:
        tail = norm(m.group(1))
        if tail.upper() in ABBR:
            hint = tail.upper()
            base = base[: m.start()]
        elif tail in STATES:
            hint = STATES[tail]
            base = base[: m.start()]

    return " ".join(base.split()), hint


def candidates(index, key):
    return index.get(key, [])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--requirements", required=True)
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--unmatched", required=True)
    ap.add_argument("--overrides", help="csv of grid_name,unitid decided by hand")
    args = ap.parse_args()

    overrides: dict[str, int] = {}
    if args.overrides:
        try:
            with open(args.overrides) as fh:
                for rec in csv.DictReader(fh):
                    if (rec.get("unitid") or "").strip().isdigit():
                        overrides[norm(rec["grid_name"])] = int(rec["unitid"])
        except FileNotFoundError:
            pass

    catalog = [json.loads(l) for l in open(args.catalog)]
    grid = [json.loads(l) for l in open(args.requirements)]

    exact: dict[str, list] = {}
    # The catalog's campus suffix: 'Purdue University-Main Campus'. Kept as a
    # second index rather than replacing the first, so an exact name always
    # wins over a stem.
    stem: dict[str, list] = {}
    for c in catalog:
        exact.setdefault(norm(c["name"]), []).append(c)
        base = c["name"].split("-")[0]
        if base != c["name"]:
            stem.setdefault(norm(base), []).append(c)

    by_unitid = {c["unitid"]: c for c in catalog}

    matched, unmatched = [], []
    for row in grid:
        base, hint = split_hint(row["name"])
        want_kind = kind_of(base)

        def ok(c):
            if hint and c.get("state") and c["state"] != hint:
                return False
            if want_kind and kind_of(c["name"]) and kind_of(c["name"]) != want_kind:
                return False
            return True

        picked, how = None, None

        forced = overrides.get(norm(row["name"]))
        if forced is not None and forced in by_unitid:
            picked, how = by_unitid[forced], "manual"

        for index, label in ((exact, "name"), (stem, "campus")):
            if picked:
                break
            pool = [c for c in candidates(index, norm(base)) if ok(c)]
            if len(pool) == 1:
                picked, how = pool[0], label
                break
            if len(pool) > 1:
                # One exception to ambiguity being fatal. IPEDS lists Ohio
                # State five times, once as "-Main Campus" and four times as a
                # regional campus, and the grid's single "The Ohio State
                # University" row is unmistakably the flagship. Where exactly
                # one candidate is the main campus, that is not a guess.
                main = [c for c in pool if re.search(r"main campus$", c["name"], re.I)]
                if len(main) == 1:
                    picked, how = main[0], "flagship"
                # Otherwise ambiguous is not matched: two Anderson
                # Universities with no state hint is a question, not a guess.
                break

        if not picked:
            # IPEDS often appends where the grid stops: "Columbia University"
            # against "Columbia University in the City of New York". Only
            # unique prefixes count, on a word boundary, so "Indiana
            # University" stays unmatched rather than picking a campus.
            needle = norm(base) + " "
            pool = [
                c for c in catalog
                if norm(c["name"]).startswith(needle) and ok(c)
            ]
            if len(pool) == 1:
                picked, how = pool[0], "prefix"

        if picked:
            out = dict(row)
            out["unitid"] = picked["unitid"]
            out["catalog_name"] = picked["name"]
            out["state"] = picked.get("state")
            out["match"] = how
            matched.append(out)
        else:
            unmatched.append(row)

    # One unitid, several grid rows: see the note at the top. Both copies go
    # to the review file so the duplication is visible rather than silent.
    claimed: dict[int, int] = {}
    for row in matched:
        claimed[row["unitid"]] = claimed.get(row["unitid"], 0) + 1
    contested = {u for u, n in claimed.items() if n > 1}
    for row in matched:
        if row["unitid"] in contested:
            unmatched.append({**row, "name": row["name"]})
    duplicated = len([r for r in matched if r["unitid"] in contested])
    matched = [r for r in matched if r["unitid"] not in contested]

    with open(args.out, "w") as fh:
        for row in matched:
            fh.write(json.dumps(row) + "\n")

    with open(args.unmatched, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["grid_name", "unitid", "note"])
        for row in unmatched:
            note = "listed more than once in the grid" if row.get("unitid") else ""
            w.writerow([row["name"], "", note])

    for how in ("name", "campus", "prefix", "flagship", "manual"):
        print(f"  {how:>7}: {sum(1 for r in matched if r['match'] == how)}")
    print(f"matched {len(matched)} of {len(grid)} -> {args.out}")
    print(f"unmatched {len(unmatched)} -> {args.unmatched}"
          + (f" ({duplicated} of them listed twice or more)" if duplicated else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
