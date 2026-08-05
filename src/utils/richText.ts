/**
 * The readable text inside a rich-text value.
 *
 * Course descriptions are written in the admin's editor and stored as HTML, so
 * a card that printed the value straight out showed people `<p>sdf</p>` rather
 * than `sdf`. Cards clamp to a line or two and have no use for the markup, so
 * the tags come off rather than being rendered.
 *
 * Parsing is left to the browser rather than a regular expression, so entities
 * come out right: `&amp;` reads as `&`. Block boundaries become a space first,
 * because textContent alone would run `<p>one</p><p>two</p>` together as
 * "onetwo".
 */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  // Nothing that looks like a tag or an entity: already plain, and parsing
  // would only cost a DOM node.
  if (!/[<&]/.test(html)) return html;

  const spaced = html.replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>|<br\s*\/?>/gi, " ");
  const doc = new DOMParser().parseFromString(spaced, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
