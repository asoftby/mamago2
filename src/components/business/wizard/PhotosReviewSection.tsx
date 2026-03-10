"use client";

import { ReviewSection, ReviewField } from "./ReviewSection";
import { getPhotosStatus } from "@/lib/placeReviewUtils";
import type { PlaceWithImages } from "@/app/business/(protected)/places/[id]/edit/types";
import Image from "next/image";

interface PhotosReviewSectionProps {
  place: PlaceWithImages;
  onEdit: () => void;
}

export function PhotosReviewSection({ place, onEdit }: PhotosReviewSectionProps) {
  const status = getPhotosStatus(place);
  
  // Find logo image
  const logoImage = place.images?.find(img => img.id === place.logoImageId);
  
  // Find cover image (first gallery image or first image)
  const coverImage = place.images?.find(img => img.kind === "GALLERY") || place.images?.[0];
  
  // Gallery images (excluding logo)
  const galleryImages = place.images?.filter(img => img.id !== place.logoImageId) || [];
  
  // Get first few thumbnails for preview
  const thumbnailImages = galleryImages.slice(0, 4);

  return (
    <ReviewSection
      title="Фото"
      status={status}
      onEdit={onEdit}
    >
      <div className="space-y-4">
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-gray-600 mb-2">Логотип:</dt>
            <dd>
              {logoImage ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border">
                  <Image
                    src={logoImage.url}
                    alt="Логотип"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">Не указано</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600 mb-2">Обложка:</dt>
            <dd>
              {coverImage ? (
                <div className="w-24 h-16 rounded-lg overflow-hidden border">
                  <Image
                    src={coverImage.url}
                    alt="Обложка"
                    width={96}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-400 italic">Не указано</span>
              )}
            </dd>
          </div>

          <ReviewField 
            label="Количество фото" 
            value={place.images?.length ? `${place.images.length} фото` : null} 
          />
        </dl>

        {thumbnailImages.length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-600 mb-2">Галерея:</dt>
            <dd className="flex gap-2 flex-wrap">
              {thumbnailImages.map((image) => (
                <div key={image.id} className="w-12 h-12 rounded overflow-hidden border">
                  <Image
                    src={image.url}
                    alt="Фото"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {galleryImages.length > 4 && (
                <div className="w-12 h-12 rounded border bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-600">+{galleryImages.length - 4}</span>
                </div>
              )}
            </dd>
          </div>
        )}
      </div>
    </ReviewSection>
  );
}