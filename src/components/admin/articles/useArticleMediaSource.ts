"use client";

import { useCallback, useRef, useState } from "react";
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
 * Ничего не создаёт и не изменяет — только чтение.
 */
export function useArticleMediaSource(params: {
  articleId: string | null;
  coverImageId: string;
  blocks: ArticleBlockMvp[];
}) {
  const { articleId, coverImageId, blocks } = params;
  const [items, setItems] = useState<ArticleMediaLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (articleId) {
        const res = await fetch(`/api/admin/articles/${encodeURIComponent(articleId)}/media`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Не удалось загрузить изображения статьи");
        const data = (await res.json()) as { items: ArticleMediaItem[] };
        if (requestId !== requestIdRef.current) return;
        setItems(
          data.items.map((item) => ({
            id: item.id,
            url: item.publicUrl,
            alt: item.alt,
            title: item.title,
            usage: item.usage,
          })),
        );
      } else {
        const entries = extractArticleMediaUsage({ coverImageId, blocks });
        const resolved = await Promise.all(
          entries.map(async (entry) => {
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
        setItems(resolved.filter((item): item is ArticleMediaLibraryItem => item !== null));
      }
      setLoaded(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [articleId, coverImageId, blocks]);

  return { items, loading, loaded, load };
}
