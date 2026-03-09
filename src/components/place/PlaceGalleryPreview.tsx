"use client";

import { useState } from "react";
import { Grid3x3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceGalleryLightbox } from "./PlaceGalleryLightbox";

interface PlaceGalleryPreviewProps {
  images: Array<{
    id: string;
    url: string;
  }>;
}

export function PlaceGalleryPreview({ images }: PlaceGalleryPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Show max 3 images in preview
  const previewImages = images.slice(0, 3);
  const remainingCount = images.length - 3;
  const hasMore = remainingCount > 0;

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Фотографии
        </h2>

        {/* Preview Grid */}
        <div
          className={cn(
            "grid gap-4",
            images.length === 1 && "grid-cols-1",
            images.length === 2 && "grid-cols-2",
            images.length >= 3 && "grid-cols-3"
          )}
        >
          {previewImages.map((image, index) => {
            const isLast = index === previewImages.length - 1;
            const showOverlay = isLast && hasMore;

            return (
              <button
                key={image.id}
                onClick={() => openLightbox(index)}
                className="relative group overflow-hidden rounded-lg aspect-[4/3] bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <img
                  src={image.url}
                  alt={`Фото ${index + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />

                {/* Overlay for remaining photos */}
                {showOverlay && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-opacity group-hover:bg-black/70">
                    <Grid3x3 className="h-8 w-8 mb-2" />
                    <span className="text-2xl font-semibold">
                      +{remainingCount}
                    </span>
                  </div>
                )}

                {/* Hover effect for all images */}
                {!showOverlay && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <PlaceGalleryLightbox
        images={images}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
