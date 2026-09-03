"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  extractArticleMediaUsage,
  type ArticleBlockMvp,
  type ArticleMediaUsageKind,
} from "@/lib/publications/articleMvp";
import type { ArticleMediaItem } from "@/lib/article/articleMediaLibrary";

export type ArticleMediaLibraryItem = {
  id: string;
  url: string;
  alt: string | null;
  title: string | null;
  usage: ArticleMediaUsageKind[];
};

type MediaPreviewResponse = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
};

const ARTICLE_MEDIA_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveMediaPreview(mediaId: string): Promise<MediaPreviewResponse | null> {
  try {
    const res = await fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(mediaId)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as MediaPreviewResponse;
  } catch {
    return null;
  }
}

/**
 * «Фото этой статьи» для media picker'а: единый источник для persisted и
 * ещё не сохранённой (draft) статьи.
 * - Persisted (articleId есть) → GET /api/admin/articles/[id]/media — сервер
 *   сам агрегирует cover/seo/блоки по актуальному сохранённому contentJson.
 * - Unsaved (articleId=null) → извлекаем id прямо из текущего editor state
 *   через extractArticleMediaUsage (тот же helper, что использует сервер) и
 *   резолвим превью поштучно через уже существующий media-preview endpoint —
 *   тем же способом, каким ArticleEditorCoverField/ArticleEditorGalleryField
 *   уже резолвят превью для id из contentJson.
 *
 * Повторное открытие picker'а с тем же live editor state в течение TTL не
 * повторяет чтения БД. Изменение cover/blocks меняет ключ снимка и автоматически
 * заставляет следующий open получить актуальный набор.
 */
export function useArticleMediaSource(params: {
  articleId: string | null;
  coverImageId: string;
  blocks: ArticleBlockMvp[];
}) {
  const { articleId, coverImageId, blocks } = params;
  const [items, setItems] = useState<ArticleMediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedAtRef = useRef(0);
  const inFlightKeyRef = useRef<string | null>(null);
  const liveUsage = useMemo(() => extractArticleMediaUsage({ coverImageId, blocks }), [coverImageId, blocks]);
  const usedIds = useMemo(() => new Set(liveUsage.map((entry) => entry.mediaId)), [liveUsage]);
  const liveUsageKey = useMemo(
    () => liveUsage.map((entry) => `${entry.mediaId}:${entry.usage.join(",")}`).join("|"),
    [liveUsage],
  );
  const snapshotKey = `${articleId ?? "draft"}::${liveUsageKey}`;
  const loaded = loadedKey === snapshotKey;

  const load = useCallback(async () => {
    const now = Date.now();
    if (
      loadedKey === snapshotKey &&
      loadedAtRef.current > 0 &&
      now - loadedAtRef.current < ARTICLE_MEDIA_CLIENT_CACHE_TTL_MS
    ) {
      return;
    }
    if (inFlightKeyRef.current === snapshotKey) return;

    const requestId = ++requestIdRef.current;
    const hasSnapshotForKey = loadedKey === snapshotKey;
    inFlightKeyRef.current = snapshotKey;
    if (!hasSnapshotForKey) setLoading(true);

    try {
      let nextItems: ArticleMediaLibraryItem[];

      if (articleId) {
        const res = await fetch(`/api/admin/articles/${encodeURIComponent(articleId)}/media`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Не удалось загрузить изображения статьи");
        const data = (await res.json()) as { items: ArticleMediaItem[] };
        if (requestId !== requestIdRef.current) return;

        const persisted = data.items.map((item) => ({
          id: item.id,
          url: item.publicUrl,
          alt: item.alt,
          title: item.title,
          usage: item.usage,
        }));
        const persistedIds = new Set(persisted.map((item) => item.id));
        const draftOnly = await Promise.all(
          liveUsage
            .filter((entry) => !persistedIds.has(entry.mediaId))
            .map(async (entry) => {
              const asset = await resolveMediaPreview(entry.mediaId);
              return asset?.publicUrl
                ? {
                    id: asset.id,
                    url: asset.publicUrl,
                    alt: asset.alt,
                    title: asset.title,
                    usage: entry.usage,
                  }
                : null;
            }),
        );
        if (requestId !== requestIdRef.current) return;
        nextItems = [
          ...persisted,
          ...draftOnly.filter((item): item is ArticleMediaLibraryItem => item !== null),
        ];
      } else {
        const resolved = await Promise.all(
          liveUsage.map(async (entry) => {
            const asset = await resolveMediaPreview(entry.mediaId);
            if (!asset?.publicUrl) return null;
            const item: ArticleMediaLibraryItem = {
              id: asset.id,
              url: asset.publicUrl,
              alt: asset.alt,
              title: asset.title,
              usage: entry.usage,
            };
            return item;
          }),
        );
        if (requestId !== requestIdRef.current) return;
        nextItems = resolved.filter((item): item is ArticleMediaLibraryItem => item !== null);
      }

      setItems(nextItems);
      loadedAtRef.current = Date.now();
      setLoadedKey(snapshotKey);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        inFlightKeyRef.current = null;
      }
    }
  }, [articleId, liveUsage, loadedKey, snapshotKey]);

  return { items, loading, loaded, load, usedIds };
}
