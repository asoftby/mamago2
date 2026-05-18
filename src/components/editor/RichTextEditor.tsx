"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { useEffect, type CSSProperties } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Redo, Underline as UnderlineIcon, Undo } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  minHeight?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Введите текст...",
  error,
  disabled = false,
  readOnly = false,
  compact = false,
  minHeight = compact ? 128 : 200,
}: RichTextEditorProps) {
  const isInteractive = !disabled && !readOnly;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, // Disable headings for simplicity
        code: false, // Disable code blocks
        codeBlock: false,
        /** Явно оставляем блочные абзацы: Enter → новый `<p>`, Shift+Enter → `<br>` (HardBreak). */
        paragraph: {},
      }),
      Underline,
      Link.configure({
        autolink: true,
        openOnClick: false,
        defaultProtocol: "https",
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editable: isInteractive,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isInteractive);
    }
  }, [isInteractive, editor]);

  const toolbarButtonClassName = compact
    ? "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground disabled:opacity-30"
    : "inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground disabled:opacity-30";

  const handleLinkToggle = () => {
    if (!editor || !isInteractive) return;

    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const nextUrl = window.prompt("Введите ссылку", previousUrl ?? "https://");

    if (nextUrl == null) return;

    const normalizedUrl = nextUrl.trim();
    if (!normalizedUrl) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
  };

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
        error ? "border-red-500" : "border-border/70",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        disabled && "opacity-50 cursor-not-allowed",
        readOnly && "bg-muted/10"
      )}
    >
      {/* Toolbar */}
      <div
        className={cn(
          "flex items-center gap-1 overflow-x-auto border-b bg-muted/20",
          compact ? "px-2.5 py-2" : "px-3 py-2.5",
        )}
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!isInteractive || !editor.can().chain().focus().toggleBold().run()}
          className={cn(
            toolbarButtonClassName,
            editor.isActive("bold") && "bg-foreground/10 text-foreground"
          )}
          title="Жирный"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!isInteractive || !editor.can().chain().focus().toggleItalic().run()}
          className={cn(
            toolbarButtonClassName,
            editor.isActive("italic") && "bg-foreground/10 text-foreground"
          )}
          title="Курсив"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!isInteractive || !editor.can().chain().focus().toggleUnderline().run()}
          className={cn(
            toolbarButtonClassName,
            editor.isActive("underline") && "bg-foreground/10 text-foreground"
          )}
          title="Подчеркнутый"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleLinkToggle}
          disabled={!isInteractive}
          className={cn(
            toolbarButtonClassName,
            editor.isActive("link") && "bg-foreground/10 text-foreground"
          )}
          title={editor.isActive("link") ? "Убрать ссылку" : "Добавить ссылку"}
        >
          <Link2 className="w-4 h-4" />
        </button>

        <div className="mx-1 h-6 w-px bg-border" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={!isInteractive || !editor.can().chain().focus().toggleBulletList().run()}
          className={cn(
            toolbarButtonClassName,
            editor.isActive("bulletList") && "bg-foreground/10 text-foreground"
          )}
          title="Маркированный список"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={!isInteractive || !editor.can().chain().focus().toggleOrderedList().run()}
          className={cn(
            toolbarButtonClassName,
            editor.isActive("orderedList") && "bg-foreground/10 text-foreground"
          )}
          title="Нумерованный список"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="mx-1 h-6 w-px bg-border" />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!isInteractive || !editor.can().chain().focus().undo().run()}
          className={toolbarButtonClassName}
          title="Отменить"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!isInteractive || !editor.can().chain().focus().redo().run()}
          className={toolbarButtonClassName}
          title="Повторить"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className={cn(
          "rich-text-editor-surface prose prose-sm max-w-none focus:outline-none",
          compact ? "px-3 py-3" : "px-4 py-4",
          "[&_.ProseMirror]:outline-none",
          "min-h-[var(--rte-min-height)] [&_.ProseMirror]:min-h-[var(--rte-min-height)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline",
          "[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5",
          "[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5",
          readOnly && "[&_.ProseMirror]:cursor-default"
        )}
        style={{ "--rte-min-height": `${minHeight}px` } as CSSProperties}
      />
    </div>
  );
}
