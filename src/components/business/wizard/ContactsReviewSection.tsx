"use client";

import { ReviewSection, ReviewField } from "./ReviewSection";
import { getContactsStatus } from "@/lib/placeReviewUtils";
import { ExternalLink } from "lucide-react";
import type { PlaceWithImages } from "@/app/business/(protected)/places/[id]/edit/types";

interface ContactsReviewSectionProps {
  place: PlaceWithImages;
  onEdit: () => void;
}

export function ContactsReviewSection({ place, onEdit }: ContactsReviewSectionProps) {
  const status = getContactsStatus(place);

  return (
    <ReviewSection
      title="Контакты"
      status={status}
      onEdit={onEdit}
    >
      <dl className="space-y-3">
        <ReviewField 
          label="Телефон" 
          value={place.phone} 
        />
        
        <ReviewField 
          label="Веб-сайт" 
          value={place.website} 
        />
        
        <div className="space-y-1">
          <dt className="text-sm font-medium text-gray-600">Instagram:</dt>
          <dd className="text-sm">
            {place.instagramHandle ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-900">@{place.instagramHandle}</span>
                {place.instagramUrl && (
                  <a
                    href={place.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <span className="text-gray-400 italic">Не указано</span>
            )}
          </dd>
        </div>
      </dl>
    </ReviewSection>
  );
}