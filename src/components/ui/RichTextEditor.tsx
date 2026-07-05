import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Link2, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/utils/cn";

const CONTENT_CLASS =
  "min-h-[150px] max-h-[340px] overflow-y-auto px-3.5 py-3 text-[14px] leading-relaxed text-[#111] dark:text-white focus:outline-none " +
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 " +
  "[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 " +
  "[&_a]:text-primary [&_a]:underline [&_strong]:font-semibold";

function ToolbarButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
        active ? "bg-primary/10 text-primary" : "text-[#54656f] dark:text-[#aebac1] hover:bg-[#f0f2f5] dark:hover:bg-[#182329]"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const addLink = () => {
    const url = window.prompt("Link URL");
    if (url === null) return;
    if (url === "") editor.chain().focus().unsetLink().run();
    else editor.chain().focus().setLink({ href: url }).run();
  };
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#e9edef] dark:border-[#2a3942] flex-wrap">
      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} /></ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} /></ToolbarButton>
      <ToolbarButton title="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={15} /></ToolbarButton>
      <div className="w-px h-5 bg-[#e9edef] dark:bg-[#2a3942] mx-1" />
      <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={15} /></ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={15} /></ToolbarButton>
      <ToolbarButton title="Link" active={editor.isActive("link")} onClick={addLink}><Link2 size={15} /></ToolbarButton>
      <div className="w-px h-5 bg-[#e9edef] dark:bg-[#2a3942] mx-1" />
      <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></ToolbarButton>
    </div>
  );
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: { attributes: { class: CONTENT_CLASS } },
  });

  // Keep editor in sync if the value is reset externally (e.g. form clear).
  useEffect(() => {
    if (editor && value === "" && editor.getHTML() !== "<p></p>") {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  return (
    <div className="rounded-xl border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] focus-within:border-primary transition-colors">
      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

/** Render stored rich-text HTML read-only. */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-[14px] leading-relaxed text-[#111] dark:text-white",
        "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2",
        "[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2",
        "[&_a]:text-primary [&_a]:underline [&_strong]:font-semibold",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Strip tags for short text previews. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
