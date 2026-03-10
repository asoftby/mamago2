"use client";

import { useCallback, useMemo } from "react";
import { PlaceLogoUploadTemp } from "@/components/business/place/PlaceLogoUploadTemp";
import { PlaceGalleryUploadTemp, type GalleryItem } from "@/components/business/place/PlaceGalleryUploadTemp";
import type { PlaceFormData } from "../types";

interface Step4PhotosProps {
  data: PlaceFormData;
  wizardSessionId: string;
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

  // Convert PlaceImage[] to GalleryItem[]
  const initialGalleryItems: GalleryItem[] = useMemo(() => 
    galleryImages.map((img) => ({
      id: img.id,
      url: img.url,
      width: img.width ?? undefined,
      height: img.height ?? undefined,
      blurhash: img.blurhash || undefined,
      status: "done" as const,
    })), [galleryImages]
  );

  const handleLogoUploadComplete = useCallback((mediaId: string, url: string) => {
    console.log("[Step4Photos] Logo upload complete:", { mediaId, url });
    onChange({ 
      logoImageId: mediaId,
      logoUrl: url,
      tempLogoMediaId: mediaId,
    });
  }, [onChange]);

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
        <p className="text-sm text-muted-foreground mb-4">
          Добавьте логотип или главное фото вашего места
        </p>
        <PlaceLogoUploadTemp
          wizardSessionId={wizardSessionId}
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
          wizardSessionId={wizardSessionId}
          initialImages={initialGalleryItems}
          onImagesChange={handleGalleryImagesChange}
          disabled={!isEditable}
        />
      </div>
    </div>
  );
}
