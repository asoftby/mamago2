"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { getOfferTypeSelection } from "../offerTypeChoices";
import type { OfferFormData, OfferPlacementKey } from "../types";

const SECTIONS: Array<{ key: OfferPlacementKey; label: string }> = [
  { key: "WHERE_TO_GO", label: "Куда пойти" },
  { key: "CLASSES", label: "Занятия" },
  { key: "BIRTHDAY", label: "Праздники" },
  { key: "CAMPS", label: "Лагеря" },
];

interface AdditionalPlacementsProps {
  data: OfferFormData;
  onChange: (patch: Partial<OfferFormData>) => void;
  isEditable: boolean;
}

/** Additional discovery sections are voluntary. Primary section is set in step 1. */
export function AdditionalPlacements({ data, onChange, isEditable }: AdditionalPlacementsProps) {
  const primary = data.productType
    ? getOfferTypeSelection(data.productType).requestedPlacements[0]
    : null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Другие разделы каталога</p>
      <p className="text-xs text-muted-foreground">Основной раздел уже выбран. Остальные — по желанию.</p>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {SECTIONS.map((section) => (
          <label key={section.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={data.requestedPlacements.includes(section.key)}
              disabled={!isEditable || section.key === primary}
              onCheckedChange={(checked) => {
                if (section.key === primary) return;
                const updated = checked === true
                  ? Array.from(new Set([...data.requestedPlacements, section.key]))
                  : data.requestedPlacements.filter((key) => key !== section.key);
                onChange({ requestedPlacements: updated });
              }}
            />
            <span>{section.label}{section.key === primary ? " (основной)" : ""}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
