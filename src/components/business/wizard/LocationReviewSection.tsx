"use client";

import { ReviewSection, ReviewField } from "./ReviewSection";
import { getLocationStatus, formatCoordinates } from "@/lib/placeReviewUtils";
import type { PlaceWithImages } from "@/app/business/(protected)/places/[id]/edit/types";

interface LocationReviewSectionProps {
  place: PlaceWithImages;
  onEdit: () => void;
}

export function LocationReviewSection({ place, onEdit }: LocationReviewSectionProps) {
  const status = getLocationStatus(place);

  // Get district name (could be from auto or manual)
  const districtName = (place as any)._districtName || 
    (place.districtAutoId ? "Автоопределенный район" : null) ||
    (place.districtManualId ? "Выбранный район" : null);

  // Get metro name (could be from auto or manual)  
  const metroName = (place as any)._metroName ||
    (place.metroAutoId ? "Автоопределенное метро" : null) ||
    (place.metroManualId ? "Выбранное метро" : null);

  return (
    <ReviewSection
      title="Локация"
      status={status}
      onEdit={onEdit}
    >
      <dl className="space-y-3">
        <ReviewField 
          label="Адрес" 
          value={place.formattedAddr} 
        />
        
        <ReviewField 
          label="Город" 
          value={(place as any)._cityName || (place.cityId ? "Указан" : null)} 
        />
        
        <ReviewField 
          label="Район" 
          value={districtName} 
        />
        
        <ReviewField 
          label="Метро" 
          value={metroName} 
        />
        
        <ReviewField 
          label="Координаты" 
          value={formatCoordinates(place.lat, place.lng)} 
        />
        
        {place.customAddress && (
          <ReviewField 
            label="Дополнительная информация" 
            value={place.customAddress}
            multiline 
          />
        )}
      </dl>
    </ReviewSection>
  );
}