# Stitch Prompts: Yakal Admissions Flow

Prompts for stitch.withgoogle.com to explore the admissions UI/UX before we build.
Design exploration only. Nothing here is a commitment to implement.

Companion doc: [admissions_flow_analysis.md](admissions_flow_analysis.md)

---

## 0. How to use this

1. Open Stitch in **Web** mode (not mobile). These are desktop-first data screens.
2. Start every new session by pasting **Section 1 (Design System)** as the first message.
   Stitch keeps theme context within a session but loses it between sessions.
3. Then paste one page prompt per generation. One screen per prompt gets better results
   than asking for a flow.
4. Use the higher-fidelity generation mode on the screens marked **[HIGH FIDELITY]**.
   Those are the ones worth spending the better generations on. The rest are fine on standard.
5. After a generation, use the **Refine** follow-ups listed under each prompt rather than
   regenerating from scratch. Regenerating loses the parts that worked.
6. Export to Figma once a screen is close, then iterate there.

**Suggested order:** 2 (Explore Universities) is the single most important screen to get right,
because it decides the whole prefill model. Do it first. Then 4, 5, 7, 8.

---

## 0.5 Brand tokens, read from the local codebase

These are the actual values in `src/styles/theme.css` and `src/styles/fonts.css` on `main`,
not from the deployed demo. The design system prompt in Section 1 uses them verbatim.

### Color, light mode

| Token | Hex | Role |
|---|---|---|
| `--primary` | `#1099a1` | Deep teal. Every action, link, active state, progress fill. |
| `--secondary` / `--warning` | `#CAA25F` | Muted gold. Warnings, highlights, tier markers. Currently the most-used brand hex in the codebase (62 occurrences vs 37 for teal). |
| `--accent-foreground` / `--sidebar-primary` | `#030213` | Near black with a blue cast. Primary text. |
| `--muted-foreground` | `#717182` | Secondary text, labels. |
| `--muted` | `#ececf0` | Muted fill. |
| `--accent` | `#e9ebef` | Accent fill. |
| `--input-background` | `#f3f3f5` | Input and recessed surface fill. Note `--input` itself is transparent. |
| `--switch-background` | `#cbced4` | Toggle track. |
| `--destructive` | `#d4183d` | Overdue, denied, errors. |
| `--border` | `rgba(0,0,0,0.1)` | Hairline. |
| `--background` / `--card` | `#ffffff` | Page and card surfaces are the same white. |

### Color, dark mode

Dark mode exists and is defined. Teal and gold hold constant across both modes; only
`--warning` softens to `#e0c48a`. Everything else switches to oklch greys. **Design light mode
only in Stitch.** Dark mode is a token swap, not a separate design problem, and generating it
doubles your generation spend for nothing.

### Typography

- **`Apfel Grotezk`** is the body font, applied globally in both `theme.css` and `global.css`
  with `!important`. It is a slightly quirky neo-grotesque with a warm, non-corporate feel.
  This is the single strongest anti-generic signal the brand has, and it is exactly why the
  prompts say "NOT Inter."
- **`DM Sans Variable`** is loaded via `@fontsource-variable/dm-sans` but is not currently
  bound to anything in the base layer. Treat it as the numeric and data face: use it for
  tables, stats, and tabular figures, and keep Apfel Grotezk for headings and prose. That
  split is a recommendation, not current behavior.
- Base size is 16px. Headings h1 to h4 are all weight 500 with `line-height: 1.5`, which is
  loose for dense data screens. The prompts tighten headings to 600 weight and 1.2 line
  height for tables and matrices.

### The radius problem, decide this before generating

`--radius` is `0.625rem` (10px), and the codebase currently contains **314 `rounded-full`**
and **164 `rounded-xl`** usages. Against `vibe.definition.md`, that is the pattern being
called out: large rounded corners everywhere, pill buttons, soft surfaces.

The Section 1 prompt asks Stitch for a **maximum 4px radius**, which deliberately contradicts
the shipped code. That is a real fork, so pick one before you spend generations:

- **Option A, recommended.** Keep pills for status chips and avatars only, drop every card,
  input, and button to 4px. Retokenize `--radius` to `0.25rem` and sweep `rounded-xl` and
  `rounded-2xl` to `rounded-sm`. Retains brand warmth through Apfel Grotezk and the gold,
  loses the template feel. This is what the prompts assume.
- **Option B.** Keep 10px everywhere and accept the current look. If you choose this, change
  "Maximum 4px" to "Maximum 10px, no pill buttons except status chips" in Section 1, and keep
  every other anti-pattern rule, since radius is only one of eight problems on that list.

Do not mix. Half-migrated radii look worse than either consistent choice.

### What the brand does not have yet

