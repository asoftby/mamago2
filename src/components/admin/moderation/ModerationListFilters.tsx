"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";

export type ModerationStatusFilterKind = "content" | "offer";

export interface ModerationListFiltersProps {
  cities: { id: string; name: string }[];
  /** Базовый путь без query, напр. `/admin/content/places` */
  basePath: string;
  /** `content` — как у мест (ContentStatus); `offer` — OfferStatus */
  statusFilter: ModerationStatusFilterKind;
  showTemporalFilter?: boolean;
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

const TEMPORAL_OPTIONS: FilterSelectOption[] = [
  { value: "active", label: "Актуально" },
  { value: "past", label: "Уже прошло" },
];

/**
 * Фильтры статуса и города — те же опции и стиль, что на списках контента (например `/admin/content/places`).
 */
function ModerationListFiltersInner({
  cities,
  basePath,
  statusFilter,
  showTemporalFilter = false,
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
  const columnsClass = showTemporalFilter ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className={cn("grid grid-cols-1 gap-3", columnsClass)}>
      <div>
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

      <div>
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

      {showTemporalFilter ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Актуальность
          </label>
          <FilterSelect
            value={searchParams.get("temporal") || ""}
            placeholder="Все события"
            options={TEMPORAL_OPTIONS}
            onChange={(v) => handleFilterChange("temporal", v)}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ModerationListFilters(props: ModerationListFiltersProps) {
  const columnsClass = props.showTemporalFilter ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <Suspense
      fallback={
        <div className={cn("grid grid-cols-1 gap-3", columnsClass)}>
          <div className="h-10 rounded-[12px] bg-muted/40 animate-pulse" />
          <div className="h-10 rounded-[12px] bg-muted/40 animate-pulse" />
          {props.showTemporalFilter ? (
            <div className="h-10 rounded-[12px] bg-muted/40 animate-pulse" />
          ) : null}
        </div>
      }
    >
      <ModerationListFiltersInner {...props} />
    </Suspense>
  );
}
