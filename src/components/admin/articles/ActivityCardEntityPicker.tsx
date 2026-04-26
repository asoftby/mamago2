"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [preview, setPreview] = useState<EntityPreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(!entityId.trim());
  const [showCreatePlace, setShowCreatePlace] = useState(false);

  useEffect(() => {
    setShowCreatePlace(false);
  }, [entityType]);

  useEffect(() => {
    if (!entityId.trim()) {
      setPreview(null);
      setReplaceOpen(true);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/admin/content/entity-preview?type=${entityType}&id=${encodeURIComponent(entityId.trim())}`)
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

  const search = useCallback(async () => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/content/entity-search?q=${encodeURIComponent(q.trim())}&type=${entityType}`,
        { credentials: "include" },
      );
      const data = await res.json();
      setResults(data.results || []);
    } finally {
      setLoading(false);
    }
  }, [q, entityType]);

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
              {preview.city ? (
                <p className="text-xs text-muted-foreground">{preview.city}</p>
              ) : (
                <p className="text-xs text-gray-400">Город не указан</p>
              )}
            </>
          ) : !previewLoading ? (
            <p className="text-xs text-amber-800">Сущность не найдена по ID — проверьте тип и идентификатор.</p>
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
                    onChangeId("");
                    setPreview(null);
                    setShowCreatePlace(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EVENT">EVENT — событие</SelectItem>
                    <SelectItem value="PLACE">PLACE — место</SelectItem>
                    <SelectItem value="OFFER">OFFER — предложение</SelectItem>
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
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию…"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
            />
            <Button type="button" variant="secondary" onClick={search} disabled={loading}>
              Найти
            </Button>
          </div>
          {results.length > 0 ? (
            <ul className="max-h-40 overflow-auto rounded-md border border-gray-200 bg-white text-sm">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => {
                      onChangeId(r.id);
                      setResults([]);
                      setReplaceOpen(false);
                    }}
                  >
                    <span className="font-medium text-gray-900">{r.title}</span>
                    <span className="ml-2 font-mono text-xs text-gray-500">{r.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {entityType === "PLACE" && !showCreatePlace ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Не нашли место в списке? Создайте новое — оно появится в общей базе и сразу привяжется к блоку.
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreatePlace(true)}>
                Создать новое место
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
