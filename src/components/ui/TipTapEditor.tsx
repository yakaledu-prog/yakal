import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Underline as UnderlineIcon, List, RemoveFormatting, Paperclip } from 'lucide-react'

interface TipTapEditorProps {
  value: string;
  onChange: (value: string) => void;
  onAttachClick?: () => void;
  toolbarRight?: React.ReactNode;
}

export function TipTapEditor({ value, onChange, onAttachClick, toolbarRight }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: 'Instructions (optional)',
        emptyEditorClass: 'is-editor-empty',
        emptyNodeClass: 'is-editor-empty',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm sm:prose-base focus:outline-none min-h-[160px] px-6 py-4',
      },
    },
  })

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 bg-transparent overflow-hidden">
        <EditorContent editor={editor} />
      </div>

      {/* Toolbar at the bottom */}
      <div className="flex items-center gap-1 p-2 px-4 border-t border-[#e0e0e0] dark:border-border/30">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-foreground transition-colors ${editor.isActive('bold') ? 'bg-black/10 dark:bg-white/20' : ''}`}
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-foreground transition-colors ${editor.isActive('italic') ? 'bg-black/10 dark:bg-white/20' : ''}`}
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-foreground transition-colors ${editor.isActive('underline') ? 'bg-black/10 dark:bg-white/20' : ''}`}
        >
          <UnderlineIcon size={18} />
        </button>
        <div className="w-[1px] h-4 bg-border/50 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-foreground transition-colors ${editor.isActive('bulletList') ? 'bg-black/10 dark:bg-white/20' : ''}`}
        >
          <List size={18} />
        </button>
        <div className="w-[1px] h-4 bg-border/50 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-foreground transition-colors"
        >
          <RemoveFormatting size={18} />
        </button>

        <div className="flex-1" />
        {onAttachClick && (
          <button
            type="button"
            onClick={onAttachClick}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title="Attach Link"
          >
            <Paperclip size={18} />
          </button>
        )}
        {toolbarRight}
      </div>
    </div>
  )
}
