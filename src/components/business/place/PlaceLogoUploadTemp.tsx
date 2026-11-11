"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MediaUploadField, type MediaUploadItem } from "@/components/media/MediaUploadField";
import { toast } from "@/lib/toast";
import {
  attachAssetToPlaceWizard,
  loadPlaceMediaLibraryPage,
  removeWizardTempMedia,
  uploadFilesToPlaceWizard,
} from "./placeWizardMediaAdapter";

interface PlaceLogoUploadTempProps {
  wizardSessionId: string;
  currentLogoUrl?: string | null;
  currentLogoMediaId?: string | null;
  onUploadComplete?: (mediaId: string, url: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  /** Existing PlaceImage IDs are not TempMedia and must not be deleted here. */
  isExistingPlaceImage?: boolean;
}

/** Place-specific persistence adapter; the picker UI itself lives in MediaUploadField. */
export function PlaceLogoUploadTemp({
  wizardSessionId,
  currentLogoUrl,
  currentLogoMediaId,
  onUploadComplete,
  onRemove,
  disabled = false,
  isExistingPlaceImage = false,
}: PlaceLogoUploadTempProps) {
  const [restored, setRestored] = useState<MediaUploadItem | null>(null);
  const [saving, setSaving] = useState(false);
  const uploadedIds = useRef(new Set<string>());
  const busyRef = useRef(false);

  useEffect(() => {
    if (!wizardSessionId) return;
    let cancelled = false;
    void fetch("/api/business/temp-media?wizardSessionId=" + encodeURIComponent(wizardSessionId))
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload: { media?: Array<{ id: string; url: string; kind: string }> } | null) => {
        if (cancelled) return;
        const item = payload?.media?.find((media) => media.kind === "PLACE_LOGO");
        if (!item) return;
        setRestored({ id: item.id, url: item.url });
        if (currentLogoMediaId !== item.id) onUploadComplete?.(item.id, item.url);
      })
      .catch(() => { /* The current draft still holds its image; allow manual retry. */ });
    return () => { cancelled = true; };
    // On session change only: callbacks and current data are intentionally not effect dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardSessionId]);

  const value: MediaUploadItem | null = currentLogoUrl
    ? { id: currentLogoMediaId || currentLogoUrl, url: currentLogoUrl }
    : restored;

  const uploadFiles = useCallback(async (files: File[]) => {
    const uploaded = await uploadFilesToPlaceWizard(files, wizardSessionId, "PLACE_LOGO");
    for (const item of uploaded) uploadedIds.current.add(item.id);
    return uploaded;
  }, [wizardSessionId]);

  const handleChange = async (next: MediaUploadItem | MediaUploadItem[] | null) => {
    if (busyRef.current) return;
    const item = !Array.isArray(next) ? next : next[0] ?? null;
    if (item?.id === value?.id) return;
    busyRef.current = true;
    setSaving(true);
    try {
      if (!item) {
        if (value && !isExistingPlaceImage) await removeWizardTempMedia(value.id);
        // Existing PlaceImage removal must go through the place/revision save workflow.
        if (value && isExistingPlaceImage) {
          toast.error("Удаление сохранённого логотипа требует сохранения изменений места");
          return;
        }
        setRestored(null);
        onRemove?.();
        return;
      }
      const selected = uploadedIds.current.has(item.id)
        ? item
        : await attachAssetToPlaceWizard(item.id, wizardSessionId, "PLACE_LOGO");
      uploadedIds.current.delete(item.id);
      setRestored(selected);
      onUploadComplete?.(selected.id, selected.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить логотип");
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  return (
    <MediaUploadField
      mode="single"
      value={value}
      onChange={(next) => { void handleChange(next); }}
      disabled={disabled || saving || !wizardSessionId}
      allowUpload
      allowMediaLibrary
      onUploadFiles={uploadFiles}
      loadMediaLibraryPage={loadPlaceMediaLibraryPage}
      uploadButtonLabel="Загрузить новое"
      singleEmptyHint="Выберите логотип из медиатеки или загрузите новый"
      mediaLibraryDescription="Выберите логотип, который вы ранее загрузили в медиатеку."
      entityType="PLACE"
      context="logo"
    />
  );
}
