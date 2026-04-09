"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select";

export type ModerationStatusFilterKind = "content" | "offer";

export interface ModerationListFiltersProps {
  cities: { id: string; name: string }[];
  /** Базовый путь без query, напр. `/admin/content/places` */
  basePath: string;
  /** `content` — как у мест (ContentStatus); `offer` — OfferStatus */
  statusFilter: ModerationStatusFilterKind;
}

const STATUS_CONTENT: FilterSelectOption[] = [
  { value: "DRAFT", label: "Черновик" },
  { value: "PENDING", label: "На модерации" },
  { value: "PENDING_UPDATE", label: "Обновление на проверке" },
  { value: "PUBLISHED", label: "Опубликовано" },
  { value: "NEEDS_REVISION", label: "Требует правок" },
  { value: "REJECTED", label: "Отклонено" },
];

const STATUS_OFFER: FilterSelectOption[] = [
  { value: "DRAFT", label: "Черновик" },
  { value: "PENDING", label: "На модерации" },
  { value: "PUBLISHED", label: "Опубликовано" },
  { value: "REJECTED", label: "Отклонено" },
];

/**
 * Фильтры статуса и города — те же опции и стиль, что на списках контента (например `/admin/content/places`).
 */
function ModerationListFiltersInner({
  cities,
  basePath,
  statusFilter,
}: ModerationListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${basePath}?${params.toString()}`);
  };

  const statusOptions = statusFilter === "content" ? STATUS_CONTENT : STATUS_OFFER;

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Статус
        </label>
        <FilterSelect
          value={searchParams.get("status") || ""}
          placeholder="Все статусы"
          options={statusOptions}
          onChange={(v) => handleFilterChange("status", v)}
        />
      </div>

      <div className="flex-1">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Город
        </label>
        <FilterSelect
          value={searchParams.get("cityId") || ""}
          placeholder="Все города"
          options={cities.map((city) => ({ value: city.id, label: city.name }))}
          onChange={(v) => handleFilterChange("cityId", v)}
        />
      </div>
    </div>
  );
}

export function ModerationListFilters(props: ModerationListFiltersProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col md:flex-row gap-3">
          <div className="h-10 flex-1 rounded-[12px] bg-muted/40 animate-pulse" />
          <div className="h-10 flex-1 rounded-[12px] bg-muted/40 animate-pulse" />
        </div>
      }
    >
      <ModerationListFiltersInner {...props} />
    </Suspense>
  );
}
