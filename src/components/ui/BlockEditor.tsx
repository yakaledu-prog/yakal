import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { en } from "@blocknote/core/locales";
import { cn } from "@/utils/cn";

// Teal brand accent for BlockNote's blue defaults (selection, hover, menus).
const brandVars = {
  "--bn-colors-selected-background": "#1099A1",
  "--bn-colors-hovered-background": "rgba(16,153,161,0.10)",
  "--bn-colors-hovered-text": "#1099A1",
} as React.CSSProperties;

/** Track the app's dark class so the editor theme updates when it's toggled. */
function useIsDark() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

interface BlockEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** Fill the parent height with no border (for full-pane editors). */
  fullHeight?: boolean;
  /** Placeholder for the first empty block. */
  placeholder?: string;
}

/**
 * Notion-style block editor (BlockNote). Uncontrolled internally; loads the
 * initial HTML once and emits clean HTML on every change for storage/preview.
 */
export function BlockEditor({ value, onChange, fullHeight, placeholder }: BlockEditorProps) {
  const editor = useCreateBlockNote(
    placeholder
      ? { dictionary: { ...en, placeholders: { ...en.placeholders, default: placeholder } } }
      : undefined
  );
  const dark = useIsDark();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (!value) return;
    (async () => {
      const blocks = await editor.tryParseHTMLToBlocks(value);
      editor.replaceBlocks(editor.document, blocks);
    })();
  }, [editor, value]);

  const emit = async () => {
    const html = await editor.blocksToHTMLLossy(editor.document);
    onChange(html);
  };

  return (
    <div
      className={cn(
        "block-editor",
        fullHeight
          ? "h-full flex flex-col bg-white dark:bg-[#1f2b31]"
          : "rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#1f2b31] py-2 min-h-[220px] focus-within:border-primary transition-colors"
      )}
      style={brandVars}
    >
      <BlockNoteView
        editor={editor}
        onChange={emit}
        theme={dark ? "dark" : "light"}
        className={fullHeight ? "flex-1 min-h-0 overflow-y-auto py-4" : ""}
      />
    </div>
  );
}
