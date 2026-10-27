"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2, X } from "lucide-react";
import type { ArticleLinkedItemKind } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArticleLinkedItemSnapshot } from "@/lib/article/articleAdminTypes";
import { COLLECTION_MIN_ITEMS, journalLinkedItemKey } from "@/lib/journal/publicationType";
import { useHydrated } from "@/hooks/use-hydrated";

const KIND_LABEL: Record<ArticleLinkedItemKind, string> = {
  EVENT: "Событие",
  OFFER: "Предложение",
  ARTICLE: "Публикация",
};

type SearchResult = { id: string; title: string; subtitle?: string };

/**
 * «Элементы подборки»: поиск по событиям / предложениям / публикациям через
 * существующий `/api/admin/content/entity-search` и drag-сортировка (dnd-kit).
 * Порядок массива = порядок на сайте.
 */
export function ArticleLinkedItemsEditor({
  items,
  onChange,
  articleId,
  required,
}: {
  items: ArticleLinkedItemSnapshot[];
  onChange: (items: ArticleLinkedItemSnapshot[]) => void;
  articleId: string | null;
  /** Подборка: показываем требование минимума. */
  required: boolean;
}) {
  const hydrated = useHydrated();
  const [kind, setKind] = useState<ArticleLinkedItemKind>("EVENT");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      fetch(`/api/admin/content/entity-search?q=${encodeURIComponent(query)}&type=${kind}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then((r) => r.json() as Promise<{ results?: SearchResult[] }>)
        .then((data) => setResults(data.results ?? []))
        .catch((e: unknown) => {
          if ((e as Error).name !== "AbortError") setResults([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, kind]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const keys = items.map(journalLinkedItemKey);
  const add = (r: SearchResult) => {
    const next = { kind, id: r.id, title: r.title };
    if (keys.includes(journalLinkedItemKey(next))) return;
    if (kind === "ARTICLE" && articleId && r.id === articleId) return;
    onChange([...items, next]);
    setQ("");
    setResults([]);
  };
  const remove = (key: string) => onChange(items.filter((item) => journalLinkedItemKey(item) !== key));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = keys.indexOf(String(active.id));
    const to = keys.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  };

  const short = required && items.length < COLLECTION_MIN_ITEMS;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label>Элементы подборки</Label>
        <span className={short ? "text-xs font-medium text-red-600" : "text-xs text-muted-foreground"}>
          {items.length}
          {required ? ` / мин. ${COLLECTION_MIN_ITEMS}` : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        События, предложения и другие публикации. Перетащите, чтобы изменить порядок — он сохраняется
        и показывается на сайте.
      </p>

      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
        {hydrated ? (
          <Select value={kind} onValueChange={(v) => { setKind(v as ArticleLinkedItemKind); setResults([]); }}>
            <SelectTrigger aria-label="Тип элемента">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABEL) as ArticleLinkedItemKind[]).map((k) => (
                <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="h-9 rounded-md border border-input bg-muted/40" aria-hidden />
        )}
        <div className="relative">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            placeholder="Поиск по названию (от 2 символов)"
            aria-label="Поиск элемента подборки"
          />
          {loading ? <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
          {q.trim().length >= 2 && results.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-white shadow-lg">
              {results.map((r) => {
                const taken = keys.includes(`${kind}:${r.id}`);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={taken}
                      onClick={() => add(r)}
                      className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <span className="font-medium text-gray-900">{r.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {taken ? "Уже в подборке" : r.subtitle ?? KIND_LABEL[kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      {items.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={keys} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {items.map((item, index) => (
                <SortableLinkedItem
                  key={journalLinkedItemKey(item)}
                  id={journalLinkedItemKey(item)}
                  index={index}
                  item={item}
                  onRemove={remove}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-muted-foreground">
          Пока пусто.
        </p>
      )}
      {short ? (
        <p className="text-xs text-red-600">
          В подборке должно быть минимум {COLLECTION_MIN_ITEMS} элемента — иначе её нельзя сохранить.
        </p>
      ) : null}
    </div>
  );
}

function SortableLinkedItem({
  id,
  index,
  item,
  onRemove,
}: {
  id: string;
  index: number;
  item: ArticleLinkedItemSnapshot;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5"
    >
      <button
        type="button"
        className="flex h-11 w-9 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        aria-label={`Переместить элемент ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {item.title ?? <span className="text-red-600">Объект недоступен</span>}
        </p>
        <p className="text-xs text-muted-foreground">{KIND_LABEL[item.kind]}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0"
        aria-label="Убрать из подборки"
        onClick={() => onRemove(id)}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}
