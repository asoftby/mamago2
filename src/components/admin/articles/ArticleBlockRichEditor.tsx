"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Redo, Undo } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  articleBlockHtmlForEditor,
  sanitizeArticleBlockHtml,
  type ArticleBlockHtmlVariant,
} from "@/lib/article/articleBlockHtml";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArticleBodyLink } from "@/lib/article/articleBodyLinkExtension";

export type ArticleBlockRichEditorVariant = ArticleBlockHtmlVariant;

interface ArticleBlockRichEditorProps {
  variant: ArticleBlockRichEditorVariant;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeightClass?: string;
}

function buildExtensions(variant: ArticleBlockRichEditorVariant, placeholder: string) {
  const placeholderExt = Placeholder.configure({ placeholder });

  if (variant === "intro") {
    return [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        link: false,
        paragraph: {},
      }),
      placeholderExt,
    ];
  }

  if (variant === "quote") {
    return [
      StarterKit.configure({
        bold: false,
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        link: false,
        paragraph: {},
      }),
      placeholderExt,
    ];
  }

  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      strike: false,
      underline: false,
      link: false,
      paragraph: {},
    }),
    ArticleBodyLink.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: (url, ctx) => {
        const u = (url ?? "").trim();
        if (!u) return false;
        if (u.startsWith("/") || u.startsWith("./") || u.startsWith("../")) return true;
        return ctx.defaultValidate(u);
      },
      HTMLAttributes: {
        class: "text-primary underline underline-offset-2 decoration-primary/50",
      },
    }),
    placeholderExt,
  ];
}

/** Подсказка для TipTap: https, относительные пути, mailto при вводе email */
function normalizeLinkHref(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("/") || t.startsWith("./") || t.startsWith("../")) return t;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
  if (t.includes(".") && !/\s/.test(t)) return `https://${t}`;
  return t;
}

