#!/usr/bin/env python3
"""
Common App Requirements Grid -> NDJSON.

The grid is the only authoritative, machine-readable source of first-year
application deadlines in existence. data/colleges/README.md concluded that
deadlines were unscrapeable, and it was right about college websites: it tested
three admissions pages and got JavaScript, ambiguity and silence. It missed
this file, which Common App publishes itself and updates through the cycle.
Every date in here is the college's own answer on Common App's own form, which
is a different class of evidence from a sentence parsed off a marketing page.

It is a PDF of a Google Sheet, so it has no text structure at all, only words
at coordinates. Columns are recovered by x position against the header, and
rows by anchoring on the School type cell (Coed / Women / Men / Coordinate),
which appears exactly once per school and is vertically centred on its row.
Anchoring on the name would not work: long names wrap onto two or three lines.

    python3 parse_reqgrid.py --pdf ReqGrid.pdf --out ../out/requirements.ndjson
"""

import argparse, json, re, subprocess, sys, unicodedata
from html import unescape

# Column boundaries, midway between the header labels' x centres. Read off
# page 2 of the 2026-27 grid; re-check these if the sheet ever gains a column.
COLUMNS = [
    ("name",        0,    78),
    ("school_type", 78,   110),
    ("ed",          110,  138),
    ("ed2",         138,  168),
    ("ea",          168,  197),
    ("ea2",         197,  228),
    ("rea",         228,  255),
    ("rd",          255,  290),
    ("fee_us",      290,  318),
    ("fee_intl",    318,  350),
    ("fee_waiver",  350,  394),
    ("personal_essay", 394, 424),
    ("courses_grades", 424, 457),
    ("portfolio",   457,  491),
    ("writing_supplement", 491, 521),
    ("test_policy", 521,  551),
    ("tests_used",  551,  597),
    ("english_proficiency", 597, 640),
    ("rec_teacher", 640,  663),
    ("rec_other",   663,  691),
    ("rec_midyear", 691,  717),
    ("rec_counselor", 717, 745),
    ("saves_forms", 745,  10_000),
]

TYPES = {"Coed", "Women", "Men", "Coordinate"}
WORD = re.compile(
    r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>'
)


def words_by_page(pdf: str):
    """Every word with its box, one list per page."""
    xml = subprocess.run(
        ["pdftotext", "-bbox-layout", pdf, "-"],
        check=True, capture_output=True, text=True,
    ).stdout
    for page in xml.split("<page ")[1:]:
        yield [
            (float(x0), float(y0), float(x1), float(y1), unescape(t))
            for x0, y0, x1, y1, t in WORD.findall(page)
        ]


def column_of(x0: float, x1: float) -> str | None:
    centre = (x0 + x1) / 2
    for name, lo, hi in COLUMNS:
        if lo <= centre < hi:
            return name
    return None


# A school name can wrap onto three lines at about 5.5pt each, so a row is
# a couple of lines either side of its anchor and never more. The bound is what
# keeps the "Page 53" footer out of the bottom row of every page, and the
# footnotes block off the back of Yeshiva University, which is the last anchor
# in the document and would otherwise swallow all of it.
ROW_REACH = 14.0


def rows_on_page(words):
    """Split a page's words into one dict per school."""
    anchors = sorted(
        (y0 + y1) / 2
        for x0, y0, x1, y1, t in words
        if t in TYPES and column_of(x0, x1) == "school_type"
    )
    if not anchors:
        return []

    # A word belongs to the anchor whose band it falls in. Bands meet halfway
    # between anchors, which is what keeps a name wrapped onto a second line
    # with its own row rather than the next one.
    edges = [float("-inf")]
    edges += [(a + b) / 2 for a, b in zip(anchors, anchors[1:])]
    edges.append(float("inf"))

    rows = [{c: [] for c, _, _ in COLUMNS} for _ in anchors]
    for x0, y0, x1, y1, t in words:
        col = column_of(x0, x1)
        if not col:
            continue
        y = (y0 + y1) / 2
        for i in range(len(anchors)):
            if edges[i] <= y < edges[i + 1]:
                if abs(y - anchors[i]) <= ROW_REACH:
                    rows[i][col].append((y, x0, t))
                break

    out = []
    for row in rows:
        cell = {}
        for col, items in row.items():
            items.sort(key=lambda w: (round(w[0], 1), w[1]))
            cell[col] = " ".join(t for _, _, t in items).strip()
        out.append(cell)
    return out


DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})$")


def iso(value: str) -> str | None:
    """'11/1/2026' -> '2026-11-01'. Anything else is not a date."""
    m = DATE.match(value.strip())
    if not m:
        return None
    month, day, year = (int(g) for g in m.groups())
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def money(value: str) -> int | None:
    """'$65' -> 6500. Fees are whole dollars throughout the grid."""
    v = value.replace(",", "").strip()
    if not v.startswith("$"):
        return None
    try:
        return int(round(float(v[1:]) * 100))
    except ValueError:
        return None


def count(value: str) -> int | None:
    v = value.strip()
    return int(v) if v.isdigit() else None


def clean(value: str) -> str | None:
    v = " ".join(value.split())
    return v or None


def normalise(name: str) -> str:
    """For joining to the catalog, where punctuation and case disagree."""
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(s.split())


def parse(pdf: str) -> list[dict]:
    rows = []
    for words in words_by_page(pdf):
        rows.extend(rows_on_page(words))

    out = []
    for r in rows:
        name = clean(r["name"])
        if not name:
            continue
        # The RD column holds either a date or the word Rolling.
        rd_raw = clean(r["rd"]) or ""
        out.append({
            "name": name,
            "normalised": normalise(name),
            "school_type": clean(r["school_type"]),
            "deadlines": {
                "ed": iso(r["ed"]),
                "ed2": iso(r["ed2"]),
                "ea": iso(r["ea"]),
                "ea2": iso(r["ea2"]),
                "rea": iso(r["rea"]),
                "rd": iso(rd_raw),
            },
            "rolling": rd_raw.lower().startswith("rolling"),
            "fee_us_cents": money(r["fee_us"]),
            "fee_intl_cents": money(r["fee_intl"]),
            "fee_waiver": clean(r["fee_waiver"]),
            # A blank cell means not required, which is a real answer here and
            # not missing data: the grid fills the cell for every member.
            "personal_essay_required": clean(r["personal_essay"]) == "Y",
            "courses_grades_required": clean(r["courses_grades"]) == "Y",
            "portfolio": clean(r["portfolio"]),
            # The 2026-27 grid prints this column's heading on all 54 pages
            # and leaves every cell blank, so "not Y" means "not stated", not
            # "not required". Emitting False here claimed all 1,114 colleges
            # had waived their supplement, Yale included. None says what we
            # actually know. load-admissions-data.ts already writes null for
            # the same reason; this stops the NDJSON disagreeing with it.
            "writing_supplement_required":
                (clean(r["writing_supplement"]) or None)
                and clean(r["writing_supplement"]) == "Y",
            "test_policy": clean(r["test_policy"]),
            "tests_used": clean(r["tests_used"]),
            "english_proficiency": clean(r["english_proficiency"]),
            "recs": {
                "teacher": count(r["rec_teacher"]),
                "other": count(r["rec_other"]),
                "midyear": clean(r["rec_midyear"]) == "Y",
                "counselor": clean(r["rec_counselor"]) == "Y",
            },
            "saves_forms": clean(r["saves_forms"]) == "Y",
        })
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    rows = parse(args.pdf)
    with open(args.out, "w") as fh:
        for row in rows:
            fh.write(json.dumps(row) + "\n")

    # None, not False: the column is blank for everybody in this grid.
    supp = sum(1 for r in rows if r["writing_supplement_required"] is not None)
    dated = sum(1 for r in rows if any(r["deadlines"].values()))
    print(f"{len(rows)} schools -> {args.out}")
    print(f"  {dated} with at least one dated deadline")
    print(f"  {supp} stating a writing supplement either way")
    return 0


if __name__ == "__main__":
    sys.exit(main())
