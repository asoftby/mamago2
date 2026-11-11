"use client";

import { useCallback, useMemo } from "react";
import { PlaceLogoUploadTemp } from "@/components/business/place/PlaceLogoUploadTemp";
import { PlaceGalleryUploadTemp, type GalleryItem } from "@/components/business/place/PlaceGalleryUploadTemp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidVideoUrl } from "@/components/business/wizard/offer/mappers";
import type { PlaceFormData, PlaceImage } from "../types";
import { PlacePhotosInstagramField } from "./placePhotosInstagramField";

interface Step4PhotosProps {
  data: PlaceFormData;
  wizardSessionId?: string;
  onChange: (updates: Partial<PlaceFormData>) => void;
  isEditable?: boolean;
}

export function Step4Photos({ 
  data, 
  wizardSessionId,
  onChange, 
  isEditable = true,
}: Step4PhotosProps) {
  const logoImage = data.images.find((img) => img.kind === "LOGO");
  const galleryImages = data.images
    .filter((img) => img.kind === "GALLERY")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hasLogo = !!(logoImage?.url || data.logoUrl);
  const isMediaEditable = isEditable && data.status !== "PUBLISHED";

  // Convert PlaceImage[] to GalleryItem[]
  const initialGalleryItems: GalleryItem[] = useMemo(() =>
    galleryImages.map((img) => ({
      id: img.id,
      url: img.url,
      width: img.width ?? undefined,
      height: img.height ?? undefined,
      blurhash: img.blurhash || undefined,
      status: "done" as const,
      // A wizard may mix persisted PlaceImages with new TempMedia even in edit mode.
      source: (!data.id || data.tempGalleryMediaIds?.includes(img.id))
        ? "temp" as const : "place" as const,
    })), [galleryImages, data.id, data.tempGalleryMediaIds]
  );

  const handleLogoUploadComplete = useCallback((mediaId: string, url: string) => {
    console.log("[Step4Photos] Logo upload complete:", { mediaId, url });
    const withoutLogo = data.images.filter((img) => img.kind !== "LOGO");
    const newLogo: PlaceImage = {
      id: mediaId,
      url,
      width: null,
      height: null,
      blurhash: null,
      kind: "LOGO",
      sortOrder: 0,
    };
    onChange({
      logoImageId: mediaId,
      logoUrl: url,
      tempLogoMediaId: mediaId,
      images: [...withoutLogo, newLogo],
    });
  }, [onChange, data.images]);

  const handleLogoRemove = useCallback(() => {
    onChange({
      logoImageId: null,
      logoUrl: null,
      tempLogoMediaId: null,
      images: data.images.filter((img) => img.kind !== "LOGO"),
    });
  }, [onChange, data.images]);

  const handleReelsUrlChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ reelsUrl: event.target.value || null });
    },
    [onChange],
  );

  const reelsUrl = data.reelsUrl || "";
  const reelsUrlError = reelsUrl && !isValidVideoUrl(reelsUrl) ? "Некорректная ссылка на видео" : null;

  const handleGalleryImagesChange = useCallback((galleryItems: GalleryItem[]) => {
    console.log("[Step4Photos] Gallery changed:", galleryItems.length, "images");
    
    // Update images array in form data
    const newImages = galleryItems.map((item, index) => ({
      id: item.id,
      url: item.url,
      width: item.width ?? null,
      height: item.height ?? null,
      blurhash: item.blurhash || null,
      kind: "GALLERY",
      sortOrder: index,
    }));
    
    onChange({
      images: [
        ...data.images.filter(img => img.kind !== "GALLERY"),
        ...newImages,
      ],
      tempGalleryMediaIds: galleryItems
        .filter((item) => item.source !== "place")
        .map((item) => item.id),
    });
  }, [onChange, data.images]);

  return (
    <div className="space-y-8">
      {data.status === "PUBLISHED" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Изображения опубликованного места сохраняются через ревизию.
          Редактирование изображений временно недоступно до завершения безопасного переноса в ревизию.
        </p>
      ) : null}
      {/* Logo */}
      <div>
        <h3 className="font-medium mb-2">Логотип *</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Добавьте логотип места. Главное фото выбирается первым в блоке «Фото места» ниже.
        </p>

        <PlacePhotosInstagramField
          data={data}
          onChange={onChange}
          wizardSessionId={wizardSessionId}
          hasLogo={hasLogo}
          onImportComplete={handleLogoUploadComplete}
          isEditable={isMediaEditable}
        />

        <PlaceLogoUploadTemp
          wizardSessionId={wizardSessionId || ""}
          currentLogoUrl={logoImage?.url || data.logoUrl || undefined}
          currentLogoMediaId={logoImage?.id || data.logoImageId}
          placeId={data.id}
          published={data.status === "PUBLISHED"}
          onUploadComplete={handleLogoUploadComplete}
          onRemove={handleLogoRemove}
          isExistingPlaceImage={Boolean(data.id && logoImage?.id && !data.tempLogoMediaId)}
          disabled={!isMediaEditable}
        />
      </div>

      {/* Gallery */}
      <div>
        <h3 className="font-medium mb-2">Фото места</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Первое фото используется как главное на странице места. Измените порядок фотографий, чтобы сменить главное.
        </p>
        <PlaceGalleryUploadTemp
          wizardSessionId={wizardSessionId || ""}
          placeId={data.id}
          initialImages={initialGalleryItems}
          onImagesChange={handleGalleryImagesChange}
          published={data.status === "PUBLISHED"}
          disabled={!isMediaEditable}
        />
      </div>

      {/* Reels */}
      <div className="space-y-2">
        <Label htmlFor="reelsUrl">Reels (необязательно)</Label>
        <Input
          id="reelsUrl"
          placeholder="Ссылка на Instagram Reels, YouTube или Shorts"
          value={reelsUrl}
          onChange={handleReelsUrlChange}
          disabled={!isMediaEditable}
          className={reelsUrlError ? "border-red-500" : ""}
        />
        {reelsUrlError ? <p className="text-xs text-red-500">{reelsUrlError}</p> : null}
        <p className="text-sm text-muted-foreground">
          Покажем как первый маленький блок медиа-сетки на странице места
        </p>
      </div>
    </div>
  );
}
