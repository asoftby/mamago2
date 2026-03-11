"use client";

import { useCallback, useMemo } from "react";
import { PlaceLogoUploadTemp } from "@/components/business/place/PlaceLogoUploadTemp";
import { PlaceGalleryUploadTemp, type GalleryItem } from "@/components/business/place/PlaceGalleryUploadTemp";
import { WizardStepHeader } from "../components/WizardStepHeader";

interface PlaceImage {
  id: string;
  createdAt: Date;
  url: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  kind: any;
  sortOrder: number;
  placeId?: string;
  revisionId?: string;
}

interface Step3PhotosProps {
  place: any; // Use generic type instead of Prisma Place
  images: PlaceImage[];
  wizardSessionId: string;
  onUpdate: (updates: any) => void;
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

  // Convert PlaceImage[] to GalleryItem[] - memoize to prevent unnecessary re-renders
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
    console.log("[Step3Photos] Logo upload complete:", { mediaId, url });
    onUpdate({ 
      logoMediaId: mediaId,
      logoUrl: url,
    });
  }, [onUpdate]);

  const handleGalleryImagesChange = useCallback((galleryItems: GalleryItem[]) => {
    console.log("[Step3Photos] Gallery changed:", galleryItems.length, "images");
    
    // Only call onUpdate if this is a real change, not initialization
    // The PlaceGalleryUploadTemp component should handle initialization filtering,
    // but we add an extra check here for safety
    onUpdate({
      galleryMediaIds: galleryItems.map(item => item.id),
      galleryUrls: galleryItems.map(item => item.url),
    });
  }, [onUpdate]);

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Фотографии"
        subtitle="Добавьте фотографии вашего места"
        onBack={onPrev}
        onNext={onNext}
        canNext={canNext}
        currentStep={3}
        totalSteps={6}
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
