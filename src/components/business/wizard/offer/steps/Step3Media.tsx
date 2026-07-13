"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";
import { convertHeicFileToJpegIfNeeded } from "@/lib/uploads/heicConversion";
import { MAX_IMAGE_FILES } from "@/lib/uploads/uploadConfig";
import type { OfferFormData } from "../types";
import { isValidVideoUrl } from "../mappers";

interface Step3MediaProps {
  data: OfferFormData;
  onChange: (
    updates:
      | Partial<OfferFormData>
      | ((prev: OfferFormData) => Partial<OfferFormData>),
  ) => void;
  isEditable: boolean;
  wizardSessionId?: string;
}

type BusinessPickerItem = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
};

async function uploadFilesToPublicMedia(files: File[]): Promise<MediaUploadItem[]> {
  const uploaded: MediaUploadItem[] = [];

  for (const file of files) {
    // Prebuilt sharp has no HEVC decoder (see imageProcessor.ts) — this
    // bypasses the shared upload hooks (its own inline fetch, not
    // useImageUpload/useWizardImageUpload), so it needs its own HEIC
    // conversion rather than inheriting it for free.
    let fileToUpload: File;
    try {
      fileToUpload = await convertHeicFileToJpegIfNeeded(file);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : `Не удалось обработать файл «${file.name}»`);
    }

    const formData = new FormData();
    formData.append("file", fileToUpload);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      url?: string;
      mediaId?: string | null;
    };

    if (!response.ok) {
      throw new Error(
        typeof payload.message === "string"
          ? payload.message
          : typeof payload.error === "string"
            ? payload.error
            : `Ошибка загрузки файла «${file.name}»`,
      );
    }

    const url = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!url) {
      throw new Error(`Файл «${file.name}» загружен без публичного URL`);
    }

    uploaded.push({
      id: url,
      url,
      title: file.name,
      alt: null,
    });
  }

  return uploaded;
}

async function loadBusinessMediaLibrary(): Promise<MediaUploadItem[]> {
  const response = await fetch("/api/business/media-picker?limit=48", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Не удалось загрузить медиатеку");
  }

  const data = (await response.json()) as { items?: BusinessPickerItem[] };

  return (data.items ?? [])
    .filter((item): item is BusinessPickerItem & { publicUrl: string } => Boolean(item.publicUrl))
    .map((item) => ({
      id: item.publicUrl,
      url: item.publicUrl,
      alt: item.alt,
      title: item.title,
    }));
}

export function Step3Media({ data, onChange, isEditable }: Step3MediaProps) {
  const handleCoverChange = useCallback(
    (value: MediaUploadItem | MediaUploadItem[] | null) => {
      const nextCover = value && !Array.isArray(value) ? value.url : null;
      onChange({ coverImage: nextCover });
    },
    [onChange],
  );

  const handleGalleryChange = useCallback(
    (value: MediaUploadItem | MediaUploadItem[] | null) => {
      const nextGallery = Array.isArray(value) ? value.map((item) => item.url) : [];
      onChange({ gallery: nextGallery });
    },
    [onChange],
  );

  const handleVideoUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ videoUrl: event.target.value });
  };

  const videoUrlError =
    data.videoUrl && !isValidVideoUrl(data.videoUrl) ? "Некорректная ссылка на видео" : null;

  const coverValue = data.coverImage
    ? {
        id: data.coverImage,
        url: data.coverImage,
        alt: null,
        title: "Главное изображение",
      }
    : null;

  const galleryValue = data.gallery.map((url) => ({
    id: url,
    url,
    alt: null,
    title: "Изображение галереи",
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Медиа</h2>
        <p className="text-muted-foreground">
          Добавьте изображения для привлечения внимания к предложению
        </p>
      </div>

      <MediaUploadField
        label="Главное изображение"
        description="Основное фото, которое будет показано в карточке предложения."
        required
        mode="single"
        value={coverValue}
        onChange={handleCoverChange}
        disabled={!isEditable}
        allowMediaLibrary
        allowUpload
        onUploadFiles={uploadFilesToPublicMedia}
        loadMediaLibraryItems={loadBusinessMediaLibrary}
        mediaLibraryDescription="Выберите одно изображение из вашей медиатеки или загрузите новый файл."
      />

      <MediaUploadField
        label="Галерея"
        description="Дополнительные фотографии для детального показа предложения."
        mode="multiple"
        value={galleryValue}
        onChange={handleGalleryChange}
        maxFiles={MAX_IMAGE_FILES}
        disabled={!isEditable}
        allowMediaLibrary
        allowUpload
        onUploadFiles={uploadFilesToPublicMedia}
        loadMediaLibraryItems={loadBusinessMediaLibrary}
        mediaLibraryDescription="Выберите несколько изображений из медиатеки или загрузите новые файлы."
      />

      <div className="space-y-2">
        <Label htmlFor="videoUrl">Видео (необязательно)</Label>
        <Input
          id="videoUrl"
          placeholder="Ссылка на YouTube, Shorts или Instagram Reels"
          value={data.videoUrl || ""}
          onChange={handleVideoUrlChange}
          disabled={!isEditable}
          className={videoUrlError ? "border-red-500" : ""}
        />
        {videoUrlError ? <p className="text-xs text-red-500">{videoUrlError}</p> : null}
        <p className="text-xs text-muted-foreground">
          Поддерживаются ссылки на YouTube, YouTube Shorts и Instagram Reels
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h4 className="mb-2 font-medium text-blue-900">Советы по фотографиям</h4>
        <ul className="space-y-1 text-sm text-blue-700">
          <li>• Используйте качественные и яркие изображения</li>
          <li>• Покажите процесс или результат предложения</li>
          <li>• Избегайте размытых или темных фотографий</li>
          <li>• Добавьте фото людей, которые пользуются услугой</li>
        </ul>
      </div>
    </div>
  );
}