export function ArticleBlockRichEditor({
  variant,
  value,
  onChange,
  placeholder = "Текст…",
  disabled = false,
  minHeightClass = "min-h-[160px]",
}: ArticleBlockRichEditorProps) {
  const extensions = useMemo(
    () => buildExtensions(variant, placeholder),
    [variant, placeholder],
  );

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions,
    content: articleBlockHtmlForEditor(value ?? "", variant),
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      onChange(sanitizeArticleBlockHtml(ed.getHTML(), variant));
    },
  });

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkHrefDraft, setLinkHrefDraft] = useState("");
  const [linkSponsored, setLinkSponsored] = useState(false);
  const [linkLabelPreview, setLinkLabelPreview] = useState("");
  const linkRangeRef = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const next = articleBlockHtmlForEditor(value ?? "", variant);
    const cur = sanitizeArticleBlockHtml(editor.getHTML(), variant);
    if (next === cur) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [value, variant, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [disabled, editor]);

  const handleLinkOpenChange = useCallback(
    (open: boolean) => {
      if (open && editor) {
        if (editor.state.selection.empty && editor.isActive("link")) {
          editor.chain().focus().extendMarkRange("link").run();
        }
        const { from, to } = editor.state.selection;
        linkRangeRef.current = { from, to };
        const attrs = editor.getAttributes("link");
        setLinkHrefDraft(String(attrs.href ?? ""));
        setLinkSponsored(Boolean(attrs.sponsored));
        setLinkLabelPreview(editor.state.doc.textBetween(from, to, "\n"));
      }
      if (!open) {
        linkRangeRef.current = null;
      }
      setLinkOpen(open);
    },
    [editor],
  );

  const applyLink = useCallback(() => {
    if (!editor) return;
    const range = linkRangeRef.current;
    if (!range) {
      toast.error("Не удалось применить ссылку — выделите текст ещё раз.");
      setLinkOpen(false);
      return;
    }
    const trimmed = linkHrefDraft.trim();
    if (trimmed === "") {
      editor
        .chain()
        .focus()
        .setTextSelection(range)
        .extendMarkRange("link")
        .unsetLink()
        .run();
      setLinkOpen(false);
      return;
    }
    const href = normalizeLinkHref(trimmed);
    const ok = editor
      .chain()
      .focus()
      .setTextSelection(range)
      .setMark("link", { href, sponsored: linkSponsored })
      .run();
    if (!ok) {
      toast.error("Некорректный адрес ссылки. Используйте https://… или путь вида /blog/…");
      return;
    }
    setLinkOpen(false);
  }, [editor, linkHrefDraft, linkSponsored]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    const range = linkRangeRef.current;
    if (!range) {
      setLinkOpen(false);
      return;
    }
    editor.chain().focus().setTextSelection(range).extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }, [editor]);

  if (!editor) return null;

  const showLists = variant === "text";
  const showLink = variant === "text";

  const proseMirrorMin = minHeightClass.replace(/^min-h-/, "[&_.ProseMirror]:min-h-");

  return (
    <div
      className={cn(
        /* без overflow-hidden: иначе list-style-position:outside обрезается и не видны точки/цифры */
        "border rounded-md",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="border-b bg-muted/30 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
        {variant !== "quote" ? (
          <ToolbarIcon
            title="Жирный"
            disabled={disabled}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="w-4 h-4" />
          </ToolbarIcon>
        ) : null}
        <ToolbarIcon
          title="Курсив"
          disabled={disabled}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-4 h-4" />
        </ToolbarIcon>

        {showLists ? (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarIcon
              title="Маркированный список"
              disabled={disabled}
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="w-4 h-4" />
            </ToolbarIcon>
            <ToolbarIcon
              title="Нумерованный список"
              disabled={disabled}
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="w-4 h-4" />
            </ToolbarIcon>
          </>
        ) : null}

        {showLink ? (
          <>
            <div className="w-px h-5 bg-border mx-1" />
            <Popover open={linkOpen} onOpenChange={handleLinkOpenChange}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  title="Ссылка"
                  onMouseDown={(e) => e.preventDefault()}
                  className={cn(
                    "p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30",
                    editor.isActive("link") && "bg-muted",
                  )}
                >
                  <Link2 className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(100vw-2rem,22rem)] p-3">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="article-block-link-href">Адрес ссылки</Label>
                    <Input
                      id="article-block-link-href"
                      value={linkHrefDraft}
                      onChange={(e) => setLinkHrefDraft(e.target.value)}
                      placeholder="https://… или /blog/…"
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyLink();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="article-block-link-label">Текст ссылки</Label>
                    <Input
                      id="article-block-link-label"
                      readOnly
                      value={linkLabelPreview}
                      placeholder="Выделите текст в редакторе"
                      className="bg-muted/40 text-muted-foreground"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 rounded-md border border-border/50 bg-muted/15 px-2.5 py-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="article-block-link-sponsored"
                        checked={linkSponsored}
                        onCheckedChange={(c) => setLinkSponsored(c === true)}
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor="article-block-link-sponsored"
                          className="block font-normal leading-tight cursor-pointer"
                        >
                          Рекламная ссылка
                        </Label>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" onClick={applyLink}>
                      Готово
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={removeLink}>
                      Снять ссылку
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Оставьте поле пустым и нажмите «Готово», чтобы снять ссылку с выделения.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </>
        ) : null}

        <div className="w-px h-5 bg-border mx-1" />
        <ToolbarIcon
          title="Отменить"
          disabled={disabled || !editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="w-4 h-4" />
        </ToolbarIcon>
        <ToolbarIcon
          title="Повторить"
          disabled={disabled || !editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="w-4 h-4" />
        </ToolbarIcon>
      </div>

      <EditorContent
        editor={editor}
        className={cn(
          "rich-text-editor-surface prose prose-sm max-w-none p-3 text-sm focus:outline-none",
          minHeightClass,
          proseMirrorMin,
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
        )}
      />
    </div>
  );
}

function ToolbarIcon({
  title,
  disabled,
  active,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30",
        active && "bg-muted",
      )}
    >
      {children}
    </button>
  );
}
