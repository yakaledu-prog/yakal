import { useEffect } from "react";

// ============================================================
// The title and description a search result shows.
//
// Every page used to serve the one title and one description in index.html, so
// a blog post and the pricing page were the same result in Google and the same
// card when somebody pasted a link into WhatsApp.
//
// Written by hand rather than with a helmet library: this sets four or five
// tags on a handful of public pages, and a dependency that re-renders the head
// on every route change would cost more than it saves. The app behind the
// sign-in does not use it at all; those pages are not indexed.
// ============================================================

const SITE = "Yakal Education Services";
const DEFAULT_DESCRIPTION =
  "Yakal offers one-on-one academic support to help students excel in Math, Science, and SAT prep, with flexible online and in-person options tailored to every learning style.";

/** Set a meta tag, creating it if the page does not have one yet. */
function meta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function link(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  image,
  type = "website",
}: {
  /** Without the site name: "Blog" becomes "Blog | Yakal Education Services". */
  title?: string;
  description?: string;
  /** An absolute URL. Falls back to the app icon. */
  image?: string | null;
  type?: "website" | "article";
}) {
  useEffect(() => {
    const full = title ? `${title} | ${SITE}` : SITE;
    const url = window.location.origin + window.location.pathname;
    const picture = image || `${window.location.origin}/icons/icon-512.png`;

    document.title = full;
    meta('meta[name="description"]', "name", "description", description);
    link("canonical", url);

    // What a link preview reads, in WhatsApp, Slack, LinkedIn and the rest.
    meta('meta[property="og:title"]', "property", "og:title", full);
    meta('meta[property="og:description"]', "property", "og:description", description);
    meta('meta[property="og:type"]', "property", "og:type", type);
    meta('meta[property="og:url"]', "property", "og:url", url);
    meta('meta[property="og:image"]', "property", "og:image", picture);
    meta('meta[property="og:site_name"]', "property", "og:site_name", SITE);
    meta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    meta('meta[name="twitter:title"]', "name", "twitter:title", full);
    meta('meta[name="twitter:description"]', "name", "twitter:description", description);
    meta('meta[name="twitter:image"]', "name", "twitter:image", picture);
  }, [title, description, image, type]);

  return null;
}
