"use client";

import { ReviewSection, ReviewField } from "./ReviewSection";
import { getOpeningHoursStatus } from "@/lib/placeReviewUtils";
import { generateSummary } from "@/lib/openingHours";
import type { OpeningHoursData } from "@/components/openingHours";

interface OpeningHoursReviewSectionProps {
  openingHoursData: OpeningHoursData | null;
  onEdit: () => void;
}

export function OpeningHoursReviewSection({ openingHoursData, onEdit }: OpeningHoursReviewSectionProps) {
  const status = getOpeningHoursStatus(openingHoursData);

  // Get mode display text
  const getModeText = (mode: string | undefined) => {
    switch (mode) {
      case "ALWAYS_OPEN":
        return "Круглосуточно";
      case "CLOSED":
        return "Закрыто";
      case "BY_APPOINTMENT":
        return "По записи";
      case "SCHEDULED":
        return "По расписанию";
      default:
        return "Не указано";
    }
  };

  // Generate schedule summary
  const scheduleSummary = openingHoursData ? generateSummary(openingHoursData) : null;

  return (
    <ReviewSection
      title="Режим работы"
      status={status}
      onEdit={onEdit}
    >
      <dl className="space-y-3">
        <ReviewField 
          label="Тип режима" 
          value={getModeText(openingHoursData?.mode)} 
        />
        
        {scheduleSummary && (
          <div className="space-y-1">
            <dt className="text-sm font-medium text-gray-600">Расписание:</dt>
            <dd className="text-sm text-gray-900">
              <div className="space-y-1">
                {scheduleSummary.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            </dd>
          </div>
        )}
        
        {openingHoursData?.note && (
          <ReviewField 
            label="Примечание" 
            value={openingHoursData.note}
            multiline 
          />
        )}
      </dl>
    </ReviewSection>
  );
}