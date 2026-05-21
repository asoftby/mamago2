"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArticleBlockRichEditor } from "@/components/admin/articles/ArticleBlockRichEditor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type ArticleBlockMvp, newBlock } from "@/lib/publications/articleMvp";
import { resolveArticleEmbed } from "@/lib/article/articleEmbedSanitize";
import { ArticleEditorCoverField } from "@/components/admin/articles/ArticleEditorCoverField";
import { ActivityCardEntityPicker } from "@/components/admin/articles/ActivityCardEntityPicker";
import { ArticleEditorGalleryField } from "@/components/admin/articles/ArticleEditorGalleryField";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

/** Короткие подписи в шапке блока */
const BLOCK_LABEL: Record<ArticleBlockMvp["type"], string> = {
  intro: "Лид",
  text: "Текст",
  quote: "Цитата",
  heading: "Заголовок",
  image: "Изображение",
  gallery: "Галерея",
  activityCard: "Карточка сущности",
  embed: "Вставка",
};

/** Пункты picker: один intro на статью — в список попадает только если лида ещё нет. */
const PICKER_ITEMS: { type: ArticleBlockMvp["type"]; label: string; introOnly?: boolean }[] = [
  { type: "intro", label: "Вступление", introOnly: true },
  { type: "text", label: "Текст" },
  { type: "heading", label: "Заголовок" },
  { type: "quote", label: "Цитата" },
  { type: "image", label: "Изображение" },
  { type: "gallery", label: "Галерея" },
  { type: "activityCard", label: "Карточка активности" },
  { type: "embed", label: "Вставка" },
];

function SelectSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground animate-pulse",
        className,
      )}
      aria-hidden
    >
      …
    </div>
  );
}

