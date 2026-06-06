"use client";

import { useEffect, useMemo, useState } from "react";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";

type PickerItem = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
};

export function ArticleEditorGalleryField({
  value,
  onChange,
  showHeading = true,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  showHeading?: boolean;
}) {
  const [previewById, setPreviewById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const ids = value.filter((id) => id.trim());

    if (ids.length === 0) {
      setPreviewById({});
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

      setPreviewById(
        entries.reduce<Record<string, string>>((acc, [id, url]) => {
          if (url) acc[id] = url;
          return acc;
        }, {}),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [value]);

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
      const media = await uploadMediaFile(file);
      uploaded.push({
        id: media.id,
        url: media.url,
        title: file.name,
        alt: null,
      });
    }

    return uploaded;
  };

  const loadMediaLibraryItems = async (): Promise<MediaUploadItem[]> => {
    const res = await fetch("/api/admin/articles/media-picker?limit=48", {
      credentials: "include",
    });
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
      label={showHeading ? "Галерея" : undefined}
      mode="multiple"
      value={galleryValue}
      onChange={(next) => {
        const items = Array.isArray(next) ? next : [];
        setPreviewById(
          items.reduce<Record<string, string>>((acc, item) => {
            acc[item.id] = item.url;
            return acc;
          }, {}),
        );
        onChange(items.map((item) => item.id));
      }}
      maxFiles={24}
      maxSizeMb={3}
      allowMediaLibrary
      allowUpload
      allowReorder
      onUploadFiles={uploadFiles}
      loadMediaLibraryItems={loadMediaLibraryItems}
      uploadButtonLabel="Загрузить изображения"
      uploadSuccessMessage="Изображение добавлено в галерею"
      librarySelectSuccessMessage="Добавлено в галерею"
      mediaLibraryDescription="Кликните по превью, чтобы отметить несколько изображений, затем добавьте их в галерею."
      multipleEmptyHint="Можно взять изображения из медиатеки или загрузить файлы"
    />
  );
}
