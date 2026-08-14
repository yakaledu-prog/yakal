import { forwardRef, TextareaHTMLAttributes, InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

// Shared visual tokens for the floating-label fields (teal brand accent).
const fieldBase =
  "peer w-full rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-transparent px-4 text-[14px] text-[#111] dark:text-white " +
  "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all placeholder-transparent";

// Floated (small, top) label. Extra top padding on the field gives the
// requested gap between the label and the value.
const labelBase =
  "pointer-events-none absolute left-4 text-[#54656f] dark:text-[#aebac1] transition-all duration-200 " +
  "top-1/2 -translate-y-1/2 text-[14px] " +
  "peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-primary peer-focus:font-medium " +
  "peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px]";

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Small helper shown only while the field is focused. */
  hint?: string;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, hint, className, id, ...props }, ref) => {
    const fieldId = id || `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          placeholder={label}
          className={cn(fieldBase, "h-14 pt-6 pb-1.5", className)}
          {...props}
        />
        <label htmlFor={fieldId} className={labelBase}>
          {label}
        </label>
        {hint && (
          <p className="hidden peer-focus:block text-[12px] text-[#54656f] dark:text-[#aebac1] mt-1.5 px-1">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
FloatingInput.displayName = "FloatingInput";

interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const FloatingTextarea = forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  ({ label, className, id, rows = 3, ...props }, ref) => {
    const fieldId = id || `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <div className="relative">
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          placeholder={label}
          className={cn(fieldBase, "pt-6 pb-2 resize-none leading-relaxed", className)}
          {...props}
        />
        <label
          htmlFor={fieldId}
          className={labelBase.replace("top-1/2 -translate-y-1/2", "top-4 -translate-y-0")}
        >
          {label}
        </label>
      </div>
    );
  }
);
FloatingTextarea.displayName = "FloatingTextarea";
