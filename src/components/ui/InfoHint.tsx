import { Info } from "lucide-react";
import { cn } from "@/utils/cn";

// ============================================================
// A hint beside a label.
//
// The browser's own tooltip, through the title attribute. This was 200 lines
// of portal, timers, measurement and flip logic, and the thing it produced
// appeared on hover in the middle of a form and pulled the eye off whatever
// somebody was filling in. A native tooltip waits, sits where the pointer is,
// and disappears without ceremony.
//
// It also comes with things the custom one never had: it survives inside
// scroll containers, it is announced by screen readers without any aria work,
// and it cannot be positioned off the edge of the window.
//
// The cost is that it cannot be styled. That is the point of choosing it.
// ============================================================

export function InfoHint({
  text,
  size = 13,
  className,
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      title={text}
      // Focusable, so the hint is reachable without a pointer. tabIndex rather
      // than a button because there is nothing to press.
      tabIndex={0}
      role="note"
      aria-label={text}
      className={cn(
        "inline-grid cursor-help place-items-center align-middle text-[#c2c7d0] transition-colors hover:text-primary focus:text-primary focus:outline-none dark:text-[#5a6b75]",
        className
      )}
    >
      <Info size={size} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

/** Label with an optional hint, so the pairing stays consistent everywhere. */
export function FieldLabel({
  children,
  hint,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  htmlFor?: string;
  className?: string;
}) {
  const content = (
    <>
      {children}
      {hint && <InfoHint text={hint} className="ml-1" />}
    </>
  );

  // Sentence case at medium weight. Uppercase + bold on every label makes a
  // form shout, and once everything is emphasised nothing is.
  const cls = cn(
    "mb-1.5 flex items-center text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]",
    className
  );

  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {content}
    </label>
  ) : (
    <span className={cls}>{content}</span>
  );
}