No logo or wordmark asset in `public/`. `public/images` holds only course and media
photographs. Chart colors are still the shadcn oklch defaults (`--chart-1` through `-5`) and
include a purple and an orange that are off-brand. The prompts specify teal, gold, and grey
for all data visualization instead. Worth locking a real chart ramp derived from `#1099a1`
before any of this ships.

---

## 1. Design System (paste first, every session)

```
You are designing an internal web application for Yakal, a college admissions
counseling and tutoring company. This is a professional working tool used daily by
counselors, high school students, and parents. It is not a marketing site.

DESIGN LANGUAGE

This is an existing brand. Use exactly these values, do not substitute or "improve"
them.

Colors:
- Primary, every action, link, active state and progress fill: #1099a1, deep teal
- Secondary, warnings, tier markers, highlights, used sparingly: #CAA25F, muted gold
- Text primary: #030213, near black with a blue cast
- Text secondary and all labels: #717182
- Page background and card background, both the same: #ffffff
- Recessed surface, input fill, context bars: #f3f3f5
- Muted fill: #ececf0
- Hairline border: #e3e3e8, the flat equivalent of the codebase token rgba(0,0,0,0.1)
- Danger, overdue, denied: #d4183d

Teal and gold are the only two chromatic colors on the entire screen. Everything else
is white, black, or grey. If a screen needs a third color to communicate, the
information design is wrong. In particular: no purple, no indigo, no orange, no
blue-to-purple anything. Charts use teal, gold, and greys only.

Typography, two faces only:
- Headings and prose: Apfel Grotezk. This is a warm, slightly quirky neo-grotesque,
  not a corporate sans. If it is unavailable, substitute a similar humanist grotesque
  with visible personality in the a, g and t. Do NOT substitute Inter, Poppins,
  Manrope, or Plus Jakarta Sans, those are exactly the wrong feel.
  Headings in sentence case, tight tracking, weight 600, line height 1.2.
- Data, tables, numbers, stats: DM Sans, 14px base, 20px line height.
- All numbers use tabular lining figures so columns align.
- Labels above form fields and section headers: 11px, uppercase, letterspaced 0.06em,
  color #717182.
- Base document size is 16px.

Layout:
- Dense and information-forward. Assume a 1440px viewport with real content in it.
- 8px spacing grid. Vertical rhythm is tight, not airy.
- Content is left aligned. Do not center card content.
- Persistent left sidebar navigation, 240px, plain text labels with a 1px left rule
  marking the active item. No icon-only rail.

STRICT ANTI-PATTERNS, these will make the design unusable for us:
- NO large border radii. Maximum 4px on cards, inputs, and buttons. Pill shapes are
  allowed ONLY on small status chips and nowhere else.
- NO gradients anywhere. No glassmorphism, no frosted glass, no backdrop blur.
- NO drop shadows. Separate surfaces with 1px solid hairlines only.
- NO icons inside circles or rounded squares. NO semi-transparent icon backgrounds
  like a tinted 10% circle behind a glyph.
- NO one-big-centered-icon-per-card feature grids.
- NO oversized padding. NO generic hero sections in the app screens.
- NO Lucide or Heroicons default icon set look. Use icons sparingly, small (16px),
  monochrome, inline with text, only where a word will not do.
- NO purple, NO indigo, NO blue-to-purple anything.
- Do not decorate empty space. Fill it with real data or leave it empty.

The reference feel is a well made professional tool: Linear's density, Stripe
Dashboard's data clarity, the Financial Times' typographic discipline. Serious,
quiet, and fast to read.

Use realistic content throughout. Real US university names, real dollar amounts, real
dates in 2026 and 2027, real student names. Never use lorem ipsum and never write
"Feature title" or "Card description" as placeholder text.

Acknowledge and wait for the first screen.
```

---

## 2. Explore Universities (the catalog) [HIGH FIDELITY]

**Why this screen matters:** it replaces the current free-text "type in the school name and
14 facts yourself" form. This is the screen that answers the gallery question.

