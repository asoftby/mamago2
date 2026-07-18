"use client";

import { useCallback, useMemo } from "react";
import { PlaceLogoUploadTemp } from "@/components/business/place/PlaceLogoUploadTemp";
import { PlaceGalleryUploadTemp, type GalleryItem } from "@/components/business/place/PlaceGalleryUploadTemp";
import { InstagramAvatarImport } from "@/components/business/place/InstagramAvatarImport";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidVideoUrl } from "@/components/business/wizard/offer/mappers";
import type { PlaceFormData, PlaceImage } from "../types";
import { shouldShowInstagramAvatarImport } from "../normalizeInstagramHandle";

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
  const galleryImages = data.images.filter((img) => img.kind === "GALLERY");

  const hasLogo = !!(logoImage?.url || data.logoUrl);
  const instagramHandle = data.instagramHandle?.trim() || "";
  // В режиме редактирования лого уже есть в БД — всё равно показываем импорт (замена из Instagram).
  const showInstagramImport = shouldShowInstagramAvatarImport({ instagramHandle, wizardSessionId });

  // Convert PlaceImage[] to GalleryItem[]
  const initialGalleryItems: GalleryItem[] = useMemo(() =>
    galleryImages.map((img) => ({
      id: img.id,
      url: img.url,
      width: img.width ?? undefined,
      height: img.height ?? undefined,
      blurhash: img.blurhash || undefined,
      status: "done" as const,
      // Уже привязанные к месту фото — удаляются через /places/[id]/images, а не /temp-media.
      source: "place" as const,
    })), [galleryImages]
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
      tempGalleryMediaIds: galleryItems.map(item => item.id),
    });
  }, [onChange, data.images]);

  return (
    <div className="space-y-8">
      {/* Logo */}
      <div>
        <h3 className="font-medium mb-2">Логотип *</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Добавьте логотип или главное фото вашего места
        </p>

        {showInstagramImport ? (
          <InstagramAvatarImport
            instagramHandle={instagramHandle}
            wizardSessionId={wizardSessionId!}
            onImportComplete={handleLogoUploadComplete}
            disabled={!isEditable}
            replaceExisting={hasLogo}
            className="mb-3"
          />
        ) : !instagramHandle ? (
          <p className="text-xs text-muted-foreground mb-3">
            Чтобы подтянуть логотип из Instagram, укажите имя профиля на шаге «Контакты».
          </p>
        ) : null}

        <PlaceLogoUploadTemp
          wizardSessionId={wizardSessionId || ""}
          currentLogoUrl={logoImage?.url || data.logoUrl || undefined}
          onUploadComplete={handleLogoUploadComplete}
          disabled={!isEditable}
        />
      </div>

      {/* Gallery */}
      <div>
        <h3 className="font-medium mb-2">Галерея</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Добавьте дополнительные фотографии (необязательно)
        </p>
        <PlaceGalleryUploadTemp
          wizardSessionId={wizardSessionId || ""}
          placeId={data.id}
          initialImages={initialGalleryItems}
          onImagesChange={handleGalleryImagesChange}
          disabled={!isEditable}
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
          disabled={!isEditable}
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
