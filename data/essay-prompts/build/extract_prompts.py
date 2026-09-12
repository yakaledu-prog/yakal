#!/usr/bin/env python3
"""
Turn fetched admissions pages into prompt candidates.

The seven colleges in supplements-2026-27.json were read by a person. This is
the other way of getting them, and it is worse: it takes the sentences on a
page that look like application questions and quotes them. It is right most of
the time and wrong some of the time, so every row it writes is marked
extraction='machine' and carries the page it came from, and the picker says so.

Nothing here is generated. Every prompt is a quotation from a page that was
actually fetched, which is the rule data/colleges/README.md set and the one
worth keeping: a plausible invented prompt is far worse than none.

What counts as a prompt:

  - a line of at least 45 characters that either ends in a question mark or
    opens with the verb an application question opens with, and
  - a word or character limit, either inside that line or stated once above a
    run of them, which is how most colleges write it

What is thrown away is as important: navigation, the college's advice about
writing essays, deadlines, and anything that reads like prose about the
process rather than the question itself. Erring towards dropping a real prompt
is the right direction, because the cost of a missing one is a student typing
it in and the cost of a wrong one is a week.

    python3 extract_prompts.py --pages ../out/pages \
        --sources ../curated/sources-2026-27.csv \
        --out ../out/supplements-2026-27.machine.json
"""

import argparse, csv, json, os, re, sys
from datetime import date

# "(200 words or fewer)", "150 word limit", "no more than 200 characters",
# "250 words maximum", "in 400 words or fewer".
LIMIT = re.compile(
    r"\b(\d{2,4})\s*(?:-|–)?\s*(word|character)s?\b|"
    r"\b(word|character)\s*(?:count|limit|maximum|max)\b[^.]{0,20}?\b(\d{2,4})\b",
    re.I,
)

ASKS = re.compile(
    r"^(describe|tell us|what|why|how|reflect|share|discuss|explain|elaborate|"
    r"imagine|choose|respond|write|consider|think|in\s+\d+|please|if you|"
    r"who|when|where|which|name|list|briefly|using)",
    re.I,
)

# A limit that belongs to the personal statement, not to this college's
# supplements. Pages say "the Common App essay is 650 words" near the top and
# every question below it inherited that, so Austin College's admissions FAQ
# came out as four 650 word prompts.
SOMEBODY_ELSES_LIMIT = re.compile(
    r"common\s*app|coalition|personal\s+statement|main\s+essay", re.I
)

# Truncated by the page's own layout: a line that stops on a preposition was
# cut mid-sentence and is not a question anybody can answer.
TRUNCATED = re.compile(
    r"\b(of|the|a|an|to|for|with|and|or|in|on|that|is|are|was|were)$", re.I
)

# Questions about the process rather than questions the college is asking. They
# are the same shape and they are all over an admissions page: "What if my
# scores have already been sent", "Carefully consider which teachers to ask".
PROCESS = re.compile(
    r"^(what if|when (should|do|can|will)|do i|can i|should i|how do i|"
    r"who (should|can) i|where (do|should)|is there|are there|will i|"
    r"what (coursework|factors|documents|materials|tests?|is your)|"
    r"how (many|much|long|often|will|does|is|are|quickly|soon)|"
    r"how \w+ (will|do|does|can|should) i|"
    # First person: an FAQ written in the applicant's voice, not the college's
    # question. "I am an international student. What is different..."
    r"i am |i.m an? |my (application|transcript|scores)|"
    r"if you believe that|if you previously attended|"
    r"(please )?(use|submit|keep|respond|complete|contact|see|visit|review) |"
    r"(please )?use (our|the) form|how you fill|fill out (this|the) form|"
    r"carefully consider|make sure|be sure to|note that|think of these|"
    r"if you have (any )?question)",
    re.I,
)

# Lines that match the shape and are never the question.
NOT_A_PROMPT = re.compile(
    r"\b(cookie|privacy|copyright|all rights reserved|sign in|log in|"
    r"financial aid|scholarship deadline|tuition|net price|"
    r"virtual tour|campus visit|request information|subscribe|newsletter|"
    r"we recommend that you|admitted students|class of 20\d\d|"
    r"application fee|fee waiver|test scores?|transcript|recommendation letter|"
    r"make or break|resume|activities list|self-report|"
    r"required to be considered|considered for admission|"
    r"depth, not breadth|there.s a limit of|core attributes are|"
    r"deadline is|deadlines are|apply by|notification date)\b",
    re.I,
)