```
Screen: "Explore universities". A searchable catalog of roughly 6,000 US colleges that
a high school student browses to build their college list.

Layout, three regions across 1440px:

LEFT, 260px filter rail, no card wrapper, just grouped controls separated by hairlines:
- Search field at the top, placeholder "Search 6,000+ universities"
- "Fit for you" toggle, on. Helper text under it: "Ranked against your 3.82 GPA and
  1480 SAT"
- Location: multi-select state list, showing Maryland, Virginia, Pennsylvania checked
- Type: Public, Private nonprofit, Private for-profit
- Size: Under 5,000 / 5,000 to 15,000 / Over 15,000
- Net price after aid: a two-handle numeric range slider, currently $0 to $35,000
- Admit rate: range slider, 0% to 100%
- Test policy: Required, Optional, Blind
- Majors: searchable token input with "Biomedical Engineering" already added as a token

CENTER, the results area:
- Header row: "412 universities" on the left, a segmented control on the right with
  three options, Grid / Table / Map, with Grid selected
- Below it a horizontal row of active filter chips with x buttons
- A responsive grid of university cards, 3 across, showing 9 cards

Each university card, 4px radius, 1px #e3e3e8 border, no shadow:
- Top: a 16:9 photograph of the actual campus, edge to edge, no rounded corners on
  the image except the top two
- A small square institutional wordmark or seal, 28px, overlapping the bottom left
  of the photo by half its height, on a white square
- University name, 16px, weight 600, one line, truncated with ellipsis
- Location and type on one line, 13px, #717182: "Baltimore, MD - Private nonprofit"
- A single-line fit bar: a 4px tall horizontal track where the school's middle 50%
  SAT range is shaded #e3e3e8 and the student's own 1480 is a 2px vertical teal tick.
  To the right of it, a compact label: "Reach", "Target", or "Safety" as a 2px radius
  chip. Reach uses #CAA25F on a pale gold fill, Target uses teal, Safety uses grey.
- A 2x2 micro data grid, labels 11px uppercase #717182 above values 14px tabular:
  ADMIT RATE 11%  |  NET PRICE $24,800
  SAT MID 50 1520-1570  |  DEADLINE ED Nov 1
- Bottom bar separated by a hairline: a ghost "Compare" checkbox on the left and a
  solid teal "Add to list" button on the right, 4px radius, 32px tall

Use these nine real universities in order: Johns Hopkins University, University of
Maryland College Park, University of Michigan, Towson University, Carnegie Mellon
University, University of Pittsburgh, Virginia Tech, Drexel University, University of
Delaware. Give each accurate-looking admit rates, SAT ranges, and net prices.

BOTTOM, a persistent compare tray docked to the viewport bottom, 56px tall, white with
a top hairline, showing 2 selected school thumbnails as small chips with x buttons and
a teal "Compare 2 schools" button on the right.

Generate real campus photographs for every card. Architectural exteriors and campus
quads in flat overcast daylight, no students posing, no lens flare, no heavy color
grading. They should read as documentary photography, not stock marketing imagery.
```

**Refine follow-ups:**
- "Show the Table view of the same screen: a dense sortable data table, 40px rows, columns for School, Location, Admit rate, SAT mid 50, Net price, Deadline, Fit, and a row-end Add button. Zebra striping off, hairline row separators only."
- "Add an empty state variant for when filters return zero results."
- "Tighten the card vertical padding by 25 percent and reduce the gap between cards to 16px."

---

## 3. University detail page [HIGH FIDELITY]

**Why:** this is where prefilled catalog data is shown as verified, and where the student adds
the only two things that are genuinely theirs.

```
Screen: university detail page for Johns Hopkins University, opened from the catalog.

TOP: a 320px tall campus photograph spanning the full content width, with the
university name overlaid in the bottom left in white, 32px, on a subtle dark scrim
that only covers the lower third. No gradient overlay across the whole image, a hard
edged scrim only. Institutional seal, 44px, sitting on the white content area just
below and overlapping the photo edge.

Under the photo, a sticky sub-navigation bar of plain text tabs with a 2px teal
underline on the active one: Overview | Admissions | Cost and aid | Academics |
Deadlines | Your notes. Overview is active. To the far right of this bar, a solid
teal "Add to my list" button and a ghost "Compare" button.

MAIN CONTENT, two columns, 2:1 ratio.

Left column:
1. A "Verified data" band: a single line of 12px #717182 text reading
   "Source: IPEDS and College Scorecard, updated Jan 2027" with a small 14px check
   glyph inline, no badge, no pill, no colored background.
2. "At a glance": a 4-column stat strip separated by vertical hairlines, no cards.
   Each cell is an 11px uppercase label over a 24px tabular number.
   ADMIT RATE 11%  |  UNDERGRADS 5,318  |  STUDENT-FACULTY 6:1  |  MEDIAN SAT 1545
3. "Where you stand": a horizontal chart, 3 stacked rows for SAT, GPA, and ACT. Each
   row is a 12px tall grey track showing the admitted middle 50% range as a darker
   band, with the student's own value as a 2px teal vertical marker and a small
   callout. Under it one sentence: "Your 1480 sits below the middle 50 percent. This
   is a reach." Set that sentence in 15px, not in a colored alert box.
4. "Cost": a small table. Sticker price $65,410, average net price after aid $24,800,
   percent receiving need aid 51%, average need grant $52,100, merit aid available No.
   Right-align the numbers.
5. "What this school needs from you": a checklist of 8 requirements as a plain list
   with hairline separators, each row showing the requirement name, a status word in
   #717182, and a due date. Application, 1 supplemental essay, 2 teacher recs,
   counselor rec, transcript, test scores optional, FAFSA, CSS Profile.
6. "Supplemental essay prompt": the actual prompt text in a recessed #f3f3f5 block
   with a 3px left rule in teal, no border radius, italic, 15px, plus a word limit
   line "300 words" and a ghost "Start this essay" button.

Right column, sticky:
- A "Deadlines" panel: Early Decision Nov 1 2026, Early Decision II Jan 2 2027,
  Regular Decision Jan 2 2027, each as a row with the date right aligned in tabular
  figures, and days remaining under it in #717182.
- A "Your notes" panel with two fields the student fills in themselves, clearly
  visually distinct from all the verified data above by sitting on #f3f3f5:
  "Program you would apply to" as a text input prefilled with "Biomedical Engineering,
  BS" and "Why this school" as a 4-row textarea with real written content in it.
- A small "Added by" line: "Added by Hana Girma, your counselor, on Mar 4 2027".

Generate a real photograph of the Johns Hopkins Homewood campus, red brick
neoclassical buildings, overcast daylight, documentary style.
```

