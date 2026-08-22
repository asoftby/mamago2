"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";
import type { MediaLibraryPage } from "@/components/media/useMediaLibraryPager";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";

type PickerItem = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
};

export function ArticleEditorCoverField({
  value,
  onChange,
  initialPreviewUrl,
  authorUserId,
  showHeading = true,
  uploadButtonLabel = "Загрузить обложку",
  successUploadMessage = "Обложка загружена",
  successPickMessage = "Обложка выбрана",
}: {
  value: string;
  onChange: (mediaId: string, previewUrl: string | null) => void;
  initialPreviewUrl?: string | null;
  /** Медиатека статьи = медиатека этого автора; без него сервер берёт медиатеку текущего пользователя. */
  authorUserId?: string | null;
  showHeading?: boolean;
  uploadButtonLabel?: string;
  successUploadMessage?: string;
  successPickMessage?: string;
}) {
  const mediaId = value.trim();
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(initialPreviewUrl ?? null);

  useEffect(() => {
    if (!mediaId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(mediaId)}`);
        if (!res.ok) {
          if (!cancelled) setResolvedPreviewUrl(initialPreviewUrl ?? null);
          return;
        }
        const data = (await res.json()) as { publicUrl: string | null };
        if (!cancelled) setResolvedPreviewUrl(data.publicUrl ?? initialPreviewUrl ?? null);
      } catch {
        if (!cancelled) setResolvedPreviewUrl(initialPreviewUrl ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPreviewUrl, mediaId]);

  const previewUrl = mediaId ? resolvedPreviewUrl ?? initialPreviewUrl ?? null : null;

  const currentValue = useMemo<MediaUploadItem | null>(() => {
    if (!mediaId) return null;
    return {
      id: mediaId,
      url: previewUrl ?? `/api/media/${encodeURIComponent(mediaId)}`,
      alt: null,
      title: "Обложка статьи",
    };
  }, [mediaId, previewUrl]);

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
        })),
      nextCursor: data.nextCursor ?? null,
      hasMore: Boolean(data.hasMore),
    };
  };

  return (
    <MediaUploadField
      label={showHeading ? "Обложка" : undefined}
      mode="single"
      value={currentValue}
      onChange={(next) => {
        const item = next && !Array.isArray(next) ? next : null;
        setResolvedPreviewUrl(item?.url ?? null);
        onChange(item?.id ?? "", item?.url ?? null);
      }}
      allowMediaLibrary
      allowUpload
      onUploadFiles={uploadFiles}
      loadMediaLibraryPage={loadMediaLibraryPage}
      libraryOwnerKey={authorUserId ?? null}
      uploadButtonLabel={uploadButtonLabel}
      uploadSuccessMessage={successUploadMessage}
      librarySelectSuccessMessage={successPickMessage}
      mediaLibraryDescription="Недавно загруженные изображения. Полный список — в разделе «Медиатека»."
      singleEmptyHint="Выберите главное изображение из медиатеки или загрузите файл"
    />
  );
}
