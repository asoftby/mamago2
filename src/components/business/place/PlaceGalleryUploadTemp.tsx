"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";
import { MAX_IMAGE_FILES } from "@/lib/uploads/uploadConfig";
import { toast } from "@/lib/toast";
import {
  attachAssetToPlaceWizard,
  loadPlaceMediaLibraryPage,
  removeWizardTempMedia,
  reorderSavedPlaceGallery,
  reorderWizardTempGallery,
  uploadFilesToPlaceWizard,
} from "./placeWizardMediaAdapter";

export interface GalleryItem {
  id: string;
  url: string;
  width?: number;
  height?: number;
  blurhash?: string;
  status: "uploading" | "done" | "error";
  source?: "temp" | "place";
}

interface PlaceGalleryUploadTempProps {
  wizardSessionId: string;
  placeId?: string;
  initialImages?: GalleryItem[];
  onImagesChange?: (images: GalleryItem[]) => void;
  disabled?: boolean;
  /** Published places require a revision before changing already attached photos. */
  published?: boolean;
}

async function removeSavedPlaceImage(placeId: string, id: string) {
  const response = await fetch(
    "/api/business/places/" + encodeURIComponent(placeId) + "/images/" + encodeURIComponent(id),
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Не удалось удалить фотографию места");
}

/** Wizard persistence adapter; all media selection UI is shared with offers and articles. */
export function PlaceGalleryUploadTemp({
  wizardSessionId,
  placeId,
  initialImages = [],
  onImagesChange,
  disabled = false,
  published = false,
}: PlaceGalleryUploadTempProps) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const uploadedIds = useRef(new Set<string>());

  // Old drafts might have persisted TempMedia but an incomplete local autosave.
  useEffect(() => {
    if (!wizardSessionId || published) return;
    let cancelled = false;
    void fetch("/api/business/temp-media?wizardSessionId=" + encodeURIComponent(wizardSessionId))
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: { media?: Array<{ id: string; url: string; kind: string; sortOrder: number }> } | null) => {
        if (cancelled) return;
        const knownIds = new Set(initialImages.map((item) => item.id));
        const missing: GalleryItem[] = (payload?.media ?? [])
          .filter((item) => item.kind === "PLACE_GALLERY" && !knownIds.has(item.id))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({ id: item.id, url: item.url, source: "temp" as const, status: "done" as const }));
        if (missing.length) onImagesChange?.([...initialImages, ...missing]);
      })
      .catch(() => { /* The UI can still load images from the wizard draft. */ });
    return () => { cancelled = true; };
    // Session restoration should happen once per wizard, not on every form edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardSessionId, published]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const results = await uploadFilesToPlaceWizard(
      files, wizardSessionId, "PLACE_GALLERY", initialImages.length,
    );
    for (const item of results) uploadedIds.current.add(item.id);
    return results;
  }, [wizardSessionId, initialImages.length]);

  const handleChange = async (next: MediaUploadItem | MediaUploadItem[] | null) => {
    if (busyRef.current) return;
    const selection = Array.isArray(next) ? next : next ? [next] : [];
    const existingById = new Map(initialImages.map((item) => [item.id, item]));
    const nextIds = new Set(selection.map((item) => item.id));
    const removed = initialImages.filter((item) => !nextIds.has(item.id));
    const added = selection.filter((item) => !existingById.has(item.id));

    if (published && removed.some((item) => item.source === "place")) {
      toast.error("Фотографии опубликованного места изменяются через ревизию");
      return;
    }
    if (published && added.length === 0 &&
      selection.some((item, i) => initialImages[i]?.id !== item.id) &&
      initialImages.some((item) => item.source === "place")) {
      toast.error("Порядок фото опубликованного места изменяется через ревизию");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      const resolved = new Map<string, GalleryItem>();
      for (const item of added) {
        if (initialImages.some((old) => old.url === item.url)) {
          throw new Error("Эта фотография уже добавлена в галерею");
        }
        const actual = uploadedIds.current.has(item.id)
          ? item
          : await attachAssetToPlaceWizard(item.id, wizardSessionId, "PLACE_GALLERY", initialImages.length + resolved.size);
        uploadedIds.current.delete(item.id);
        resolved.set(item.id, { id: actual.id, url: actual.url, source: "temp", status: "done" });
      }
      // Remove through the appropriate owner-checked endpoint; never delete the library asset.
      for (const item of removed) {
        if (item.source === "place" && placeId) {
          await removeSavedPlaceImage(placeId, item.id);
        } else {
          await removeWizardTempMedia(item.id);
        }
      }
      const reordered = selection.map((item) =>
        existingById.get(item.id) ?? resolved.get(item.id),
      ).filter((item): item is GalleryItem => Boolean(item));
      const orderChanged = reordered.some((item, index) =>
        initialImages[index]?.id !== item.id,
      );
      const persistedPositions = new Map(
        initialImages.map((item, index) => [item.id, index]),
      );
      const savedImageOrderChanged = reordered.some((item, index) =>
        item.source === "place" && persistedPositions.get(item.id) !== index,
      );
      if (orderChanged) {
        await reorderWizardTempGallery(
          wizardSessionId,
          reordered.flatMap((item, index) => item.source === "place" ? [] : [{ id: item.id, sortOrder: index }]),
        );
        if (placeId && savedImageOrderChanged) {
          await reorderSavedPlaceGallery(
            placeId,
            reordered.flatMap((item, index) => item.source === "place" ? [{ id: item.id, sortOrder: index }] : []),
          );
        }
      }
      onImagesChange?.(reordered);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить фотографии");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const mediaValue: MediaUploadItem[] = initialImages.map((item) => ({
    id: item.id,
    url: item.url,
  }));

  return (
    <MediaUploadField
      mode="multiple"
      value={mediaValue}
      onChange={(next) => { void handleChange(next); }}
      disabled={disabled || busy || !wizardSessionId || published}
      maxFiles={MAX_IMAGE_FILES}
      allowReorder
      allowUpload
      allowMediaLibrary
      firstItemBadge="Главное"
      onUploadFiles={uploadFiles}
      loadMediaLibraryPage={loadPlaceMediaLibraryPage}
      uploadButtonLabel="Загрузить новое"
      multipleEmptyHint="Выберите фотографии из медиатеки или загрузите новые"
      mediaLibraryDescription="Выберите фотографии для страницы места."
      entityType="PLACE"
      context="gallery"
    />
  );
}
