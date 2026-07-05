import { forwardRef, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

// Shared visual tokens for the floating-label fields (teal brand accent).
const fieldBase =
  "peer w-full rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-transparent px-4 text-[14px] text-[#111] dark:text-white " +
  "focus:outline-none focus:border-[#1099A1] focus:ring-2 focus:ring-[#1099A1]/15 transition-all placeholder-transparent";

const labelBase =
  "pointer-events-none absolute left-4 text-[#54656f] dark:text-[#aebac1] transition-all duration-200 " +
  "top-1/2 -translate-y-1/2 text-[14px] " +
  // floated state: focused OR has content (placeholder-shown trick)
  "peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-[#1099A1] peer-focus:font-medium " +
  "peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px]";

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, className, id, ...props }, ref) => {
    const fieldId = id || `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          placeholder={label}
          className={cn(fieldBase, "h-14 pt-5 pb-1.5", className)}
          {...props}
        />
        <label htmlFor={fieldId} className={labelBase}>
          {label}
        </label>
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
        <label htmlFor={fieldId} className={labelBase.replace("top-1/2 -translate-y-1/2", "top-4 -translate-y-0")}>
          {label}
        </label>
      </div>
    );
  }
);
FloatingTextarea.displayName = "FloatingTextarea";

interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

// Select can't use the placeholder-shown trick, so the label floats whenever
// a value is chosen (driven by the `data-filled` attribute set by the caller).
export const FloatingSelect = forwardRef<HTMLSelectElement, FloatingSelectProps>(
  ({ label, className, id, value, children, ...props }, ref) => {
    const fieldId = id || `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
    const filled = value !== undefined && value !== "";
    return (
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          value={value}
          className={cn(
            "peer w-full h-14 rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-transparent px-4 pt-5 pb-1.5 text-[14px]",
            "text-[#111] dark:text-white focus:outline-none focus:border-[#1099A1] focus:ring-2 focus:ring-[#1099A1]/15 transition-all appearance-none",
            !filled && "text-transparent",
            className
          )}
          {...props}
        >
          {children}
        </select>
        <label
          htmlFor={fieldId}
          className={cn(
            "pointer-events-none absolute left-4 transition-all duration-200 text-[#54656f] dark:text-[#aebac1]",
            filled
              ? "top-2.5 text-[11px] text-[#1099A1] font-medium"
              : "top-1/2 -translate-y-1/2 text-[14px] peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-[#1099A1]"
          )}
        >
          {label}
        </label>
        <svg
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#54656f] dark:text-[#aebac1]"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    );
  }
);
FloatingSelect.displayName = "FloatingSelect";
