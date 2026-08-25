"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";
import type { MediaLibraryPage } from "@/components/media/useMediaLibraryPager";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";
import type { useArticleMediaSource } from "@/components/admin/articles/useArticleMediaSource";

type PickerItem = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
  isUsed: boolean;
};

export function ArticleEditorGalleryField({
  value,
  onChange,
  authorUserId,
  showHeading = true,
  articleMediaSource,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Медиатека статьи = медиатека этого автора; без него сервер берёт медиатеку текущего пользователя. */
  authorUserId?: string | null;
  showHeading?: boolean;
  /** «Фото этой статьи» — первая вкладка picker'а. Без него picker остаётся одноисточниковым. */
  articleMediaSource?: ReturnType<typeof useArticleMediaSource>;
}) {
  const [loadedPreviewById, setLoadedPreviewById] = useState<Record<string, string>>({});
  const ids = useMemo(() => value.filter((id) => id.trim()), [value]);

  useEffect(() => {
    let cancelled = false;

    if (ids.length === 0) {
      return;
    }

    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(id)}`, {
              credentials: "include",
            });
            if (!res.ok) return [id, ""] as const;
            const data = (await res.json()) as { publicUrl: string | null };
            return [id, data.publicUrl ?? ""] as const;
          } catch {
            return [id, ""] as const;
          }
        }),
      );

      if (cancelled) return;

      setLoadedPreviewById(
        entries.reduce<Record<string, string>>((acc, [id, url]) => {
          if (url) acc[id] = url;
          return acc;
        }, {}),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [ids]);

  const previewById = useMemo(
    () => (ids.length === 0 ? {} : loadedPreviewById),
    [ids.length, loadedPreviewById],
  );

  const galleryValue = useMemo(
    () =>
      value.map((id) => ({
        id,
        url: previewById[id] ?? `/api/media/${encodeURIComponent(id)}`,
        alt: null,
        title: "Изображение галереи",
      })),
    [previewById, value],
  );

  const uploadFiles = async (files: File[]): Promise<MediaUploadItem[]> => {
    const uploaded: MediaUploadItem[] = [];

    for (const file of files) {
      const media = await uploadMediaFile(
        file,
        authorUserId ? { ownerUserId: authorUserId, uploadContext: "ADMIN_ARTICLE" } : undefined,
      );
      uploaded.push({
        id: media.id,
        url: media.url,
        title: file.name,
        alt: null,
      });
    }

    return uploaded;
  };

  const loadMediaLibraryPage = async ({
    cursor,
    limit,
  }: {
    cursor: string | null;
    limit: number;
  }): Promise<MediaLibraryPage<MediaUploadItem>> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    if (authorUserId) params.set("authorUserId", authorUserId);
    const res = await fetch(`/api/admin/articles/media-picker?${params.toString()}`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Не удалось загрузить медиатеку");
    }
    const data = (await res.json()) as { items: PickerItem[]; nextCursor: string | null; hasMore: boolean };
    return {
      items: (data.items ?? [])
        .filter((item): item is PickerItem & { publicUrl: string } => Boolean(item.publicUrl))
        .map((item) => ({
          id: item.id,
          url: item.publicUrl,
          alt: item.alt,
          title: item.title,
          isUsed: item.isUsed,
        })),
      nextCursor: data.nextCursor ?? null,
      hasMore: Boolean(data.hasMore),
    };
  };

  return (
    <MediaUploadField
      label={showHeading ? "Галерея" : undefined}
      mode="multiple"
      value={galleryValue}
      onChange={(next) => {
        const items = Array.isArray(next) ? next : [];
        setLoadedPreviewById(
          items.reduce<Record<string, string>>((acc, item) => {
            acc[item.id] = item.url;
            return acc;
          }, {}),
        );
        onChange(items.map((item) => item.id));
      }}
      maxFiles={24}
      allowMediaLibrary
      allowUpload
      allowReorder
      onUploadFiles={uploadFiles}
      loadMediaLibraryPage={loadMediaLibraryPage}
      libraryOwnerKey={authorUserId ?? null}
      uploadButtonLabel="Загрузить изображения"
      uploadSuccessMessage="Изображение добавлено в галерею"
      librarySelectSuccessMessage="Добавлено в галерею"
      mediaLibraryDescription="Кликните по превью, чтобы отметить несколько изображений, затем добавьте их в галерею."
      multipleEmptyHint="Можно взять изображения из медиатеки или загрузить файлы"
      addSelectedButtonLabel="Добавить в галерею"
      usedIds={articleMediaSource?.usedIds}
      usageLabel="Используется"
      articleLibrary={
        articleMediaSource
          ? {
              items: articleMediaSource.items,
              loading: articleMediaSource.loading,
              load: articleMediaSource.load,
            }
          : undefined
      }
    />
  );
}