**Refine follow-ups:**
- "Show the Cost and aid tab, with a net price by family income bracket bar chart, six brackets, teal bars on a white ground, no gridlines except a hairline baseline."
- "Make the difference between verified catalog data and student-entered fields more obvious without adding color or badges."

---

## 4. Student college list [HIGH FIDELITY]

**Why:** replaces today's flat three-bucket card wall. Adds balance feedback and the
counselor approval state.

```
Screen: "My college list" for a grade 12 student named Amen Worku.

TOP BAR inside the content area, not a hero:
- Left: "My college list", 24px. Under it in 13px #717182: "9 schools - 3 approved by
  your counselor - 2 awaiting review"
- Right: ghost "Export CSV", ghost "Compare", solid teal "Add a school".

BALANCE STRIP, full width, 88px tall, 1px border, no shadow:
A horizontal stacked bar divided into three proportional segments labeled Reach 4,
Target 3, Safety 2, in gold, teal, and grey. To the right of the bar, a single line
of plain text advice, 14px, no alert box, no icon in a circle:
"Your list is reach heavy. Both safeties are actually targets given your 1480. Consider
adding one true safety." Followed by a small ghost button "See suggestions".

MAIN, a dense table, not a card grid. 52px rows, hairline separators, no zebra.
Columns:
1. A 32px square campus thumbnail
2. School, name in 15px weight 600 with location in 12px #717182 underneath
3. Category, an editable 2px radius chip reading Reach / Target / Safety
4. Status, plain text: Proposed, In review, Approved, Applied, Accepted, Denied
5. Deadline, tabular date with days remaining underneath in #717182, turning #d4183d
   when under 14 days
6. Essays, a fraction like 1/1 or 0/3
7. Net price, right aligned tabular
8. Fit, the same 4px tall SAT range track with the student marker, compact
9. A row-end overflow menu, three dots, 16px

Group the rows under three plain uppercase 11px section headers, REACH, TARGET,
SAFETY, with counts. Do not put the groups in separate cards.

Two rows must show the counselor review state clearly: one row with status "In review"
and a 12px #717182 line under the school name reading "Sent to Hana Girma for review,
2 days ago". One row with status "Approved" and a line reading
"Approved by Hana Girma - moved from Target to Reach".

BELOW the table, a "Core essays" section as a simple 3-row list, not cards: Common
App personal statement (round 2 of 6, last feedback Mar 12), Activities descriptions
(approved), Additional information (not started). Each row has a status word and a
ghost "Open draft" link.

Empty rail on the right: none. Use the full width.
```

**Refine follow-ups:**
- "Show the Compare view: the same schools as columns and the attributes as rows, first column frozen, 11 attribute rows, cells that differ from the row median subtly emphasized."
- "Add a mobile 390px variant of the list, collapsing each school to a two-line row."

---

## 5. Counselor home, the at-risk queue [HIGH FIDELITY]

**Why:** today the counselor home is four vanity stat tiles. It should be a work queue.

