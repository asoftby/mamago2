"use client";

import { useMemo } from "react";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";
import {
  invalidateMediaLibraryClientCache,
  type MediaLibraryPage,
} from "@/components/media/useMediaLibraryPager";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";
import type { useArticleMediaSource } from "@/components/admin/articles/useArticleMediaSource";

type PickerItem = {
  id: string;
  publicUrl: string | null;
  thumbnailUrl?: string | null;
  alt: string | null;
  title: string | null;
  isUsed: boolean;
};

function mediaThumbnailUrl(mediaId: string): string {
  return `/api/media/${encodeURIComponent(mediaId)}?variant=sm`;
}

export function ArticleEditorGalleryField({
  value,
  onChange,
  authorUserId,
  articleId,
  showHeading = true,
  label,
  description,
  firstItemBadge,
  articleMediaSource,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Медиатека статьи = медиатека этого автора; без него сервер берёт медиатеку текущего пользователя. */
  authorUserId?: string | null;
  articleId?: string | null;
  showHeading?: boolean;
  label?: string;
  description?: string;
  firstItemBadge?: string;
  /** «Фото этой статьи» — первая вкладка picker'а. Без него picker остаётся одноисточниковым. */
  articleMediaSource?: ReturnType<typeof useArticleMediaSource>;
}) {
  const galleryValue = useMemo(
    () =>
      value.map((id) => ({
        id,
        url: mediaThumbnailUrl(id),
        alt: null,
        title: "Изображение галереи",
      })),
    [value],
  );

  const uploadFiles = async (files: File[]): Promise<MediaUploadItem[]> => {
    const uploaded: MediaUploadItem[] = [];

    for (const file of files) {
      const media = await uploadMediaFile(
        file,
        authorUserId ? { ownerUserId: authorUserId, uploadContext: "ADMIN_ARTICLE", contextEntityId: articleId ?? undefined } : undefined,
      );
      uploaded.push({
        id: media.id,
        url: mediaThumbnailUrl(media.id),
        title: file.name,
        alt: null,
      });
      invalidateMediaLibraryClientCache(authorUserId ?? null);
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
          url: item.thumbnailUrl ?? item.publicUrl,
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
      label={showHeading ? (label ?? "Галерея") : undefined}
      description={description}
      firstItemBadge={firstItemBadge}
      mode="multiple"
      value={galleryValue}
      onChange={(next) => {
        const items = Array.isArray(next) ? next : [];
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
