import React, { useRef } from "react";
import { cn } from "@/utils/cn";

/**
 * An editable JSON block with syntax colouring.
 *
 * A transparent textarea sitting exactly on top of a coloured <pre>. The
 * textarea keeps every native behaviour that matters when someone is pasting a
 * test into it: undo, selection, spellcheck off, the caret, IME. The <pre>
 * behind it only paints. The two must agree on font, size, line height,
 * padding, tab size and wrapping or the caret drifts away from the text, which
 * is why those live in one shared constant rather than on each element.
 *
 * Hand-rolled rather than pulling in a highlighter. Prism and Shiki are both
 * larger than this whole page, and JSON has five token types.
 */
const SHARED =
  "m-0 h-full w-full whitespace-pre-wrap break-words border-0 p-4 font-mono " +
  "text-[12.5px] leading-[1.65] tracking-normal";

type Token = { text: string; kind: string };

/**
 * Tokenise for colour only.
 *
 * Deliberately not a parser: this has to keep painting while the text is
 * half-typed and invalid, which is most of the time someone is editing. It
 * walks strings properly so an escaped quote cannot end one early, and calls a
 * string a key when the next thing after it is a colon.
 */
function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;

  const push = (text: string, kind: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") j += 2;
        else if (src[j] === '"') break;
        else j += 1;
      }
      const str = src.slice(i, Math.min(j + 1, src.length));
      // A string followed by a colon is a key, whatever sits between them.
      let k = j + 1;
      while (k < src.length && /\s/.test(src[k])) k += 1;
      push(str, src[k] === ":" ? "key" : "string");
      i = j + 1;
      continue;
    }

    if (/[\d-]/.test(ch) && /[\s[,:]/.test(src[i - 1] ?? " ")) {
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
      if (m) {
        push(m[0], "number");
        i += m[0].length;
        continue;
      }
    }

    const word = /^(true|false|null)\b/.exec(src.slice(i));
    if (word) {
      push(word[0], "keyword");
      i += word[0].length;
      continue;
    }

    push(ch, /[{}[\],:]/.test(ch) ? "punct" : "plain");
    i += 1;
  }

  return out;
}

const COLOUR: Record<string, string> = {
  key: "text-tertiary",
  string: "text-secondary",
  number: "text-primary",
  keyword: "text-primary",
  punct: "text-white/45",
  plain: "text-white/80",
};

export function JsonEditor({
  value,
  onChange,
  rows = 16,
  hint,
  action,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  /** Shown inside the block, above the code, where the code is being read. */
  hint?: string;
  /** Floated over the bottom right of the block, above the textarea. */
  action?: React.ReactNode;
  className?: string;
}) {
  const preRef = useRef<HTMLPreElement>(null);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-[#111b21] ring-1 ring-white/10",
        className
      )}
    >
      {hint && (
        <p className="border-b border-white/10 px-4 py-2 font-mono text-[11.5px] text-white/45">
          {hint}
        </p>
      )}
      <div className="relative" style={{ height: `calc(${rows} * 1.65 * 12.5px + 2rem)` }}>
      <pre ref={preRef} aria-hidden className={cn(SHARED, "overflow-auto")}>
        {tokenize(value).map((t, i) => (
          <span key={i} className={COLOUR[t.kind]}>
            {t.text}
          </span>
        ))}
        {/* Without this the last line scrolls out of reach of the caret when
            the text ends on a newline. */}
        {"\n"}
      </pre>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          const pre = preRef.current;
          if (!pre) return;
          pre.scrollTop = e.currentTarget.scrollTop;
          pre.scrollLeft = e.currentTarget.scrollLeft;
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          SHARED,
          "absolute inset-0 resize-none overflow-auto bg-transparent text-transparent caret-white outline-none",
          // The selection has to stay visible through transparent text.
          "selection:bg-primary/40 selection:text-transparent"
        )}
      />
      </div>

      {/* Over the code rather than under it. The textarea covers the whole
          block, so this has to sit above it to stay clickable. */}
      {action && <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">{action}</div>}
    </div>
  );
}
