/**
 * The same job as discover_pages.py, in a browser that runs JavaScript.
 *
 * The Python crawler reads what the server sends. That is the whole page for
 * Yale, Harvard, MIT, Rice and most small colleges, and it is an empty shell
 * for Princeton, Brown, Dartmouth, Duke and Columbia, whose admissions sites
 * render their prompts client side. Those are precisely the schools whose
 * supplements a student most needs, so a crawler that cannot see them is
 * missing the top of the list.
 *
 * So this runs second, over whatever the static pass could not find, and pays
 * a few seconds a page for a rendered DOM. Everything else is the same: start
 * at the admissions site we already resolved, follow the links that talk about
 * essays, keep the page that carries word limits next to questions, and write
 * the text out for extract_prompts.py to quote from.
 *
 *   node data/essay-prompts/build/render_pages.mjs \
 *     --sources data/essay-prompts/curated/sources-2026-27.csv \
 *     --out data/essay-prompts/out/pages --workers 6 --limit 200
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1]]);
    return acc;
  }, [])
);

const SOURCES = args.sources ?? "data/essay-prompts/curated/sources-2026-27.csv";
const OUT = args.out ?? "data/essay-prompts/out/pages";
const WORKERS = Number(args.workers ?? 6);
const LIMIT = Number(args.limit ?? 1e9);

/** A word or character limit, which is the one thing every prompt page has. */
const LIMIT_RE = /\b\d{2,4}\s*(?:-|–)?\s*(?:word|character)s?\b|\bword\s*(?:count|limit|maximum)\b/i;
const ASKS_RE = /\b(describe|tell us|why|what|how|reflect|share|discuss|explain|elaborate|imagine|choose|respond)\b/i;

/** Links worth a page load, and the ones that only look like it. */
const WANT = /essay|supplement|writing|prompt|short[-_ ]?answer|first[-_ ]?year|freshman|apply|application|requirement/i;
const AVOID = /\.(pdf|jpg|png|zip|docx?)$|\/news|\/blog|\/stories|\/events|\/give|\/alumni|\/athletics|transfer|graduate|financial[-_ ]?aid|scholarship|visit|tour|login|portal|search|privacy/i;

function readCsv(path) {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const cols = header.split(",");
  return lines.map((line) => {
    // Our own files: no quoted commas.
    const cells = line.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, (cells[i] ?? "").trim()]));
  });
}

/** How much this page looks like the college's essay questions. */
function scorePage(url, text) {
  if (!LIMIT_RE.test(text)) return 0;
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length >= 45);
  const asks = lines.filter((l) => ASKS_RE.test(l) && (l.endsWith("?") || LIMIT_RE.test(l)));
  if (asks.length < 2) return 0;
  let n = Math.min(asks.length, 12);
  if (/essay|prompt|supplement|short[-_]?answer/i.test(url)) n += 6;
  return n;
}

async function textOf(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll("script,style,nav,footer,header,noscript,svg")) el.remove();
    return document.body?.innerText ?? "";
  });
}

async function linksOf(page, host) {
  return page.evaluate(
    ([host]) =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => ({ href: a.href, label: (a.textContent ?? "").trim().slice(0, 120) }))
        .filter((l) => {
          try {
            const u = new URL(l.href);
            return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.endsWith(host);
          } catch {
            return false;
          }
        }),
    [host]
  );
}

function rank(href, label) {
  const s = `${href} ${label}`;
  if (/essay|prompt|short[-_ ]?answer|writing[-_ ]?supplement/i.test(s)) return 3;
  if (/supplement/i.test(s)) return 2;
  if (/first[-_ ]?year|freshman/i.test(s)) return 1;
  return 0;
}

