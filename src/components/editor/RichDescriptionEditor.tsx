"use client";

/**
 * RichDescriptionEditor
 *
 * Lightweight rich text editor for content descriptions (Events, Places, Offers).
 * Built on Tiptap with a minimal, premium toolbar.
 *
 * Supported formatting:
 * - H2, H3 headings
 * - Bold, Italic
 * - Bullet list, Ordered list
 * - Horizontal rule (divider)
 * - Paragraphs (Enter = new paragraph)
 *
 * Storage format: HTML string (compatible with existing Event description storage)
 * Preview mode: toggle between edit and rendered preview
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Minus,
  Eye,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeRichContent } from "@/components/content/RichContentRenderer";

interface RichDescriptionEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  /** Show character count. Default: true */
  showCharCount?: boolean;
  /** Min height of the editor area in px. Default: 220 */
  minHeight?: number;
}

// ─── Toolbar button ───────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  /** Text label instead of icon (for H2/H3) */
  label?: string;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent editor from losing focus on toolbar click
        e.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center h-7 min-w-[28px] px-1.5 rounded text-sm font-medium",
        "transition-colors duration-100 select-none",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/6",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0" aria-hidden />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RichDescriptionEditor({
  value,
  onChange,
  placeholder = "Расскажите подробнее...",
  error,
  disabled = false,
  showCharCount = true,
  minHeight = 220,
}: RichDescriptionEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        code: false,
        codeBlock: false,
        blockquote: false,
        paragraph: {},
        horizontalRule: {},
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. AI rewrite)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // Sync disabled state
  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [disabled, editor]);

  // Character count (plain text length)
  const charCount = editor
    ? editor.state.doc.textContent.length
    : value.replace(/<[^>]*>/g, "").length;

  if (!editor) return null;

  const isEdit = mode === "edit";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-colors",
        error ? "border-destructive" : "border-input",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20",
        disabled && "opacity-60 pointer-events-none",
      )}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/20 overflow-x-auto no-scrollbar">
        {/* Inline formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          disabled={!isEdit}
          title="Жирный (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          disabled={!isEdit}
          title="Курсив (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          disabled={!isEdit}
          title="Маркированный список"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          disabled={!isEdit}
          title="Нумерованный список"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Preview toggle */}
        <div className="flex items-center rounded-lg border border-border/60 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
              mode === "edit"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Pencil className="w-3 h-3" />
            Редактор
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
              mode === "preview"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="w-3 h-3" />
            Просмотр
          </button>
        </div>
      </div>

      {/* ── Editor / Preview area ────────────────────────────────────────── */}
      {mode === "edit" ? (
        <EditorContent
          editor={editor}
          style={{ minHeight }}
          className={cn(
            "rich-text-editor-surface rich-description-editor",
            "prose prose-sm max-w-none px-4 py-3",
            "[&_.ProseMirror]:outline-none",
            "[&_.ProseMirror]:min-h-[inherit]",
            // Placeholder
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/60",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
          )}
        />
      ) : (
        <div 
          style={{ minHeight }} 
          className={cn(
            "rich-text-editor-surface rich-description-editor",
            "prose prose-sm max-w-none px-4 py-3"
          )}
        >
          {value && value !== "<p></p>" ? (
            <div 
              className="ProseMirror"
              dangerouslySetInnerHTML={{ __html: sanitizeRichContent(value) }}
            />
          ) : (
            <p className="text-muted-foreground/60 text-sm italic">
              Нет содержимого для предпросмотра
            </p>
          )}
        </div>
      )}

      {/* ── Footer: char count ───────────────────────────────────────────── */}
      {showCharCount && (
        <div className="px-4 py-1.5 border-t bg-muted/10 flex justify-end">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {charCount} символов
          </span>
        </div>
      )}
    </div>
  );
}
