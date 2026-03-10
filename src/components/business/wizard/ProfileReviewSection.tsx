"use client";

import { ReviewSection, ReviewField } from "./ReviewSection";
import { getProfileStatus, formatAgeTags, formatVisitFormats, formatActivityTypes } from "@/lib/placeReviewUtils";
import type { PlaceWithImages } from "@/app/business/(protected)/places/[id]/edit/types";

interface ProfileReviewSectionProps {
  place: PlaceWithImages;
  onEdit: () => void;
}

export function ProfileReviewSection({ place, onEdit }: ProfileReviewSectionProps) {
  const status = getProfileStatus(place);

  return (
    <ReviewSection
      title="Профиль"
      status={status}
      onEdit={onEdit}
    >
      <dl className="space-y-3">
        <ReviewField 
          label="Название" 
          value={place.title} 
        />
        
        <ReviewField 
          label="Категория" 
          value={place.category} 
        />
        
        <ReviewField 
          label="Краткое описание" 
          value={place.shortDesc} 
        />
        
        <ReviewField 
          label="Полное описание" 
          value={place.description}
          multiline
        />
        
        <ReviewField 
          label="Возрастные группы" 
          value={formatAgeTags(place.ageTags)} 
        />
        
        <ReviewField 
          label="Форматы посещения" 
          value={formatVisitFormats(place.visitFormats)} 
        />
        
        <ReviewField 
          label="Типы активностей" 
          value={formatActivityTypes(place.activityTypes)} 
        />
      </dl>
    </ReviewSection>
  );
}