```
Screen: counselor dashboard for Hana Girma, who advises 18 students. This is a triage
work queue, not an analytics dashboard. Do not put big number stat cards at the top.

HEADER: "18 students - 4 need you today", 24px. Under it a row of four plain text
filter tabs with counts: Needs you 4 | At risk 6 | On track 11 | All 18.

PRIMARY REGION, "Needs you today", a list of 4 action rows. Each row is 96px, full
width, 1px bottom hairline, no card, no radius:
- Left: a 36px square student avatar photograph, 2px radius, not a circle
- Student name 15px weight 600, and grade plus tier on the next line in 12px #717182:
  "Grade 12 - Premier"
- Center, the action itself in 15px near-black plain text, this is the most important
  text on the screen:
  Row 1: "Amen Worku submitted his Common App personal statement, round 2 of 6"
  Row 2: "Liya Mekonnen proposed 3 new schools for your review"
  Row 3: "Dawit Bekele has not started the Michigan supplement, due in 9 days"
  Row 4: "Sara Haile's FAFSA is unsubmitted and the priority deadline is in 4 days"
- A relative timestamp right aligned in 12px #717182
- Right: one solid teal primary button whose label matches the action, "Review draft",
  "Review 3 schools", "Nudge student", "Message parent". 32px tall, 4px radius.

SECOND REGION, "Caseload", a dense table, 44px rows:
Columns: Student, Grade, Tier, Schools, Apps submitted, Essays approved, Next deadline,
Progress, Last contact.
The Progress column is a 6px tall horizontal bar, teal fill on #f3f3f5 track, with a
percent in tabular figures to its right. The Next deadline column turns #d4183d under
14 days. Last contact turns #CAA25F over 21 days.
Show 8 real rows with varied realistic values.

RIGHT RAIL, 300px, two panels separated by hairlines, no cards:
- "This week", a list of 3 scheduled advising sessions with student name, day and
  time, duration, and tier, each with a ghost "Open agenda" link
- "Entitlements running low", 2 rows: "Amen Worku, 5 of 6 essay rounds used" and
  "Liya Mekonnen, 2 of 2 sessions used this month", each with a ghost "Upgrade tier"
  link

Use real photographic student portraits for the avatars, natural indoor light, plain
backgrounds, high school aged, diverse. No illustrations, no cartoon avatars, no
initial-letter circles.
```

**Refine follow-ups:**
- "Remove any remaining rounded corners over 4px and any shadow. Replace with hairlines."
- "Show the At risk tab, same layout, ordered by days-to-deadline against percent complete."

---

## 6. Counselor list review, the approval screen

**Why:** this is the single screen that makes the counselor role distinct from the student's.

```
Screen: "Review proposed schools". Counselor Hana Girma is reviewing 3 schools that
her student Liya Mekonnen proposed. This is a decision screen, one school at a time.

TOP: a breadcrumb "Students / Liya Mekonnen / List review", then "3 schools to review"
with a step indicator reading "1 of 3" in tabular figures on the right.

STUDENT CONTEXT BAR, 64px, #f3f3f5 fill, no radius, full width:
Six inline stats separated by vertical hairlines: GPA 3.64 UW, SAT 1350, ACT not taken,
Grade 11, Intended major Nursing, Budget under $30k per year.

MAIN, two columns, 60/40.

Left, the school being reviewed:
- University of Michigan, 22px, with a 120x80 campus photo to its left
- The same verified data strip as the catalog: admit rate, SAT mid 50, net price,
  deadline
- "Where Liya stands": the SAT range track with her 1350 marker sitting well below
  Michigan's 1360-1530 band
- "Why Liya wants it", her own words in a recessed #f3f3f5 block with a teal left rule:
  "My cousin goes here and the nursing program is supposed to be really good. It feels
  like a target for me."

Right, the counselor decision panel, sticky:
- Section label "YOUR CALL"
- "Category" as three large selectable segmented options, Reach / Target / Safety.
  Safety is unselected, Target is shown as "Student said" in small grey text above it,
  Reach is selected with a teal 2px border. This contrast between what the student said
  and what the counselor chose is the point of the screen, make it legible.
- "Rationale, visible to Liya and her parent", a 5-row textarea with real written
  content: "Michigan is a reach for out of state nursing at your current test score.
  Keep it, but let's aim your true target list at Pitt and Delaware, and retake in
  October."
- Two buttons filling the width: solid teal "Approve as Reach" and ghost "Decline with
  a note"
- Under them, a small link "Suggest a school instead"

BOTTOM: a horizontal strip of the remaining 2 schools to review as small thumbnail
cards with names, so the counselor sees the queue.
```

---

## 7. Application tracker [HIGH FIDELITY]

**Why:** today it is 40 manual checkboxes. This version derives most of them.

