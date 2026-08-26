"use client";

import { useMemo, useState } from "react";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCity } from "@/contexts/CityContext";
import { getCityLocativePhrase } from "@/lib/city/cityDisplayNames";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { usePublicCityOptions } from "@/lib/city/usePublicCityOptions";
import { DEFAULT_CITY_SLUG } from "@/lib/intent";

type FilterOption = { value: string; label: string };
type FilterPatch = Partial<DiscoveryFilters>;

interface MobileLocationPanelProps {
  variant?: "default" | "cityHub";
  citySlug: string;
  selectedCitySlug?: string;
  onCityPick?: (slug: string) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onClose: () => void;
  draft: DiscoveryFilters;
  setDraft: (patch: FilterPatch) => void;
  actions: { setDraft: (patch: FilterPatch) => void };
  apiOptions: { metros: FilterOption[]; districts: FilterOption[] };
}

/**
 * Global mobile search uses city as the only location scope.
 * District and metro remain available in the section-specific advanced filters.
 */
export function MobileLocationPanel({
  citySlug,
  selectedCitySlug,
  onCityPick,
  onClose,
  setDraft,
}: MobileLocationPanelProps) {
  const { setCity } = useCity();
  const { cities } = usePublicCityOptions();
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const activeCitySlug = selectedCitySlug ?? citySlug;
  const cityOptions = useMemo(() => {
    const map = new Map(cities.map((city) => [city.slug, city]));
    if (!map.has(DEFAULT_CITY_SLUG)) {
      map.set(DEFAULT_CITY_SLUG, {
        id: DEFAULT_CITY_SLUG,
        slug: DEFAULT_CITY_SLUG,
        name: "Минск",
      });
    }
    if (!map.has(activeCitySlug)) {
      map.set(activeCitySlug, {
        id: activeCitySlug,
        slug: activeCitySlug,
        name: activeCitySlug,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.slug === DEFAULT_CITY_SLUG) return -1;
      if (b.slug === DEFAULT_CITY_SLUG) return 1;
      return a.name.localeCompare(b.name, "ru");
    });
  }, [cities, activeCitySlug]);

  const handleCitySelect = (slug: string) => {
    if (slug === activeCitySlug) {
      setCityPickerOpen(false);
      return;
    }

    // District/metro are refinements of the previous city, so clear them on city change.
    setDraft({ nearby: false, metro: null, district: null });

    if (onCityPick) {
      onCityPick(slug);
    } else {
      setCity(slug);
      onClose();
    }
    setCityPickerOpen(false);
  };

  return (
    <div className="min-w-0">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCityPickerOpen((open) => !open)}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left shadow-sm transition-colors",
            "border-[#EF8759]/25 hover:border-[#EF8759]/40",
            cityPickerOpen && "border-[#EF8759]/35",
          )}
          aria-expanded={cityPickerOpen}
          aria-haspopup="listbox"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100">
            <MapPin className="h-4 w-4 text-gray-500" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium text-gray-500">Где?</div>
            <div className="mt-0.5 text-sm font-normal leading-normal text-gray-700">
              {getCityLocativePhrase(activeCitySlug)}
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200",
              cityPickerOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {cityPickerOpen ? (
          <div
            className="rounded-xl border border-[#EBEBEB] bg-white/70 p-3"
            role="listbox"
            aria-label="Выбор города"
          >
            <p className="mb-2 px-0.5 text-[11px] font-medium text-gray-500">
              Город
            </p>
            <div className="space-y-1">
              {cityOptions.map((city) => {
                const selected = city.slug === activeCitySlug;
                return (
                  <button
                    key={city.slug}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleCitySelect(city.slug)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg p-2.5 text-left transition-colors",
                      selected ? "bg-white ring-1 ring-gray-200" : "hover:bg-white",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                        <MapPin className="h-3.5 w-3.5 text-gray-600" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">
                          {city.name}
                        </span>
                        <span className="text-xs text-gray-500">Весь город</span>
                      </span>
                    </span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
