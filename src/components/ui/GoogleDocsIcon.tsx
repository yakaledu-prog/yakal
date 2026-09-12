import { useId } from "react";

/**
 * The Google Docs mark, for the button that goes to Google Docs.
 *
 * A fourth set of colours, deliberately. The house rule is our three brand
 * colours and nothing else, and this is the case it does not cover: these are
 * Google's colours on Google's logo, and a teal Google Docs icon would be a
 * worse lie than no icon at all. Same reasoning as utils/confetti.ts and
 * lib/supabase.ts, which keep literals for their own reasons and say so.
 *
 * Inlined rather than fetched. The favicon resolver we use for college crests
 * returns Google's generic G for docs.google.com, which is the wrong mark, and
 * hotlinking an asset off gstatic makes a button depend on a URL nobody
 * promised to keep. The artwork is Google's, published as public domain on
 * Wikimedia Commons; the trademark is still theirs and this is nominative use,
 * naming the product a link actually opens.
 *
 * Source: https://commons.wikimedia.org/wiki/File:Google_Docs_icon_(2026).svg
 *
 * The ids are generated per instance. The original ships with ids "a", "b" and
 * "c", and two copies on one page would have the second silently reuse the
 * first one's mask.
 *
 * The original's drop shadow is dropped. It is a Gaussian blur sized for an app
 * icon, and at the 15px this renders at it smeared the page into a blue blob
 * with no fold and no lines, which was only obvious against the dark theme.
 */
export function GoogleDocsIcon({ size = 15 }: { size?: number }) {
  const uid = useId();
  const mask = `${uid}-mask`;
  const fill = `${uid}-fill`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 800 1100.04"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className="shrink-0"
    >
      <mask id={mask} maskUnits="userSpaceOnUse" x="32" y="8" width="128" height="176">
        <path
          d="M130.334 184H61.6c-8.9435 0-13.4152 0-16.9625-1.404a20 20 0 0 1-11.233-11.234C32 167.815 32 163.343 32 154.4V37.6c0-8.9435 0-13.4152 1.4045-16.9625a20 20 0 0 1 11.233-11.233C48.1848 8 52.6565 8 61.6 8H100l54.793 54.7933v.0001c1.661 1.6609 2.492 2.4914 3.13 3.4305a11.99 11.99 0 0 1 1.862 4.5011c.212 1.1154.212 2.3014.21 4.6735-.035 48.9185-.057 49.4005-.058 78.9675 0 8.966 0 13.45-1.405 16.997a20 20 0 0 1-11.233 11.233C143.752 184 139.279 184 130.334 184"
          fill="#fff"
        />
      </mask>
      <g
        mask={`url(#${mask})`}
        transform="matrix(6.2502276,0,0,6.2502276,-200.00728,-50.001821)"
      >
        <path d="M159.94 184H31.9999V8h68l59.9991 60z" fill="#3186ff" />
        <path d="M43 192h106V20H43Z" fill={`url(#${fill})`} />
      </g>
      <path
        d="M768.7468 343.7319c-15.6631-11.7554-35.1263-18.72-56.2208-18.72H505.0183c-44.1829 0-80.003-35.8189-80.003-80.0017V0Z"
        fill="#76bbff"
      />
      <rect x="200.0135" y="662.5241" width="400.0146" height="75.0027" rx="37.5014" fill="#ffffff" />
      <rect x="200.0135" y="843.7807" width="300.0109" height="75.0027" rx="37.5014" fill="#ffffff" />
      <defs>
        <linearGradient
          id={fill}
          x1="96"
          y1="59.2839"
          x2="54.6124"
          y2="171.338"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".33" stopColor="#3186FF" />
          <stop offset="1" stopColor="#A9A8FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
