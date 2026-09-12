/**
 * What survives the trip from a Google Doc onto our page.
 *
 * The export is rendered rather than iframed, which means its markup lands
 * inside our origin and its inline styles land on top of our theme. Both of
 * those went wrong once:
 *
 *   Colour. Google writes color:#000000 onto every span. The first attempt to
 *   strip it anchored on `^|;` across the whole document, so it never removed
 *   the FIRST declaration in an attribute, which is exactly where Google puts
 *   colour. Light mode looked perfect and the dark theme rendered a student's
 *   essay as black on near-black. Caught by measuring the computed colour in a
 *   real browser, which is the only place that bug is visible.
 *
 *   Spacing. margin:0 on the element beats any stylesheet, so every paragraph
 *   sat flush against the next.
 *
 * The rest of this is the ordinary reason to sanitise: the Doc's contents are
 * written by a student, and whatever Google's exporter does today it is not a
 * contract.
 *
 * Needs nothing: pure string in, pure string out.
 */
import { sanitiseExportedHtml } from "../../api/_handlers/drive.js";

let failures = 0;
const pass = (what: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  -> ${detail}` : ""}`);
};

const EXPORT = `<html><head><meta charset="UTF-8"><style>.c1{color:red}</style></head>
<body class="doc-content" style="background-color:#ffffff;max-width:468pt;padding:72pt">
<p style="padding:0;margin:0;color:#000000;font-size:11pt;font-family:&quot;Arial&quot;;line-height:1.15;text-align:center">
<span style="color:#000000;font-weight:700;font-style:italic;text-decoration:underline;vertical-align:baseline">Bold and italic</span></p>
<p style="color:#000000;margin-top:12pt">Second paragraph</p>
</body></html>`;

const out = sanitiseExportedHtml(EXPORT);

// The bug that only the dark theme could show.
pass("no colour survives, wherever it sat in the attribute", !/color\s*:/i.test(out), out.match(/[^;"]*color[^;"]*/i)?.[0] ?? "");
pass("no background survives", !/background/i.test(out));

// The bug that made every paragraph run into the next.
pass("no margin or padding survives", !/(margin|padding)\s*:/i.test(out));
pass("no line-height survives", !/line-height/i.test(out));
pass("no font-family survives", !/font-family/i.test(out));

// What the writer actually chose has to come through.
pass("bold survives", /font-weight\s*:\s*700/.test(out));
pass("italics survive", /font-style\s*:\s*italic/.test(out));
pass("underline survives", /text-decoration\s*:\s*underline/.test(out));
pass("a deliberate alignment survives", /text-align\s*:\s*center/.test(out));
// Docs writes text-align:left onto everything, chosen or not, and keeping it
// meant the page could never set its own measure.
pass(
  "the default alignment does not",
  !/text-align\s*:\s*(left|start)/i.test(sanitiseExportedHtml('<body><p style="text-align:left">a</p></body>'))
);
pass("font size survives", /font-size\s*:\s*11pt/.test(out));
pass("the text itself survives", out.includes("Bold and italic") && out.includes("Second paragraph"));

// Ordinary sanitising.
pass("the head is dropped", !/<meta|<style|charset/i.test(out));
pass("an emptied style attribute is removed rather than left blank", !/style=""/.test(out));

const NASTY = `<body><p onclick="steal()" style="color:#000">hi</p>
<script>fetch('//evil')</script>
<a href="javascript:alert(1)">x</a>
<img src='javascript:alert(2)'></body>`;
const clean = sanitiseExportedHtml(NASTY);
pass("scripts are removed", !/<script/i.test(clean));
pass("event handlers are removed", !/onclick/i.test(clean));
pass("javascript: urls are defused", !/javascript:/i.test(clean), clean);

console.log(failures === 0 ? "\nall good" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
