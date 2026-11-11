"use client";

import type { MediaUploadItem } from "@/components/media/MediaUploadField";
import type { MediaLibraryPage } from "@/components/media/useMediaLibraryPager";
import { uploadMediaFile } from "@/lib/uploads/uploadClient";

export type PlaceTempMediaKind = "PLACE_LOGO" | "PLACE_GALLERY";

type PickerAsset = {
  id: string;
  publicUrl: string | null;
  alt: string | null;
  title: string | null;
  isUsed?: boolean;
};

export async function loadPlaceMediaLibraryPage({
  cursor,
  limit,
}: {
  cursor: string | null;
  limit: number;
}): Promise<MediaLibraryPage<MediaUploadItem>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch("/api/business/media-picker?" + params.toString(), {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Не удалось загрузить медиатеку");
  const result = (await response.json()) as {
    items: PickerAsset[];
    nextCursor: string | null;
    hasMore: boolean;
  };
  return {
    items: (result.items || [])
      .filter((asset): asset is PickerAsset & { publicUrl: string } => Boolean(asset.publicUrl))
      .map((asset) => ({
        id: asset.id,
        url: asset.publicUrl,
        alt: asset.alt,
        title: asset.title,
        isUsed: asset.isUsed,
      })),
    nextCursor: result.nextCursor ?? null,
    hasMore: Boolean(result.hasMore),
  };
}

export async function attachAssetToPlaceWizard(
  assetId: string,
  wizardSessionId: string,
  kind: PlaceTempMediaKind,
  sortOrder = 0,
): Promise<MediaUploadItem> {
  if (!wizardSessionId) throw new Error("Сессия создания места не найдена. Обновите страницу.");
  const response = await fetch("/api/business/temp-media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wizardSessionId,
      kind,
      mediaAssetId: assetId,
      sortOrder,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    media?: { id: string; url: string };
    error?: string;
    message?: string;
  };
  if (!response.ok || !payload.media?.id || !payload.media.url) {
    throw new Error(payload.message || payload.error || "Не удалось добавить изображение");
  }
  return { id: payload.media.id, url: payload.media.url };
}

export async function uploadFilesToPlaceWizard(
  files: File[],
  wizardSessionId: string,
  kind: PlaceTempMediaKind,
  startOrder = 0,
): Promise<MediaUploadItem[]> {
  const items: MediaUploadItem[] = [];
  try {
    for (const [index, file] of files.entries()) {
      // Existing upload transport registers MediaAsset and normalizes HEIC/HEIF.
      const uploaded = await uploadMediaFile(file);
      items.push(await attachAssetToPlaceWizard(uploaded.id, wizardSessionId, kind, startOrder + index));
    }
    return items;
  } catch (error) {
    // MediaUploadField commits the batch only on success. Prevent a partially
    // uploaded batch from silently reappearing when the session is restored.
    await Promise.allSettled(items.map((item) => removeWizardTempMedia(item.id)));
    throw error;
  }
}

export async function removeWizardTempMedia(id: string): Promise<void> {
  const response = await fetch("/api/business/temp-media/" + encodeURIComponent(id), {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Не удалось удалить изображение");
}

export async function reorderWizardTempGallery(
  wizardSessionId: string,
  orderedIds: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  if (orderedIds.length === 0) return;
  const response = await fetch("/api/business/temp-media/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wizardSessionId, updates: orderedIds }),
  });
  if (!response.ok) throw new Error("Не удалось сохранить порядок фотографий");
}

export async function reorderSavedPlaceGallery(
  placeId: string,
  updates: Array<{ id: string; sortOrder: number }>,
): Promise<void> {
  if (updates.length === 0) return;
  const response = await fetch(
    "/api/business/places/" + encodeURIComponent(placeId) + "/images/reorder",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    },
  );
  if (!response.ok) throw new Error("Не удалось сохранить порядок фотографий места");
}