```
Screen: "Application tracker" for Amen Worku, grade 12, viewed by his counselor.

TOP: student switcher as a plain dropdown showing "Amen Worku", not a card. To the
right, three inline stats separated by hairlines: 9 SCHOOLS, 3 SUBMITTED, 1 ACCEPTED.

ACADEMICS BAR, full width, 72px, #f3f3f5, no radius, one row of labeled values with
a small ghost "Edit" at the far right:
GPA UW 3.82 | GPA W 4.31 | RANK Top 8% | SAT 1480 (740 EBRW / 740 M) | ACT - |
AP AP Calc BC 5, AP Bio 4 | TRANSCRIPT linked | DRIVE FOLDER linked

MAIN, a requirements matrix. This is the centerpiece. Schools are rows, the 8
requirements are columns.

Column headers, 11px uppercase, rotated 0 degrees, wrapped to two lines if needed:
APPLICATION | ESSAYS | RECS REQUESTED | RECS RECEIVED | TRANSCRIPT | TEST SCORES |
FAFSA | CSS PROFILE

Each row: a 28px campus thumbnail, school name, deadline with days remaining, then 8
status cells, then a decision cell at the row end.

Status cells are NOT checkboxes. Each is a 24px square with 2px radius:
- Complete: solid teal square with a white 12px check
- Auto-derived complete: solid teal square with a white check AND a 1px dotted teal
  outline extending 2px beyond it, to signal the system filled it in
- In progress: a teal outlined square with a partial fill from the bottom showing
  proportion, for example essays at 1 of 3 shows one third filled
- Not started: an empty square with a #e3e3e8 border
- Not required: a single 8px grey dash, no square
Cells with a fraction show it as 9px tabular text under the square, like 1/3.

Include a legend under the matrix as a single line of small inline swatches with
labels, including the line "Dotted outline means Yakal filled this in from your
profile. Click to override."

Rows, 9 schools, with genuinely varied completion so the matrix looks alive.

Decision cell at the row end: for submitted schools, a 4-option inline radio set
rendered as small text buttons, Accepted / Waitlisted / Denied / Enrolled, with
Accepted selected and shown in teal for one school.

BELOW the matrix, three columns of equal width separated by vertical hairlines, no
cards:
- "Essays, 4 of 9 approved": a list of essay rows with school, prompt excerpt, round
  count like "Round 2 of 6", and status
- "Recommenders": 3 rows with name, role, status, due date, and a Drive link glyph
- "To do, 3 open": 3 task rows with a due date each, and a 12px #717182 source line
  reading "From your senior year roadmap"
```

**Refine follow-ups:**
- "Add a hover state on a status cell showing a small tooltip explaining why it was auto-derived, for example 'Ticked because your SAT is on file'."
- "Add a horizontally scrollable variant for a 1280px viewport with the school column frozen."

---

## 8. Essay review workspace

**Why:** the tiers sell essay rounds. Nothing counts them today.

```
Screen: essay review workspace. Counselor Hana Girma is giving round 3 feedback on
Amen Worku's Common App personal statement.

TOP BAR, 56px, hairline bottom:
Left: "Common App personal statement" 16px, and under it 12px #717182
"Amen Worku - Prompt 5 - 612 of 650 words".
Center: a round counter rendered as 6 small squares in a row, 3 filled teal, 3 empty
with hairline borders, with the label "Round 3 of 6" beside it in 12px. Under it in
11px #CAA25F: "Premier tier - 3 rounds remaining".
Right: ghost "Open in Google Docs", solid teal "Send feedback".

MAIN, two columns, 65/35, full viewport height, each scrolling independently.

Left, the draft:
The essay text itself, set at 17px with a 30px line height in a 680px measure, near
black on white, generous left margin. This is a reading surface, treat the typography
seriously. Write 5 real paragraphs of a plausible personal statement by an Ethiopian
American senior about working in his family's restaurant. Two passages are highlighted
with a flat #CAA25F at 20 percent opacity, no rounded corners on the highlight, and
each highlight has a small teal number marker in the left margin, 1 and 2.

Right, the feedback rail:
- Section label "FEEDBACK, ROUND 3"
- Two comment threads, each anchored to its numbered highlight. Each shows the quoted
  fragment in 12px italic #717182, then the counselor comment in 14px, then a small
  "Reply" link. One thread has a student reply already in it, indented with a 2px left
  rule.
- A "Overall note" textarea at the bottom of the rail with real written content.
- Below it, a "Previous rounds" collapsed list: "Round 2, Mar 4, 6 comments" and
  "Round 1, Feb 18, 11 comments", each expandable.

Do not use chat bubbles. Do not use avatars in circles. Comment threads are plain
blocks separated by hairlines with a 20px square avatar photograph at 2px radius.
```

---

## 9. Student home

```
Screen: student home for Amen Worku, grade 12, logged in on Sep 14 2026.

Do not build a generic dashboard of equal stat cards. Build a "what do I do today"
screen with a clear visual hierarchy of one, then three, then everything else.

REGION 1, the single most urgent thing, full width, 140px, #f3f3f5 fill, no radius,
with a 4px left rule in #d4183d:
"Johns Hopkins Early Decision closes in 12 days" at 22px. Under it, a horizontal
progress readout: "6 of 8 requirements complete", then the two remaining ones named as
plain text with small ghost action buttons, "Supplemental essay, round 2 of 6" and
"Counselor recommendation, requested Mar 2, not received". A solid teal
"Open Hopkins checklist" button on the right.

REGION 2, three columns separated by vertical hairlines, no cards:
- "Next up", 4 dated tasks with checkboxes, each with an 11px #717182 source line
  reading either "From your senior year roadmap" or "From Hana, your counselor"
- "Your deadlines", a compact vertical timeline: 6 dated rows on a 1px vertical rule,
  each with a 6px teal dot, the school name, the round type, and days remaining in
  tabular figures
- "From Hana", the two most recent counselor messages as plain quoted text with a
  timestamp, and a ghost "Open messages" link

REGION 3, "Your list at a glance", a horizontal scrolling row of 9 small school tiles,
120px wide each: campus thumbnail, name truncated, a category chip, and a 4px progress
bar. Plus a ghost tile at the end reading "Add a school".

REGION 4, "Sessions", two rows: next tutoring session with Bethlehem Alemu on SAT prep,
Thursday 4pm, with a teal "Join" button, and next advising session with Hana Girma,
Monday 5pm, with a ghost "See agenda" link.

No welcome banner. No illustration. No motivational quote. The student's name appears
once, small, in the top corner.
```

