/**
 * One-off / re-runnable image optimizer.
 *
 * Converts every PNG in src/assets/images to WebP, downscaling each to roughly
 * 2x its largest on-screen display size, then removes the original PNG.
 * Run with: npm run optimize:images
 */
import sharp from "sharp";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";

const DIR = "src/assets/images";

// Max width (downscale only) + WebP quality, chosen per image role.
const rules = [
  { test: /^hero-overlay/, width: 1600, quality: 68 },
  { test: /^about-banner/, width: 1600, quality: 72 },
  { test: /^(blog-|about-offer|resource-)/, width: 1200, quality: 74 },
  { test: /^subject-/, width: 1160, quality: 76 },
  { test: /^team-/, width: 720, quality: 80 },
  { test: /^logo/, width: 280, quality: 90 },
  { test: /^testimonial-/, width: 160, quality: 82 },
];
const fallback = { width: 1200, quality: 75 };
const ruleFor = (name) => rules.find((r) => r.test.test(name)) ?? fallback;

const kb = (b) => (b / 1024).toFixed(1) + " KB";

const files = (await readdir(DIR)).filter((f) => f.endsWith(".png")).sort();
let totalIn = 0;
let totalOut = 0;
const rows = [];

for (const file of files) {
  const src = path.join(DIR, file);
  const out = src.replace(/\.png$/, ".webp");
  const { width, quality } = ruleFor(file);

  const before = (await stat(src)).size;
  await sharp(src)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(out);
  const after = (await stat(out)).size;
  await unlink(src);

  totalIn += before;
  totalOut += after;
  rows.push([file.replace(/\.png$/, ""), before, after]);
}

console.log("\nImage optimization report (PNG → WebP)\n");
console.log("name".padEnd(28), "before".padStart(10), "after".padStart(10), "saved".padStart(8));
console.log("-".repeat(60));
for (const [name, before, after] of rows) {
  const pct = (100 * (1 - after / before)).toFixed(0) + "%";
  console.log(name.padEnd(28), kb(before).padStart(10), kb(after).padStart(10), pct.padStart(8));
}
console.log("-".repeat(60));
console.log(
  "TOTAL".padEnd(28),
  kb(totalIn).padStart(10),
  kb(totalOut).padStart(10),
  ((100 * (1 - totalOut / totalIn)).toFixed(1) + "%").padStart(8)
);