# A real prompt, for somebody who is not our student. Admissions pages put the
# first-year and transfer questions on one page under separate headings, and a
# line-by-line reader has no headings: Northwestern's "Please share with us why
# you would like to transfer to Northwestern" was published as a first-year
# prompt, where a seventeen-year-old would have found it and tried to answer.
#
# Separate from NOT_A_PROMPT because these ARE prompts. The distinction is who
# is being asked, and it is worth keeping legible for when we carry transfer
# applicants too.
WRONG_APPLICANT = re.compile(
    r"\b(transfer|transferring)\b|"
    r"\byour (current|previous|former) (college|university|institution)\b|"
    r"\b(graduate|doctoral|master.s|MBA|PhD) (program|study|degree|school)\b|"
    r"\bas a (transfer|graduate|returning) (student|applicant)\b",
    re.I,
)

# A page's own advice about essay writing, which reads exactly like a prompt.
ADVICE = re.compile(
    r"\b(your essay should|we look for|admissions officers|tips?|"
    r"do not (worry|stress)|proofread|brainstorm|get started|"
    r"here are|the best essays|a good essay|avoid)\b",
    re.I,
)


def parse_limit(text: str) -> tuple[int | None, int | None]:
    """(words, characters) stated in this text, whichever it gives."""
    m = LIMIT.search(text)
    if not m:
        return None, None
    if m.group(1):
        n, unit = int(m.group(1)), m.group(2).lower()
    else:
        n, unit = int(m.group(4)), m.group(3).lower()
    # A four-figure word limit is somebody's phone number or a year.
    if unit == "word" and not (20 <= n <= 1500):
        return None, None
    if unit == "character" and not (50 <= n <= 5000):
        return None, None
    return (n, None) if unit == "word" else (None, n)


def looks_like_prompt(line: str) -> bool:
    line = line.strip()
    if len(line) < 45 or len(line) > 1200:
        return False
    if len(line.split()) < 8:
        return False
    # Dartmouth numbers its options "B.", "C.", and a line that opens with a
    # bare list marker has had its question left somewhere else.
    if re.match(r"^[A-Za-z0-9][.)]\s", line):
        return False
    # A question starts where the page started it. A line opening in lower case
    # was cut off at the front by the layout.
    if not line[0].isupper():
        return False
    # A form's list of options, not a question: "What is your religious
    # affiliation? * African Methodist Episcopal Apostolic ..."
    if line.count("*") >= 2 or line.count("|") >= 2:
        return False
    if WRONG_APPLICANT.search(line):
        return False
    if PROCESS.match(line) or NOT_A_PROMPT.search(line) or ADVICE.search(line):
        return False
    return bool(ASKS.match(line)) or line.rstrip().endswith("?")


def title_of(prompt: str) -> str:
    """A few words a student can scan, taken from the question itself.

    Not summarised: summarising is inventing, and the whole point of a machine
    row is that every word in it was on the page.

    The last interrogative sentence, not the first clause. A supplement usually
    opens with a paragraph about the college and ends with what it is actually
    asking, so the opening makes a title that repeats the first line of the
    body underneath it and says nothing. Northwestern's Rock prompt spends two
    sentences on the tradition and then asks "What would you paint on The Rock,
    and why?", which is the part worth putting in the list.
    """
    sentences = [s.strip() for s in re.split(r"(?<=[.?!])\s+", prompt.strip()) if s.strip()]
    questions = [s for s in sentences if s.endswith("?")]
    pick = questions[-1] if questions else (sentences[0] if sentences else prompt)

    pick = re.sub(r"^(please|briefly|and|so|then)\s+", "", pick, flags=re.I)
    words = pick.split()
    short = " ".join(words[:10]).rstrip(",;:?")
    if len(short) > 72:
        short = short[:69].rsplit(" ", 1)[0]
    return (short[0].upper() + short[1:]) if short else prompt[:60]