---

## 10. Parent overview

```
Screen: parent home for Tigist Worku, who has two children, Amen in grade 12 and Saron
in grade 9. Parents want reassurance and cost clarity, not controls.

TOP: two child selector tabs as plain text with a 2px teal underline on the active one,
"Amen, Grade 12" and "Saron, Grade 9". Amen active.

REGION 1, a single plain sentence at 20px, no card, no icon:
"Amen is on track. 3 of 9 applications submitted, next deadline in 12 days."
Under it in 13px #717182: "Last updated by Hana Girma, 2 days ago."

REGION 2, "What happened recently", a reverse chronological activity feed, 8 entries,
each a single 44px row with a date on the left in tabular figures, then plain text:
"Hana approved the Hopkins supplement, round 2"
"Amen submitted the University of Maryland application"
"Hana added Pitt to the list as a target"
"Michigan moved from Target to Reach after list review"
No icons on these rows. Dates and text only, separated by hairlines.

REGION 3, two columns:
Left, "Cost picture", a horizontal bar chart comparing estimated net price per year
across all 9 schools, teal bars, school names as left axis labels, dollar values as
right-aligned tabular labels at the bar ends, a dotted vertical line at $30,000 marked
"Your budget". No gridlines.
Right, "Your plan": tier "Premier", $X per month, next invoice date, and a usage
readout, "Advising sessions 1 of 2 used this month" and "Essay rounds 3 of 6 used",
each as a thin bar. Below, ghost "View invoices" and ghost "Change plan".

REGION 4, "Your team", two rows with 36px square photographic portraits: Hana Girma,
admissions counselor, with her next session time; Bethlehem Alemu, SAT tutor, with
hours this month. Each row has a ghost "Message" button.
```

---

## 11. Roadmap as dated tasks

**Why:** the current roadmap is a static brochure. Make it a plan.

```
Screen: "Your roadmap", for a grade 11 student in the spring term.

Replace the idea of a static grade-by-grade article with a live plan.

TOP: a horizontal term timeline spanning the full width, from Fall 10 to Spring 12,
as a single 2px horizontal rule with 8 term tick marks below it. Past terms are grey,
the current term "Spring, Grade 11" is marked with a filled teal segment and a "You
are here" label. Milestone flags sit above the line at their dates: PSAT, First SAT,
AP exams, Common App opens, ED deadline, FAFSA opens, Decision Day. Small text labels,
rotated 0 degrees, no icons.

MAIN, the current term expanded, a task list grouped by month:
MARCH, APRIL, MAY, JUNE as 11px uppercase section headers.
Each task is a 56px row: a square checkbox, the task name at 15px, a one-line
description at 13px #717182, an owner chip on the right reading "You", "Hana", or
"Yakal does this", and a due date in tabular figures.
Include real tasks: "Register for the May SAT" due Apr 4, "Ask two teachers for
recommendations" due May 15, "Draft your Common App essay" due Jun 30, "Build a
balanced first list of 12 schools" due Apr 30 owned by Hana.
Two tasks are checked and struck through in #717182.

The "Yakal does this" owner chip matters: it marks the tasks the system completes
automatically, like "Your list balance is checked weekly". Style it in grey, not teal.

RIGHT RAIL, 280px: "Later terms", a collapsed accordion of the remaining 3 terms, each
showing a term name and a task count. Below it "Resources for this term", 5 plain text
external links with a small 12px outbound arrow, no cards, no icons in boxes.
```

---

## 12. Add a school, manual fallback

**Why:** shows how little a student should ever have to type.

```
Screen: a modal side panel, 480px wide, docked right, for adding a school manually
when it is not in the catalog. Full height, 1px left border, no radius, no shadow,
no backdrop blur, the page behind it dimmed with a flat 40 percent black.

Header: "Add a school manually" with a small x. Under it a 13px #717182 line:
"Most schools are already in our catalog with deadlines and costs filled in.
Search first." followed by a ghost "Search the catalog instead" button.

Then a hairline, then a short form of only 5 fields, in this exact order:
1. School name, text input
2. Category, segmented control, Reach / Target / Safety
3. Application deadline, a type dropdown (ED, ED II, EA, REA, RD, Rolling) and a date
   input side by side
4. Program you would apply to, text input
5. Why this school, textarea, 4 rows

Below the form, a section separated by a hairline, header "We will fill in the rest",
followed by a plain list of 9 items in 13px #717182 with a small 12px check before
each, no boxes, no circles: sticker price, net price, admitted SAT and GPA range,
admit rate, student-faculty ratio, aid percentages, admissions contact, supplemental
essay count and prompts, campus photo.
Under that list: "If we cannot find them, these stay blank and your counselor will
add them."

Footer, sticky, hairline top: ghost "Cancel" and solid teal "Add school".

The whole point of this screen is that it looks almost empty. Do not add fields to
fill the space.
```

