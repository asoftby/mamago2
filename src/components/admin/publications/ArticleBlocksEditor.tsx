"use client";

import { useCallback, useId, useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArticleBlockType,
  type ArticleBlock,
  type DynamicActivityFeedBlock,
} from "@/lib/publications/domain";

const BLOCK_OPTIONS: { value: ArticleBlockType; label: string }[] = [
  { value: ArticleBlockType.TITLE, label: "Заголовок" },
  { value: ArticleBlockType.INTRO, label: "Лид" },
  { value: ArticleBlockType.TEXT, label: "Текст" },
  { value: ArticleBlockType.QUOTE, label: "Цитата" },
  { value: ArticleBlockType.IMAGE, label: "Изображение" },
  { value: ArticleBlockType.GALLERY, label: "Галерея" },
  { value: ArticleBlockType.HTML, label: "HTML" },
  { value: ArticleBlockType.ACTIVITY_CARD, label: "Карточка активности" },
  { value: ArticleBlockType.DYNAMIC_ACTIVITY_FEED, label: "Лента активностей" },
];

function newBlock(type: ArticleBlockType): ArticleBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case ArticleBlockType.TITLE:
      return { id, type, text: "" };
    case ArticleBlockType.INTRO:
      return { id, type, text: "" };
    case ArticleBlockType.TEXT:
      return { id, type, markdown: "" };
    case ArticleBlockType.QUOTE:
      return { id, type, text: "" };
    case ArticleBlockType.IMAGE:
      return { id, type, alt: "", caption: "" };
    case ArticleBlockType.GALLERY:
      return { id, type, mediaIds: [] };
    case ArticleBlockType.HTML:
      return { id, type, html: "" };
    case ArticleBlockType.ACTIVITY_CARD:
      return { id, type, activityId: "" };
    case ArticleBlockType.DYNAMIC_ACTIVITY_FEED:
      return {
        id,
        type,
        mode: "dynamic",
        rules: {},
        pinnedActivityIds: [],
      };
    default:
      return { id, type: ArticleBlockType.TEXT, markdown: "" };
  }
}

function BlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: ArticleBlock;
  onChange: (b: ArticleBlock) => void;
  onRemove: () => void;
}) {
  const label = BLOCK_OPTIONS.find((o) => o.value === block.type)?.label ?? block.type;

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2 py-3 px-4 border-b border-gray-100">
        <GripVertical className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto h-8 w-8 text-gray-500"
          onClick={onRemove}
          aria-label="Удалить блок"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-4 space-y-3 text-sm">
        {block.type === ArticleBlockType.TITLE && (
          <div className="space-y-1">
            <Label>Текст</Label>
            <Input
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
            />
          </div>
        )}
        {block.type === ArticleBlockType.INTRO && (
          <div className="space-y-1">
            <Label>Лид</Label>
            <Textarea
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              rows={3}
            />
          </div>
        )}
        {block.type === ArticleBlockType.TEXT && (
          <div className="space-y-1">
            <Label>Markdown</Label>
            <Textarea
              value={block.markdown}
              onChange={(e) => onChange({ ...block, markdown: e.target.value })}
              rows={6}
              className="font-mono text-xs"
            />
          </div>
        )}
        {block.type === ArticleBlockType.QUOTE && (
          <>
            <div className="space-y-1">
              <Label>Цитата</Label>
              <Textarea
                value={block.text}
                onChange={(e) => onChange({ ...block, text: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Автор (опционально)</Label>
              <Input
                value={block.attribution ?? ""}
                onChange={(e) => onChange({ ...block, attribution: e.target.value })}
              />
            </div>
          </>
        )}
        {block.type === ArticleBlockType.IMAGE && (
          <>
            <div className="space-y-1">
              <Label>Media ID</Label>
              <Input
                value={block.mediaId ?? ""}
                onChange={(e) => onChange({ ...block, mediaId: e.target.value })}
                placeholder="из медиатеки"
              />
            </div>
            <div className="space-y-1">
              <Label>Alt</Label>
              <Input
                value={block.alt ?? ""}
                onChange={(e) => onChange({ ...block, alt: e.target.value })}
              />
            </div>
          </>
        )}
        {block.type === ArticleBlockType.GALLERY && (
          <div className="space-y-1">
            <Label>ID медиа (через запятую)</Label>
            <Input
              value={block.mediaIds.join(", ")}
              onChange={(e) =>
                onChange({
                  ...block,
                  mediaIds: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        )}
        {block.type === ArticleBlockType.HTML && (
          <div className="space-y-1">
            <Label>HTML</Label>
            <Textarea
              value={block.html}
              onChange={(e) => onChange({ ...block, html: e.target.value })}
              rows={5}
              className="font-mono text-xs"
            />
          </div>
        )}
        {block.type === ArticleBlockType.ACTIVITY_CARD && (
          <div className="space-y-1">
            <Label>ID активности</Label>
            <Input
              value={block.activityId}
              onChange={(e) => onChange({ ...block, activityId: e.target.value })}
            />
          </div>
        )}
        {block.type === ArticleBlockType.DYNAMIC_ACTIVITY_FEED && (
          <DynamicFeedBlockFields block={block} onChange={onChange} />
        )}
      </CardContent>
    </Card>
  );
}

function DynamicFeedBlockFields({
  block,
  onChange,
}: {
  block: DynamicActivityFeedBlock;
  onChange: (b: ArticleBlock) => void;
}) {
  const rules = block.rules ?? {};
  return (
    <div className="space-y-4">
      <Tabs
        value={block.mode}
        onValueChange={(v) =>
          onChange({ ...block, mode: v as "static" | "dynamic" })
        }
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="static">Вручную</TabsTrigger>
          <TabsTrigger value="dynamic">Правила</TabsTrigger>
        </TabsList>
        <TabsContent value="static" className="space-y-2 pt-3">
          <Label>ID активностей (через запятую)</Label>
          <Input
            value={(block.pinnedActivityIds ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...block,
                pinnedActivityIds: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
          <p className="text-xs text-gray-500">
            Вставной блок в теле статьи: выбор конкретных карточек.
          </p>
        </TabsContent>
        <TabsContent value="dynamic" className="space-y-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Город (ID)</Label>
              <Input
                value={rules.cityId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    rules: { ...rules, cityId: e.target.value || undefined },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Тип сущности</Label>
              <Select
                value={rules.entityType ?? "any"}
                onValueChange={(v) =>
                  onChange({
                    ...block,
                    rules: {
                      ...rules,
                      entityType:
                        v === "any"
                          ? undefined
                          : (v as NonNullable<typeof rules.entityType>),
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Любой" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Любой</SelectItem>
                  <SelectItem value="EVENT">Событие</SelectItem>
                  <SelectItem value="PLACE">Место</SelectItem>
                  <SelectItem value="OFFER">Предложение</SelectItem>
                  <SelectItem value="ROUTE">Маршрут</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Дата с</Label>
              <Input
                type="date"
                value={rules.dateFrom ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    rules: { ...rules, dateFrom: e.target.value || undefined },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Дата по</Label>
              <Input
                type="date"
                value={rules.dateTo ?? ""}
                onChange={(e) =>
                  onChange({
                    ...block,
                    rules: { ...rules, dateTo: e.target.value || undefined },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Сортировка</Label>
              <Select
                value={rules.sortPreset ?? "newest"}
                onValueChange={(v) =>
                  onChange({
                    ...block,
                    rules: {
                      ...rules,
                      sortPreset: v as NonNullable<typeof rules.sortPreset>,
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Релевантность</SelectItem>
                  <SelectItem value="newest">Сначала новые</SelectItem>
                  <SelectItem value="popular">Популярность</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Категории, теги, поводы, возраст, indoor/outdoor — подключим на следующем этапе.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ArticleBlocksEditor() {
  const [blocks, setBlocks] = useState<ArticleBlock[]>([]);
  const [addType, setAddType] = useState<ArticleBlockType>(ArticleBlockType.TEXT);
  const addId = useId();

  const addBlock = useCallback(() => {
    setBlocks((prev) => [...prev, newBlock(addType)]);
  }, [addType]);

  const updateBlock = useCallback((i: number, b: ArticleBlock) => {
    setBlocks((prev) => {
      const next = [...prev];
      next[i] = b;
      return next;
    });
  }, []);

  const removeBlock = useCallback((i: number) => {
    setBlocks((prev) => prev.filter((_, j) => j !== i));
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Блоки</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Базовая структура; полноценный билдер — позже.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={addType}
            onValueChange={(v) => setAddType(v as ArticleBlockType)}
          >
            <SelectTrigger className="w-[220px]" id={addId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="secondary" size="sm" onClick={addBlock}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить блок
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {blocks.length === 0 ? (
          <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-6 text-center">
            Блоков пока нет — выберите тип и нажмите «Добавить блок».
          </p>
        ) : (
          blocks.map((block, i) => (
            <BlockEditor
              key={block.id}
              block={block}
              onChange={(b) => updateBlock(i, b)}
              onRemove={() => removeBlock(i)}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function ArticleTocToggle() {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">Оглавление</p>
        <p className="text-xs text-gray-500">Липкое оглавление по заголовкам</p>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}