# "2026-2027", "2026-27" and "2026/27" all appear in real URLs and headings.
CYCLE_PAIR = re.compile(r"\b(20\d\d)\s*[-/_]\s*(20)?(\d\d)\b")


# A lone year, where no pair follows it. Georgia's discovered page was
# /blog/2015-essay-questions/, eleven cycles stale, and a pair test walks
# straight past it because there is no pair.
LONE_YEAR = re.compile(r"\b(19|20)\d\d\b")


def names_other_cycle(source: str, cycle: str) -> str | None:
    """The cycle a URL names, when it is not the one being built.

    URL only. Page bodies mention past years for honest reasons - a college
    linking its archive, a note about what changed - and rejecting on those
    would throw away good pages. A year in the address is the college filing
    the page under a cycle.
    """
    start = int(cycle.split("-")[0])
    ours = {start, start + 1}
    for m in CYCLE_PAIR.finditer(source):
        if int(m.group(1)) != start:
            return f"{m.group(1)}-{m.group(3)}"
    # Strip the host: a college with a year in its domain is not filing by
    # cycle, and no real one does, but the path is where dates live.
    path = re.sub(r"^https?://[^/]+", "", source)
    for m in LONE_YEAR.finditer(path):
        if int(m.group(0)) not in ours:
            return m.group(0)
    return None


def slugify(name: str, cycle: str, index: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:36]
    return f"{base}-{cycle}-m{index}"


def load_universal(path: str | None) -> list[str]:
    """The shared applications' prompts, normalised for comparison.

    Colleges reproduce the Common App's seven on their own pages, and without
    this Purdue arrives with eight "supplements" that are the personal
    statement prompts we already hold once, correctly, for everybody.
    """
    if not path or not os.path.exists(path):
        return []
    out = []
    for app in json.load(open(path)).get("apps", []):
        for p in app.get("prompts", []):
            out.append(re.sub(r"[^a-z0-9]", "", p["prompt"].lower())[:90])
    return out


