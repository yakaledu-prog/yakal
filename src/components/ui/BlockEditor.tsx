import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

// Teal brand accent for BlockNote's blue defaults (selection, hover, menus).
const brandVars = {
  "--bn-colors-selected-background": "#1099A1",
  "--bn-colors-hovered-background": "rgba(16,153,161,0.10)",
  "--bn-colors-hovered-text": "#1099A1",
  "--bn-colors-editor-background": "transparent",
} as React.CSSProperties;

/**
 * Notion-style block editor (BlockNote). Uncontrolled internally; loads the
 * initial HTML once and emits clean HTML on every change for storage/preview.
 */
export function BlockEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useCreateBlockNote();
  const loaded = useRef(false);
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

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
      className="block-editor rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] py-2 min-h-[220px] focus-within:border-primary transition-colors"
      style={brandVars}
    >
      <BlockNoteView editor={editor} onChange={emit} theme={dark ? "dark" : "light"} />
    </div>
  );
}
