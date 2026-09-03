"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterSelect, type FilterSelectOption } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ModerationStatusFilterKind = "content" | "offer";

export interface ModerationListFiltersProps {
  cities: { id: string; name: string }[];
  /** Базовый путь без query, напр. `/admin/content/places` */
  basePath: string;
  /** `content` — как у мест (ContentStatus); `offer` — OfferStatus */
  statusFilter: ModerationStatusFilterKind;
  showTemporalFilter?: boolean;
  searchPlaceholder?: string;
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
 * Единая панель поиска и фильтров для списков контента.
 * Любое изменение фильтра сбрасывает `page`, чтобы пользователь не попадал
 * на пустую страницу старой пагинации после сужения выборки.
 */
function ModerationListFiltersInner({
  cities,
  basePath,
  statusFilter,
  showTemporalFilter = false,
  searchPlaceholder = "Название или slug",
}: ModerationListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const pushParams = (params: URLSearchParams) => {
    params.delete("page");
    const search = params.toString();
    router.push(search ? `${basePath}?${search}` : basePath);
  };

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    pushParams(params);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const normalized = query.trim();
    if (normalized) {
      params.set("q", normalized);
    } else {
      params.delete("q");
    }
    pushParams(params);
  };

  const statusOptions = statusFilter === "content" ? STATUS_CONTENT : STATUS_OFFER;
  const columnsClass = showTemporalFilter ? "md:grid-cols-4" : "md:grid-cols-3";

  return (
    <div className={cn("grid grid-cols-1 gap-3", columnsClass)}>
      <form onSubmit={handleSearchSubmit}>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${basePath}-search`}>
          Поиск
        </label>
        <div className="flex gap-2">
          <Input
            id={`${basePath}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0"
          />
          <Button type="submit" variant="outline" className="h-10 shrink-0">
            Найти
          </Button>
        </div>
      </form>

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
  const columnsClass = props.showTemporalFilter ? "md:grid-cols-4" : "md:grid-cols-3";

  return (
    <Suspense
      fallback={
        <div className={cn("grid grid-cols-1 gap-3", columnsClass)}>
          <div className="h-10 rounded-[12px] bg-muted/40 animate-pulse" />
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
