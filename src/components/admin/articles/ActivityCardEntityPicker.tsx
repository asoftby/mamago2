"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { QuickPlaceCreate } from "@/components/business/wizard/event/steps/location/QuickPlaceCreate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ArticleBlockEntityType } from "@/lib/publications/articleMvp";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";

type EntityPreviewPayload = {
  entityType: ArticleBlockEntityType;
  title: string;
  city: string | null;
  placeName?: string | null;
  address?: string | null;
  publicAvailable?: boolean;
};

type SearchResult = {
  id: string;
  type: ArticleBlockEntityType;
  title: string;
  subtitle?: string;
  slug?: string;
};

const ENTITY_LABELS: Record<ArticleBlockEntityType, string> = {
  PLACE: "PLACE — место",
  EVENT: "EVENT — событие",
  OFFER: "OFFER — предложение",
  ROUTE: "ROUTE — маршрут",
  ARTICLE: "ARTICLE — статья",
};

const CREATE_LABELS: Partial<Record<ArticleBlockEntityType, string>> = {
  PLACE: "Создать новое место",
};

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

/** Тот же UI, что у блока «Карточка сущности» в редакторе статьи: тип, ID, поиск, превью. */
export function ActivityCardEntityPicker({
  entityType,
  entityId,
  onChangeType,
  onChangeId,
}: {
  entityType: ArticleBlockEntityType;
  entityId: string;
  onChangeType: (t: ArticleBlockEntityType) => void;
  onChangeId: (id: string) => void;
}) {
  const hydrated = useHydrated();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [preview, setPreview] = useState<EntityPreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(!entityId.trim());
  const [showCreatePlace, setShowCreatePlace] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Reset search state when entity type changes
  useEffect(() => {
    setQ("");
    setResults([]);
    setShowDropdown(false);
    setNoResults(false);
    setShowCreatePlace(false);
  }, [entityType]);

  // Fetch preview when entityId/entityType changes
  useEffect(() => {
    if (!entityId.trim()) {
      setPreview(null);
      setReplaceOpen(true);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    fetch(
      `/api/admin/content/entity-preview?type=${entityType}&id=${encodeURIComponent(entityId.trim())}`,
    )
      .then((r) => r.json())
      .then((data: { preview: EntityPreviewPayload | null }) => {
        if (!cancelled) setPreview(data.preview ?? null);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  // Live debounced search
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      setNoResults(false);
      return;
    }

    const timer = setTimeout(() => {
      runSearch(q, entityType);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, entityType]);

  const runSearch = useCallback(
    async (query: string, type: ArticleBlockEntityType) => {
      if (query.trim().length < 2) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setShowDropdown(true);
      setNoResults(false);

      try {
        const res = await fetch(
          `/api/admin/content/entity-search?q=${encodeURIComponent(query.trim())}&type=${type}`,
          { credentials: "include", signal: abortRef.current.signal },
        );
        const data = await res.json();
        const found: SearchResult[] = data.results ?? [];
        setResults(found);
        setNoResults(found.length === 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
          setNoResults(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSearchButtonClick = () => {
    if (q.trim().length >= 2) {
      // Cancel debounce and run immediately
      abortRef.current?.abort();
      runSearch(q, entityType);
    }
  };

  const handleSelectResult = (r: SearchResult) => {
    onChangeId(r.id);
    setResults([]);
    setShowDropdown(false);
    setQ("");
    setReplaceOpen(false);
  };

  return (
    <div className="space-y-3">
      {entityId.trim() && !replaceOpen ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[10px] tracking-tight">
              {entityType}
            </Badge>
            {previewLoading ? (
              <span className="text-xs text-muted-foreground">Загрузка…</span>
            ) : null}
          </div>
          {preview ? (
            <>
              <p className="font-medium text-gray-900 leading-snug">{preview.title}</p>
              {entityType === "PLACE" && preview.publicAvailable === false ? (
                <p role="alert" className="text-xs font-medium text-amber-800">Место недоступно</p>
              ) : null}
              {(preview.placeName || preview.city || preview.address) ? (
                <p className="text-xs text-muted-foreground">
                  {[preview.placeName, preview.city, preview.address]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : (
                <p className="text-xs text-gray-400">Город не указан</p>
              )}
            </>
          ) : !previewLoading ? (
            <p className="text-xs text-amber-800">
              Сущность не найдена по ID — проверьте тип и идентификатор.
            </p>
          ) : null}
          <p className="font-mono text-[10px] text-gray-500 break-all">id: {entityId.trim()}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setReplaceOpen(true)}>
            Заменить сущность
          </Button>
        </div>
      ) : null}

      {replaceOpen || !entityId.trim() ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Тип сущности</Label>
              {hydrated ? (
                <Select
                  value={entityType}
                  onValueChange={(v) => {
                    onChangeType(v as ArticleBlockEntityType);
                    setPreview(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ENTITY_LABELS) as ArticleBlockEntityType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {ENTITY_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <SelectSkeleton />
              )}
            </div>
            <div className="space-y-1">
              <Label>ID (вручную)</Label>
              <Input
                value={entityId}
                onChange={(e) => onChangeId(e.target.value)}
                onBlur={() => {
                  // Preview will refresh via the useEffect on entityId
                }}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Search input with live dropdown */}
          <div ref={dropdownRef} className="relative">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск по названию…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchButtonClick();
                  }
                  if (e.key === "Escape") {
                    setShowDropdown(false);
                  }
                }}
                onFocus={() => {
                  if (results.length > 0) setShowDropdown(true);
                }}
                autoComplete="off"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleSearchButtonClick}
                disabled={loading}
              >
                Найти
              </Button>
            </div>

            {showDropdown ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm">
                {loading ? (
                  <div className="px-3 py-2.5 text-muted-foreground">Ищем…</div>
                ) : noResults ? (
                  <div className="px-3 py-2.5 text-muted-foreground">Ничего не найдено</div>
                ) : (
                  <ul>
                    {results.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
                          onMouseDown={(e) => {
                            // prevent input blur before click registers
                            e.preventDefault();
                            handleSelectResult(r);
                          }}
                        >
                          <span className="font-medium text-gray-900">{r.title}</span>
                          {r.subtitle ? (
                            <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>
                          ) : null}
                          <span className="ml-2 font-mono text-[10px] text-gray-400">{r.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {entityType === "PLACE" && !showCreatePlace ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Не нашли место в списке? Создайте новое — оно появится в общей базе и сразу
                привяжется к блоку.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowCreatePlace(true)}
              >
                {CREATE_LABELS[entityType] ?? `Создать новый элемент`}
              </Button>
            </div>
          ) : null}

          {entityType === "PLACE" && showCreatePlace ? (
            <QuickPlaceCreate
              embedded
              mapLayout="inline"
              placeCreateSource="article_editor"
              initialName={q.trim()}
              onCancel={() => setShowCreatePlace(false)}
              onPlaceCreated={(place) => {
                if (place.id) onChangeId(place.id);
                setShowCreatePlace(false);
                setResults([]);
                setShowDropdown(false);
                setReplaceOpen(false);
                setQ("");
                toast.success(`Место «${place.title}» создано и выбрано`);
              }}
            />
          ) : null}

          {entityId.trim() ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplaceOpen(false)}>
              Готово
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
