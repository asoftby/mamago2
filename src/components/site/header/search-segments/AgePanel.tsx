"use client";

import { ChipsRow, type ChipItem } from "@/components/ui/chips-row";
import { AGE_GROUPS } from "@/features/filters/age/ageGroups";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";

interface AgePanelProps {
  onClose: () => void;
  applied: DiscoveryFilters;
  actions: { setDraft: (patch: Partial<DiscoveryFilters>) => void };
  /** Без карточки, рамки и заголовка — внутри моб. аккордеона */
  embedded?: boolean;
}

export function AgePanel({
  applied,
  actions,
  embedded = false,
}: AgePanelProps) {
  const handleAgeToggle = (ageValue: string) => {
    const currentAges = applied.age ?? [];
    let newAges: string[];

    if (currentAges.includes(ageValue)) {
      newAges = currentAges.filter((age: string) => age !== ageValue);
    } else {
      newAges = [...currentAges, ageValue];
    }

    actions.setDraft({ age: newAges });
  };

  const items: ChipItem[] = AGE_GROUPS.map((ageGroup) => ({
    id: ageGroup.value,
    label: ageGroup.label,
    active: applied.age.includes(ageGroup.value),
    onClick: () => handleAgeToggle(ageGroup.value),
  }));

  const chips = (
    <ChipsRow
      layout="masonry"
      aria-label="Возраст детей"
      items={items}
    />
  );

  if (embedded) {
    return (
      <div className="p-[15px]">
        {chips}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
      <div className="p-4 sm:p-6">
        <h3 className="mb-3 text-sm font-medium text-gray-900 sm:mb-4">
          Возраст детей
        </h3>
        {chips}
      </div>
    </div>
  );
}
