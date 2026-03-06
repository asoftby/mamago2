"use client";

import { useCallback } from "react";
import type { Place, PlaceImage } from "@prisma/client";
import { PlaceLogoUploadTemp } from "@/components/business/place/PlaceLogoUploadTemp";
import { PlaceGalleryUploadTemp, type GalleryItem } from "@/components/business/place/PlaceGalleryUploadTemp";
import { WizardStepHeader } from "../components/WizardStepHeader";

interface Step3PhotosProps {
  place: Place;
  images: PlaceImage[];
  wizardSessionId: string;
  onUpdate: (updates: Partial<Place & { logoUrl?: string; galleryUrls?: string[]; logoMediaId?: string; galleryMediaIds?: string[] }>) => void;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  isEditable?: boolean;
}

export function Step3Photos({ 
  place, 
  images, 
  wizardSessionId,
  onUpdate, 
  onPrev, 
  onNext, 
  canNext,
  isEditable = true,
}: Step3PhotosProps) {
  const logoImage = images.find((img) => img.kind === "LOGO");
  const galleryImages = images.filter((img) => img.kind === "GALLERY");

  const handleLogoUploadComplete = useCallback((mediaId: string, url: string) => {
    console.log("[Step3Photos] Logo upload complete:", { mediaId, url });
    onUpdate({ 
      logoMediaId: mediaId,
      logoUrl: url,
    });
  }, [onUpdate]);

  const handleGalleryImagesChange = useCallback((galleryItems: GalleryItem[]) => {
    console.log("[Step3Photos] Gallery changed:", galleryItems.length, "images");
    
    onUpdate({
      galleryMediaIds: galleryItems.map(item => item.id),
      galleryUrls: galleryItems.map(item => item.url),
    });
  }, [onUpdate]);

  // Convert PlaceImage[] to GalleryItem[]
  const initialGalleryItems: GalleryItem[] = galleryImages.map((img) => ({
    id: img.id,
    url: img.url,
    width: img.width ?? undefined,
    height: img.height ?? undefined,
    blurhash: img.blurhash || undefined,
    status: "done" as const,
  }));

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Фотографии"
        subtitle="Добавьте фотографии вашего места"
        onBack={onPrev}
        onNext={onNext}
        canNext={canNext}
      />

      {/* Logo */}
      <div>
        <h3 className="font-medium mb-2">Логотип *</h3>
        <PlaceLogoUploadTemp
          wizardSessionId={wizardSessionId}
          currentLogoUrl={logoImage?.url}
          onUploadComplete={handleLogoUploadComplete}
          disabled={!isEditable}
        />
      </div>

      {/* Gallery */}
      <div>
        <h3 className="font-medium mb-2">Галерея</h3>
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
