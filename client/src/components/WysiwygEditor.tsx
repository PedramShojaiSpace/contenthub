import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Minus,
} from "lucide-react";

interface WysiwygEditorProps {
  /** Initial HTML content */
  value: string;
  /** Called whenever the editor content changes — receives updated HTML */
  onChange: (html: string) => void;
  disabled?: boolean;
}

export function WysiwygEditor({ value, onChange, disabled }: WysiwygEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the built-in heading so we can configure it via StarterKit defaults
        heading: { levels: [1, 2, 3, 4] },
        // Keep code, blockquote, hr, etc.
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-600 underline" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    editable: !disabled,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. when WP data first loads)
  useEffect(() => {
    if (!editor) return;
    // Only reset if the content actually differs to avoid cursor jumps
    const current = editor.getHTML();
    if (current !== value) {
      // Use the editor's direct setContent — suppress the update event
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Update editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const toolbarBtn = (active: boolean, onClick: () => void, title: string, icon: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col rounded-md border border-border bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 shrink-0">
        {/* History */}
        {toolbarBtn(false, () => editor.chain().focus().undo().run(), "Undo", <Undo className="h-3.5 w-3.5" />)}
        {toolbarBtn(false, () => editor.chain().focus().redo().run(), "Redo", <Redo className="h-3.5 w-3.5" />)}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Headings */}
        {toolbarBtn(
          editor.isActive("heading", { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          "Heading 2",
          <Heading2 className="h-3.5 w-3.5" />
        )}
        {toolbarBtn(
          editor.isActive("heading", { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          "Heading 3",
          <Heading3 className="h-3.5 w-3.5" />
        )}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Inline marks */}
        {toolbarBtn(editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "Bold", <Bold className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "Italic", <Italic className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run(), "Underline", <UnderlineIcon className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("link"), setLink, "Link", <LinkIcon className="h-3.5 w-3.5" />)}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        {toolbarBtn(editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "Bullet list", <List className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "Numbered list", <ListOrdered className="h-3.5 w-3.5" />)}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Alignment */}
        {toolbarBtn(editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run(), "Align left", <AlignLeft className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run(), "Align center", <AlignCenter className="h-3.5 w-3.5" />)}
        {toolbarBtn(editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run(), "Align right", <AlignRight className="h-3.5 w-3.5" />)}
        <div className="w-px h-4 bg-border mx-1" />

        {/* Divider */}
        {toolbarBtn(false, () => editor.chain().focus().setHorizontalRule().run(), "Horizontal rule", <Minus className="h-3.5 w-3.5" />)}
      </div>

      {/* Editor area */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-4 py-3 min-h-[420px] max-h-[520px] blog-prose max-w-none focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:focus:outline-none"
      />
    </div>
  );
}
