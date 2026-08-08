import type { SVGProps } from "react";

/**
 * X, formerly Twitter.
 *
 * Lucide exports no X logo, only the old bird, so this is the mark itself.
 *
 * Two changes from the version usually pasted around: it fills with
 * `currentColor` rather than a hardcoded `#fff`, so it takes the colour of
 * whatever it sits in like every lucide icon beside it, and it carries a
 * default size, because the original has none and collapses to whatever the
 * viewBox implies.
 */
export function XIcon({ size = 15, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1200 1227"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        fill="currentColor"
        d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"
      />
    </svg>
  );
}
