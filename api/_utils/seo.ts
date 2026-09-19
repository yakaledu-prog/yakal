// ============================================================
// What a crawler and a link preview see.
//
// The app is a single page: the HTML every route serves is the same shell, and
// the title, the description and the picture only appear once React has run.
// Google runs it and waits; WhatsApp, LinkedIn, Slack and Facebook do not, so
// a shared blog post arrived as "Yakal Education Services" and the app icon,
// whatever the post was about.
//
// So the server fills the shell in before sending it, and lists the pages
// worth crawling at /sitemap.xml. Both are plain string work, kept here away
// from the server so they can be checked without a port or a database.
// ============================================================

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute, or the crawler cannot fetch it. */
  image?: string | null;
  url: string;
  type?: "website" | "article";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One line of text out of stored HTML, for a description. */
export function summarise(html: string, words = 32): string {
  const text = html
    .replace(/<[^>]*>?/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    // A tag between a word and its comma leaves a space in front of it:
    // "<b>there</b>, reader" came out as "there , reader".
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
  const parts = text.split(" ").filter(Boolean);
  return parts.length <= words ? text : parts.slice(0, words).join(" ") + "...";
}

/**
 * Put one page's tags into the built index.html.
 *
 * The shell's own title and description are replaced rather than added to: two
 * titles in one document is undefined behaviour, and crawlers pick whichever
 * they like. The og: and twitter: tags are appended, because the shell has
 * none; a second copy would be a bug, so this strips any first.
 */
export function injectMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = meta.image ? escapeHtml(meta.image) : "";
  const url = escapeHtml(meta.url);

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(
      /<meta\s+name="description"[\s\S]*?\/?>/i,
      `<meta name="description" content="${description}" />`
    );

  // Anything a previous pass added, so re-serving cannot stack tags.
  out = out.replace(/\s*<meta\s+(property="og:|name="twitter:)[\s\S]*?\/?>/gi, "");
  out = out.replace(/\s*<link\s+rel="canonical"[\s\S]*?\/?>/gi, "");

  const tags = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:type" content="${meta.type ?? "website"}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:site_name" content="Yakal Education Services" />`,
    ...(image ? [`<meta property="og:image" content="${image}" />`] : []),
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    ...(image ? [`<meta name="twitter:image" content="${image}" />`] : []),
  ].join("\n  ");

  return out.replace("</head>", `  ${tags}\n</head>`);
}

export interface SitemapEntry {
  path: string;
  lastModified?: string | null;
  /** Rough, and only a hint. Left off where it would be a guess. */
  changeFrequency?: "daily" | "weekly" | "monthly" | "yearly";
}

/** The public pages. Everything behind a sign-in is left out on purpose. */
export const PUBLIC_PAGES: SitemapEntry[] = [
  { path: "/", changeFrequency: "weekly" },
  { path: "/posts", changeFrequency: "weekly" },
  { path: "/terms", changeFrequency: "yearly" },
  { path: "/privacy", changeFrequency: "yearly" },
  { path: "/cookies", changeFrequency: "yearly" },
  { path: "/cancellation-policy", changeFrequency: "yearly" },
];

export function buildSitemap(origin: string, entries: SitemapEntry[]): string {
  const base = origin.replace(/\/$/, "");
  const urls = entries
    .map((e) => {
      const loc = `${base}${e.path}`;
      const parts = [`    <loc>${escapeHtml(loc)}</loc>`];
      if (e.lastModified) {
        const d = new Date(e.lastModified);
        if (!Number.isNaN(d.getTime())) {
          parts.push(`    <lastmod>${d.toISOString().slice(0, 10)}</lastmod>`);
        }
      }
      if (e.changeFrequency) parts.push(`    <changefreq>${e.changeFrequency}</changefreq>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n</urlset>\n`
  );
}