def extract(path: str, universal: list[str] | None = None) -> tuple[str, list[dict]]:
    """(source url, prompts) from one fetched page."""
    lines = open(path, encoding="utf-8", errors="replace").read().split("\n\n")
    source = ""
    body: list[str] = []
    for chunk in lines:
        chunk = " ".join(chunk.split())
        if chunk.startswith("#"):
            # The header is two commented lines, the name and the url, and
            # collapsing whitespace joins them into one chunk.
            m = re.search(r"https?://\S+", chunk)
            if m:
                source = m.group(0)
            continue
        if chunk:
            body.append(chunk)

    # A limit stated once governs the run of questions under it, which is how
    # Harvard writes five 150 word answers and Yale three 400 word ones.
    found: list[dict] = []
    pending: tuple[int | None, int | None] = (None, None)
    # How much further down the page a stated limit still applies. Without a
    # bound, "40 to 50 words each" on MIT's short answers reached the paragraph
    # about their activities form, and Pomona's 150 landed on an FAQ about test
    # scores. A limit introduces the run immediately under it or nothing.
    reach = 0

    for line in body:
        words, chars = parse_limit(line)
        if not looks_like_prompt(line):
            # Not a question, but it may be the sentence that sets the limit
            # for the ones below it, unless the limit it states is the personal
            # statement's.
            if (words or chars) and not SOMEBODY_ELSES_LIMIT.search(line):
                pending, reach = (words, chars), 5
            else:
                reach -= 1
                if reach <= 0:
                    pending = (None, None)
            continue

        if not (words or chars):
            if reach <= 0:
                continue
            words, chars = pending
            reach -= 1

        if not (words or chars):
            continue

        # The limit is usually parenthesised at the end; the question is the
        # rest. Leaving it in makes the prompt read like a form field.
        text = re.sub(r"\s*\(?\b\d{2,4}\s*(?:-|–)?\s*(?:word|character)s?[^)]*\)?\s*$", "", line).strip()
        # Amherst labels its two routes "Prompt 1 Question:" and the label is
        # the page's scaffolding, not part of what the college is asking.
        text = re.sub(
            r"^(prompt\s*\d+\s*(question)?|option\s*[A-Z]|question\s*\d+)\s*[:.\-]?\s*",
            "", text, flags=re.I,
        ).strip()
        text = re.sub(r"\s*\(\s*\)\s*$", "", text).strip(" .;:")
        if len(text) < 40 or TRUNCATED.search(text):
            continue

        found.append({"prompt": text + ("?" if line.rstrip().endswith("?") and not text.endswith("?") else ""),
                      "word_limit": words, "char_limit": chars})

    # The same question twice is one question: pages repeat themselves between
    # a summary block and the detail below it.
    seen: set[str] = set()
    unique = []
    for f in found:
        key = re.sub(r"[^a-z0-9]", "", f["prompt"].lower())
        if key[:120] in seen:
            continue
        # A college quoting the Common App at us is not a supplement.
        if universal and any(u and u in key for u in universal):
            continue
        seen.add(key[:120])
        unique.append(f)

    # A page offering fifteen "prompts" has matched its own navigation.
    return source, unique[:12] if len(unique) <= 12 else []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", required=True)
    ap.add_argument("--sources", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cycle", default="2026-27")
    ap.add_argument("--manual", help="skip colleges already done by hand")
    ap.add_argument("--catalog", help="colleges.ndjson, for names the sources file lacks")
    ap.add_argument("--universal", help="universal-<cycle>.json, to drop colleges' copies of it")
    args = ap.parse_args()

    names = {}
    for row in csv.DictReader(open(args.sources)):
        names[row["unitid"]] = row["name"]

    # The sources file only lists Common App members. MIT runs its own
    # application and is not one, so the catalog is the fallback rather than
    # writing "Unitid 166683" into the product.
    if args.catalog and os.path.exists(args.catalog):
        for line in open(args.catalog):
            c = json.loads(line)
            names.setdefault(str(c["unitid"]), c["name"])

    universal = load_universal(args.universal)

    done: set[int] = set()
    if args.manual and os.path.exists(args.manual):
        for school in json.load(open(args.manual)).get("schools", []):
            done.add(school["unitid"])

    schools = []
    prompts_total = 0
    for filename in sorted(os.listdir(args.pages)):
        if not filename.endswith(".txt"):
            continue
        unitid = filename[:-4]
        if not unitid.isdigit() or int(unitid) in done:
            continue

        source, prompts = extract(os.path.join(args.pages, filename), universal)
        if not prompts or not source:
            continue

        # A page for a different cycle is worse than no page. Colleges leave
        # last year's up: UNC's discovered URL was
        # /application-prompts-for-2025-2026/, and nothing downstream would
        # have noticed, because the cycle is a label this script applies
        # rather than something it reads. A student would have written 650
        # careful words answering a question that is no longer asked.
        other = names_other_cycle(source, args.cycle)
        if other:
            print(f"  skip {unitid} {names.get(unitid, '')}: page is {other}, "
                  f"not {args.cycle}", file=sys.stderr)
            continue

        name = names.get(unitid, f"Unitid {unitid}")
        schools.append({
            "unitid": int(unitid),
            "name": name,
            "source_url": source,
            "extraction": "machine",
            "prompts": [
                {
                    "slug": slugify(name, args.cycle, i + 1),
                    "title": title_of(p["prompt"]),
                    "prompt": p["prompt"],
                    **({"word_limit": p["word_limit"]} if p["word_limit"] else {}),
                    **({"char_limit": p["char_limit"]} if p["char_limit"] else {}),
                    "requirement": "required",
                }
                for i, p in enumerate(prompts)
            ],
        })
        prompts_total += len(prompts)

    schools.sort(key=lambda s: s["name"])
    with open(args.out, "w") as fh:
        json.dump({
            "cycle": args.cycle,
            "note": (
                "Read off each college's own admissions page by "
                "build/extract_prompts.py on " + date.today().isoformat() +
                ". Every prompt is a quotation from a page that was fetched; "
                "nothing here is generated. Marked extraction=machine because "
                "no person has checked it, which the picker says on the row."
            ),
            "schools": schools,
        }, fh, indent=2)
        fh.write("\n")

    print(f"{len(schools)} colleges, {prompts_total} prompts -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