function BlockTypePicker({
  hasIntro,
  onPick,
  triggerClassName,
  size = "sm",
  variant = "outline",
  children,
}: {
  hasIntro: boolean;
  onPick: (type: ArticleBlockMvp["type"]) => void;
  triggerClassName?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "secondary";
  /** Кастомный триггер (например широкая плашка внизу). Иначе — стандартная кнопка. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () =>
      PICKER_ITEMS.filter((item) => {
        if (item.introOnly && hasIntro) return false;
        return true;
      }),
    [hasIntro],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            type="button"
            variant={variant}
            size={size}
            className={cn("gap-1.5 font-normal", triggerClassName)}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Добавить блок
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,16rem)] p-1" align="center" sideOffset={6}>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              key={item.type}
              type="button"
              className="rounded-md px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => {
                onPick(item.type);
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EmbedBlockEditor({
  embedHtml,
  caption,
  onChangeEmbedHtml,
  onChangeCaption,
}: {
  embedHtml: string;
  caption: string;
  onChangeEmbedHtml: (v: string) => void;
  onChangeCaption: (v: string) => void;
}) {
  const resolved = useMemo(() => resolveArticleEmbed(embedHtml), [embedHtml]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="embed-code">Код вставки</Label>
        <Textarea
          id="embed-code"
          rows={5}
          placeholder="Код iframe YouTube / Instagram или блок Instagram"
          value={embedHtml}
          onChange={(e) => onChangeEmbedHtml(e.target.value)}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Вставьте код встраивания YouTube или Instagram
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="embed-caption">Подпись</Label>
        <Input
          id="embed-caption"
          placeholder="Опционально"
          value={caption}
          onChange={(e) => onChangeCaption(e.target.value)}
        />
      </div>
      <div className="rounded-lg border border-border/70 bg-muted/25 p-3 text-xs">
        {resolved.sanitizedHtml ? (
          <>
            <p className="text-muted-foreground mb-2">Предпросмотр</p>
            <div
              className="max-w-full overflow-hidden [&_iframe]:max-w-full"
              dangerouslySetInnerHTML={{ __html: resolved.sanitizedHtml }}
            />
            {resolved.requiresInstagramScript ? (
              <p className="mt-2 text-amber-900/90">
                Для этого блока на странице статьи подключается официальный скрипт Instagram (без произвольного
                кода из редактора).
              </p>
            ) : null}
          </>
        ) : embedHtml.trim() ? (
          <p className="text-amber-800">
            Не удалось распознать код. Поддерживаются iframe YouTube, iframe Instagram или официальный блок
            Instagram (blockquote).
          </p>
        ) : (
          <p className="text-muted-foreground">
            Предпросмотр появится после вставки кода — на сайте и в черновике используется тот же безопасный
            рендер.
          </p>
        )}
      </div>
    </div>
  );
}

export function ArticleBlocksMvpEditor({
  blocks,
  onChange,
}: {
  blocks: ArticleBlockMvp[];
  onChange: (next: ArticleBlockMvp[]) => void;
}) {
  const hydrated = useHydrated();

  const hasIntro = useMemo(() => blocks.some((b) => b.type === "intro"), [blocks]);

  const insertAt = useCallback(
    (index: number, type: ArticleBlockMvp["type"]) => {
      if (type === "intro" && blocks.some((b) => b.type === "intro")) return;
      const next = [...blocks];
      next.splice(index, 0, newBlock(type));
      onChange(next);
    },
    [blocks, onChange],
  );

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const updateAt = (i: number, b: ArticleBlockMvp) => {
    const next = [...blocks];
    next[i] = b;
    onChange(next);
  };

  const removeAt = (i: number) => {
    onChange(blocks.filter((_, k) => k !== i));
  };

  const renderBlockBody = (block: ArticleBlockMvp, i: number) => (
    <>
      {block.type === "intro" && (
        <ArticleBlockRichEditor
          key={`${block.id}-intro`}
          variant="intro"
          value={block.text}
          onChange={(html) => updateAt(i, { ...block, text: html })}
          placeholder="Краткий лид для превью и начала статьи"
          minHeightClass="min-h-[120px]"
        />
      )}
      {block.type === "text" && (
        <ArticleBlockRichEditor
          key={`${block.id}-text`}
          variant="text"
          value={block.text}
          onChange={(html) => updateAt(i, { ...block, text: html })}
          placeholder="Текст абзаца"
          minHeightClass="min-h-[200px]"
        />
      )}
      {block.type === "quote" && (
        <>
          <ArticleBlockRichEditor
            key={`${block.id}-quote`}
            variant="quote"
            value={block.text}
            onChange={(html) => updateAt(i, { ...block, text: html })}
            placeholder="Текст цитаты"
            minHeightClass="min-h-[120px]"
          />
          <Input
            placeholder="Автор (опционально)"
            value={block.attribution ?? ""}
            onChange={(e) =>
              updateAt(i, { ...block, attribution: e.target.value || undefined })
            }
          />
        </>
      )}
      {block.type === "heading" && (
        <div className="space-y-2">
          <div className="space-y-1 max-w-[200px]">
            <Label className="text-xs text-muted-foreground">Уровень</Label>
            {hydrated ? (
              <Select
                value={String(block.level)}
                onValueChange={(v) =>
                  updateAt(i, { ...block, level: Number(v) === 3 ? 3 : 2 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <SelectSkeleton className="w-full" />
            )}
          </div>
          <Input
            placeholder="Текст заголовка"
            value={block.text}
            onChange={(e) => updateAt(i, { ...block, text: e.target.value })}
          />
        </div>
      )}
      {block.type === "image" && (
        <>
          <ArticleEditorCoverField
            showHeading={false}
            value={block.mediaId}
            uploadButtonLabel="Загрузить изображение"
            successUploadMessage="Изображение загружено"
            successPickMessage="Изображение выбрано"
            onChange={(mediaId) => updateAt(i, { ...block, mediaId })}
          />
          <Input
            placeholder="Alt"
            value={block.alt ?? ""}
            onChange={(e) => updateAt(i, { ...block, alt: e.target.value })}
          />
          <Input
            placeholder="Подпись"
            value={block.caption ?? ""}
            onChange={(e) => updateAt(i, { ...block, caption: e.target.value })}
          />
        </>
      )}
      {block.type === "gallery" && (
        <>
          <ArticleEditorGalleryField
            showHeading={false}
            value={block.mediaIds}
            onChange={(ids) => updateAt(i, { ...block, mediaIds: ids })}
          />
          <Input
            placeholder="Подпись к галерее (опционально)"
            value={block.caption ?? ""}
            onChange={(e) => updateAt(i, { ...block, caption: e.target.value })}
          />
        </>
      )}
      {block.type === "activityCard" && (
        <ActivityCardEntityPicker
          entityType={block.entityType}
          entityId={block.entityId}
          onChangeType={(t) => updateAt(i, { ...block, entityType: t, entityId: "" })}
          onChangeId={(id) => updateAt(i, { ...block, entityId: id })}
        />
      )}
      {block.type === "embed" && (
        <EmbedBlockEditor
          embedHtml={block.embedHtml}
          caption={block.caption ?? ""}
          onChangeEmbedHtml={(embedHtml) => updateAt(i, { ...block, embedHtml })}
          onChangeCaption={(caption) =>
            updateAt(i, { ...block, caption: caption || undefined })
          }
        />
      )}
    </>
  );

  return (
    <div className="space-y-1">
      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">Пока нет блоков — добавьте первый.</p>
          <BlockTypePicker
            hasIntro={hasIntro}
            onPick={(type) => insertAt(0, type)}
            size="default"
            variant="secondary"
            triggerClassName="mx-auto"
          />
        </div>
      ) : (
        <>
          {blocks.map((block, i) => (
            <div key={block.id}>
              <Card
                className={cn(
                  "border-border/60 shadow-none transition-colors",
                  block.type === "intro" && "border-primary/25 bg-primary/[0.03]",
                )}
              >
                <div className="flex flex-row items-center gap-2 border-b border-border/50 px-3 py-2 sm:px-4">
                  <span
                    className={cn(
                      "text-xs font-medium tracking-tight",
                      block.type === "intro"
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {BLOCK_LABEL[block.type]}
                    {block.type === "intro" ? (
                      <span className="ml-1.5 font-normal text-muted-foreground">· начало статьи</span>
                    ) : null}
                  </span>
                  <div className="ml-auto flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Выше"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      aria-label="Ниже"
                      onClick={() => move(i, 1)}
                      disabled={i === blocks.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label="Удалить"
                      onClick={() => removeAt(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="space-y-3 pt-4 pb-4 text-sm">{renderBlockBody(block, i)}</CardContent>
              </Card>

              {i < blocks.length - 1 ? (
                <div className="relative flex justify-center py-2">
                  <div
                    className="pointer-events-none absolute inset-x-8 top-1/2 border-t border-dashed border-border/80"
                    aria-hidden
                  />
                  <div className="relative bg-background px-2">
                    <BlockTypePicker
                      hasIntro={hasIntro}
                      onPick={(type) => insertAt(i + 1, type)}
                      variant="ghost"
                      size="sm"
                      triggerClassName="text-muted-foreground hover:text-foreground h-8 text-xs"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </>
      )}

      {blocks.length > 0 ? (
        <BlockTypePicker
          hasIntro={hasIntro}
          onPick={(type) => insertAt(blocks.length, type)}
        >
          <button
            type="button"
            className="group w-full rounded-xl border-2 border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center transition-colors hover:border-primary/35 hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="flex flex-col items-center gap-1">
              <span className="text-sm font-medium text-foreground group-hover:text-primary">
                + Добавить блок
              </span>
              <span className="text-xs text-muted-foreground max-w-sm">
                Текст, заголовок, цитата, медиа, галерея, вставка или карточка
              </span>
            </span>
          </button>
        </BlockTypePicker>
      ) : null}
    </div>
  );
}
