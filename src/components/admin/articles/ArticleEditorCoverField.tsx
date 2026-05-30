"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";

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
  showHeading = true,
  uploadButtonLabel = "Загрузить обложку",
  successUploadMessage = "Обложка загружена",
  successPickMessage = "Обложка выбрана",
}: {
  value: string;
  onChange: (mediaId: string, previewUrl: string | null) => void;
  initialPreviewUrl?: string | null;
  showHeading?: boolean;
  uploadButtonLabel?: string;
  successUploadMessage?: string;
  successPickMessage?: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl ?? null);

  useEffect(() => {
    if (!value.trim()) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/articles/media-preview?id=${encodeURIComponent(value.trim())}`);
        if (!res.ok) {
          if (!cancelled) setPreviewUrl(initialPreviewUrl ?? null);
          return;
        }
        const data = (await res.json()) as { publicUrl: string | null };
        if (!cancelled) setPreviewUrl(data.publicUrl ?? initialPreviewUrl ?? null);
      } catch {
        if (!cancelled) setPreviewUrl(initialPreviewUrl ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, initialPreviewUrl]);

  const currentValue = useMemo<MediaUploadItem | null>(() => {
    const mediaId = value.trim();
    if (!mediaId) return null;
    return {
      id: mediaId,
      url: previewUrl ?? `/api/media/${encodeURIComponent(mediaId)}`,
      alt: null,
      title: "Обложка статьи",
    };
  }, [value, previewUrl]);

  const uploadFiles = async (files: File[]): Promise<MediaUploadItem[]> => {
    const uploaded: MediaUploadItem[] = [];

    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
        mediaId?: string | null;
      };

      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Ошибка загрузки");
      }

      const mediaId = data.mediaId?.trim();
      if (!mediaId) {
        throw new Error("Файл загружен, но не получен ID медиа. Откройте медиатеку и выберите файл.");
      }

      uploaded.push({
        id: mediaId,
        url: data.url ?? "",
        title: file.name,
        alt: null,
      });
    }

    return uploaded;
  };

  const loadMediaLibraryItems = async (): Promise<MediaUploadItem[]> => {
    const res = await fetch("/api/admin/articles/media-picker?limit=48");
    if (!res.ok) {
      throw new Error("Не удалось загрузить медиатеку");
    }
    const data = (await res.json()) as { items: PickerItem[] };
    return (data.items ?? [])
      .filter((item): item is PickerItem & { publicUrl: string } => Boolean(item.publicUrl))
      .map((item) => ({
        id: item.id,
        url: item.publicUrl,
        alt: item.alt,
        title: item.title,
      }));
  };

  return (
    <MediaUploadField
      label={showHeading ? "Обложка" : undefined}
      mode="single"
      value={currentValue}
      onChange={(next) => {
        const item = next && !Array.isArray(next) ? next : null;
        setPreviewUrl(item?.url ?? null);
        onChange(item?.id ?? "", item?.url ?? null);
      }}
      maxSizeMb={5}
      allowMediaLibrary
      allowUpload
      onUploadFiles={uploadFiles}
      loadMediaLibraryItems={loadMediaLibraryItems}
      uploadButtonLabel={uploadButtonLabel}
      uploadSuccessMessage={successUploadMessage}
      librarySelectSuccessMessage={successPickMessage}
      mediaLibraryDescription="Недавно загруженные изображения. Полный список — в разделе «Медиатека»."
      singleEmptyHint="Выберите главное изображение из медиатеки или загрузите файл"
    />
  );
}