async function findFor(ctx, row) {
  const start = row.admissions_url || null;
  if (!start) return null;

  const page = await ctx.newPage();
  await page.route("**/*", (route) => {
    // Images, fonts and media are most of the bytes and none of the text.
    const t = route.request().resourceType();
    return ["image", "media", "font"].includes(t) ? route.abort() : route.continue();
  });

  let best = null;
  const seen = new Set();
  let host;
  try {
    host = new URL(start).hostname.replace(/^www\./, "");
  } catch {
    await page.close();
    return null;
  }

  const visit = async (url, depth) => {
    if (seen.has(url) || seen.size > 9 || (best && best.score >= 12)) return [];
    seen.add(url);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      // Prompts often arrive after hydration; a short settle is enough and a
      // networkidle wait hangs on sites with polling.
      await page.waitForTimeout(900);
    } catch {
      return [];
    }
    const text = await textOf(page).catch(() => "");
    const score = scorePage(page.url(), text);
    if (score && (!best || score > best.score)) best = { score, url: page.url(), text };
    if (depth >= 2 || (best && best.score >= 12)) return [];
    const links = await linksOf(page, host).catch(() => []);
    return links
      .filter((l) => !AVOID.test(l.href) && WANT.test(`${l.href} ${l.label}`))
      .map((l) => ({ ...l, rank: rank(l.href, l.label) }))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 6);
  };

  let frontier = await visit(start, 0);
  for (const depth of [1, 2]) {
    const next = [];
    for (const l of frontier) {
      if (best && best.score >= 12) break;
      next.push(...(await visit(l.href, depth)));
    }
    frontier = next.sort((a, b) => b.rank - a.rank).slice(0, 6);
    if (!frontier.length) break;
  }

  await page.close();
  return best && best.score >= 8 ? best : null;
}

/** One page, rendered, when we already know which page. */
async function readOne(ctx, url) {
  const page = await ctx.newPage();
  await page.route("**/*", (route) =>
    ["image", "media", "font"].includes(route.request().resourceType())
      ? route.abort()
      : route.continue()
  );
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(1200);
    const text = await textOf(page);
    const score = scorePage(page.url(), text);
    return score >= 4 ? { score, url: page.url(), text } : null;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

const rows = readCsv(SOURCES);
const only = args.unitids ? new Set(args.unitids.split(",")) : null;

/**
 * Two jobs, and the second one is why this exists at all now.
 *
 * --fetchOnly renders pages we already have the address of but could not read:
 * Columbia answers curl with a 403 and a browser with the page. Without it,
 * knowing the URL was not enough.
 */
const FETCH_ONLY = args.fetchOnly === "true" || args.fetchOnly === true;
const todo = rows
  .filter((r) => {
    if (only && !only.has(r.unitid)) return false;
    if (FETCH_ONLY) return r.url && !existsSync(join(OUT, `${r.unitid}.txt`));
    return !r.url && r.admissions_url;
  })
  .slice(0, LIMIT);
console.log(`${todo.length} colleges to render, ${WORKERS} at a time`);

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
let done = 0;
let found = 0;

const save = () => {
  const header = "unitid,name,url,admissions_url,note";
  const body = rows
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r) => [r.unitid, r.name, r.url, r.admissions_url, r.note].join(","))
    .join("\n");
  writeFileSync(`${SOURCES}.tmp`, `${header}\n${body}\n`);
  renameSync(`${SOURCES}.tmp`, SOURCES);
};

async function worker(queue) {
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 900 },
  });
  for (;;) {
    const row = queue.shift();
    if (!row) break;
    let hit = null;
    try {
      hit = FETCH_ONLY ? await readOne(ctx, row.url) : await findFor(ctx, row);
    } catch {
      hit = null;
    }
    done += 1;
    if (hit) {
      found += 1;
      row.url = hit.url;
      row.note = "";
      const lines = hit.text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length >= 40);
      writeFileSync(
        join(OUT, `${row.unitid}.txt`),
        `# ${row.name}\n# ${hit.url}\n\n${lines.join("\n\n")}\n`
      );
      console.log(`OK   ${done}/${todo.length} ${row.name.slice(0, 44)}  ${hit.url}`);
    } else {
      row.note = "essay page not found";
      console.log(`MISS ${done}/${todo.length} ${row.name.slice(0, 44)}`);
    }
    if (done % 20 === 0) save();
  }
  await ctx.close();
}

const queue = [...todo];
await Promise.all(Array.from({ length: WORKERS }, () => worker(queue)));
save();
await browser.close();
console.log(`\nrendered ${found} of ${todo.length}`);