---

## 13. Imagery direction (read before generating)

Where to ask Stitch for real generated images, and where not to. Getting this wrong is
what makes a design look vibe coded.

**Use real photography:**
- Campus exteriors on university cards and detail pages. Ask for flat overcast
  daylight, documentary framing, architecture not people. Avoid golden hour, avoid
  students laughing on a lawn, avoid heavy color grading.
- Student and counselor avatars. Square, 2px radius, natural indoor light, plain
  backgrounds, high school aged, diverse. Never circles, never illustration, never
  initial-letter monograms.
- Institutional seals and wordmarks as small monochrome marks.

**Never use imagery:**
- Empty states. Use one sentence of plain text instead of a spot illustration.
- Feature explanation blocks. No icon plus heading plus paragraph triads.
- Section headers. No decorative dividers or background patterns.
- Anywhere an icon would sit inside a circle or a tinted rounded square.

**Data visualization instead of decoration.** The SAT range track, the balance bar, the
requirements matrix, and the net price chart carry the visual interest on these screens.
That is deliberate. If a screen feels visually empty, the fix is more real data, not
more graphics.

**One line to append to any prompt that drifts:**

```
Regenerate with these corrections: remove all border radii above 4px except small
status chips, remove all shadows and gradients, remove any icon that sits inside a
circle or tinted square, remove all centered card content and left align it, and
increase content density by about 30 percent. Replace decorative elements with real
data. Restrict every color on the screen to #1099a1 teal, #CAA25F gold, #030213,
#717182, #f3f3f5, #e3e3e8, #d4183d and white. Keep headings in Apfel Grotezk or a
similar humanist grotesque, never Inter.
```

---

## 14. Your two questions

### Should we have a gallery of universities?

Yes, and it is the highest leverage thing on the list. But call it a catalog, not a gallery,
because the framing changes the design. A gallery is something you look at. A catalog is
something you search, filter, and pull from.

Three reasons it is worth building:

1. **It is the only way prefill works.** Ten of the fourteen fields on today's Add-a-school
   form are public facts. They can only be prefilled if there is a canonical row to prefill
   from. No catalog means no prefill, means permanent manual entry.
2. **It fixes the data integrity problem.** Your demo data has Towson twice with different
   deadlines and a 2x difference in sticker price. Once a school is a reference to a catalog
   row instead of free text, that class of bug disappears.
3. **It is the free tier.** A student can search 6,000 schools, filter by net price and fit,
   and build a list without paying anything. That is a genuinely useful free product and it
   feeds the funnel your admin console is already measuring. The counselor is what they pay
   for afterwards.

Design it as a **filtered catalog with a fit lens**, not a browsing wall. The differentiator
versus Niche or BigFuture is not the data, which everyone has. It is that every number is
rendered against **this student's** GPA and test scores, and that the counselor's judgment is
visible on the same row. That is prompt 2.

Scope it honestly: College Scorecard covers about 6,000 institutions for free, but deadlines
and supplemental essay prompts are not in any clean free API. Curate the top 300 schools by
application volume by hand once a year, and let everything outside that fall back to manual
with an unverified marker. That covers nearly everything your families will actually apply to.

### Do you prefill manually?

Partly, and the split matters.

**Automated, from APIs, refreshed on a schedule:** cost of attendance, net price, SAT and ACT
percentiles, admit rate, enrollment, student-faculty ratio, aid percentages, admissions
contact. College Scorecard and IPEDS give you all of this for free across roughly 6,000
schools. Zero manual work after the initial integration.

**Manual, once a year, top 300 schools only:** application deadlines by round, supplemental
essay counts and prompt text, test policy, and admitted GPA from Common Data Set filings.
This is roughly one focused week of work per cycle, and it can be an intern or a contractor
against a spreadsheet template. It is the moat, because nobody else bothers.

**Never prefilled, always the student:** the program they would apply to, why they want it,
visit impressions, and their essays.

**Never prefilled, always the counselor:** the Reach/Target/Safety call and the rationale.

So the answer is: automate the bulk, hand-curate the narrow slice that changes annually and
that no API sells, and refuse to prefill anything that is a judgment or a feeling. If you
prefill a student's reason for wanting a school, you have built a worse product, not a
faster one.
