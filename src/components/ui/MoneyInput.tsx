import { useState } from "react";
import { cn } from "@/utils/cn";

export type Currency = "ETB" | "USD";
const SYMBOL: Record<Currency, string> = { ETB: "Br", USD: "$" };

interface MoneyInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
}

/**
 * Money field with a currency prefix + ETB/USD toggle.
 * Shows only the (centered) label until focused/filled, then the label floats,
 * the currency symbol appears, and the value is editable.
 */
export function MoneyInput({ label, value, onChange, currency, onCurrencyChange }: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const float = focused || value !== "";

  return (
    <div
      className={cn(
        "relative h-14 rounded-xl border bg-transparent transition-all",
        focused ? "border-primary ring-2 ring-primary/15" : "border-[#e9edef] dark:border-[#2a3942]"
      )}
    >
      {/* Label: centered when empty, floats up on focus/value */}
      <span
        className={cn(
          "pointer-events-none absolute transition-all duration-200",
          float
            ? "left-11 top-2 text-[11px] font-medium text-primary"
            : "left-4 top-1/2 -translate-y-1/2 text-[14px] text-[#54656f] dark:text-[#aebac1]"
        )}
      >
        {label}
      </span>

      {/* Currency symbol (only once floated) */}
      {float && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#54656f] dark:text-[#aebac1]">
          {SYMBOL[currency]}
        </span>
      )}

      <input
        type="number"
        min="0"
        inputMode="decimal"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full bg-transparent pl-11 pr-28 pt-6 pb-1.5 text-[14px] text-[#111] dark:text-white focus:outline-none"
      />

      {/* ETB / USD segmented toggle */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex bg-[#f0f2f5] dark:bg-[#111b21] rounded-lg p-0.5">
        {(["ETB", "USD"] as Currency[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onCurrencyChange(c)}
            className={cn(
              "px-2.5 py-1 text-[12px] font-semibold rounded-md transition-colors",
              currency === c
                ? "bg-white dark:bg-[#202c33] text-primary shadow-sm"
                : "text-[#54656f] dark:text-[#aebac1]"
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
