import { useState } from "react";
import { cn } from "@/utils/cn";
import { collegeImageUrl } from "@/services/collegeCatalogService";

/**
 * A college's actual crest, not its initials.
 *
 * Two sources, tried in order, because neither covers everyone:
 *
 *   Wikimedia Commons, via the catalog's `logo` column. 1,024 of our 1,944
 *   schools, and the better image: a real crest at a real resolution, with a
 *   licence we have already recorded.
 *
 *   The institution's own favicon for the rest. Every college has one, it is
 *   by definition their own mark, and it is served at 64px which is larger
 *   than anywhere we draw this.
 *
 * A monogram is the last resort rather than the default. Twenty rows of
 * coloured squares with letters in them tell a student nothing and make a list
 * of colleges look like a list of avatars, which is the thing this is not.
 *
 * The favicon comes through Google's resolver rather than <domain>/favicon.ico
 * because that path is a 404 at a good fraction of universities, whose real
 * icon is declared in a <link> tag we would have to fetch the page to read.
 * The only thing sent is a public institutional domain. If that trade stops
 * being acceptable, this function is the single place to change it.
 */
function faviconUrl(website: string | null, size: number): string | null {
  if (!website) return null;
  try {
    const host = new URL(website).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size >= 48 ? 64 : 32}`;
  } catch {
    return null;
  }
}

/** Commons serves an SVG crest happily, but some are 4,000px wide. */
function crestUrl(logo: string | null, size: number): string | null {
  return collegeImageUrl(logo, Math.max(size * 2, 96));
}

export function CollegeLogo({
  name,
  logo = null,
  website = null,
  size = 40,
  className,
}: {
  name: string;
  /** Wikimedia Commons filename from the catalog. */
  logo?: string | null;
  website?: string | null;
  size?: number;
  className?: string;
}) {
  // Which source we are on. Stepping forward on error rather than holding a
  // boolean, so a school with a broken crest still gets its favicon.
  const [step, setStep] = useState(0);

  const sources = [crestUrl(logo, size), faviconUrl(website, size)].filter(
    (s): s is string => !!s
  );
  const src = sources[step] ?? null;

  const box = cn(
    "shrink-0 overflow-hidden rounded-md border border-border/50 bg-white",
    "flex items-center justify-center dark:bg-white/90",
    className
  );

  if (!src) {
    return (
      <div className={box} style={{ width: size, height: size }} aria-hidden>
        <span
          className="font-semibold text-primary"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {name.replace(/^(The|University of)\s+/i, "").trim().charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className={box} style={{ width: size, height: size }}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setStep((n) => n + 1)}
        className="h-full w-full object-contain p-1"
      />
    </div>
  );
}

/**
 * The shared applications' own marks.
 *
 * Same reasoning as a college crest: a student recognises the Common App logo
 * far faster than they read the words "Common App". These come from each
 * organisation's own site, so nothing is copied into the repo.
 */
const APP_SITES: Record<string, string> = {
  common_app: "https://www.commonapp.org/",
  uc: "https://admission.universityofcalifornia.edu/",
  coalition: "https://www.scoir.com/",
  // The activities list is a Common App section, so it wears the same mark.
  activities: "https://www.commonapp.org/",
  questbridge: "https://www.questbridge.org/",
};

export function ApplicationLogo({
  appKey,
  name,
  size = 40,
  className,
}: {
  appKey: string;
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <CollegeLogo
      name={name}
      website={APP_SITES[appKey] ?? null}
      size={size}
      className={className}
    />
  );
}
