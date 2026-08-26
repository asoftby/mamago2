"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOptionalCity } from "@/contexts/CityContext";
import type { DiscoveryFilters } from "@/features/filters/discovery/filters.store";
import { usePublicCityOptions } from "@/lib/city/usePublicCityOptions";
import { DEFAULT_CITY_SLUG } from "@/lib/intent";

type FilterOption = { value: string; label: string };
type FilterPatch = Partial<DiscoveryFilters>;

interface LocationPanelProps {
  variant?: "default" | "cityHub";
  allowCitySelection?: boolean;
  citySlug: string;
  selectedCitySlug?: string;
  onCityPick?: (slug: string) => void;
  searchText: string;
  onSearchTextChange: (text: string) => void;
  onClose: () => void;
  applied: DiscoveryFilters;
  actions: { setDraft: (patch: FilterPatch) => void };
  apiOptions: { metros: FilterOption[]; districts: FilterOption[] };
}

/**
 * Global header location scope is city-only.
 * District and metro are section-specific refinements and live in EventAdvancedFilters.
 * Legacy geo filter props stay in the contract so existing callers do not need a parallel API.
 */
export function LocationPanel({
  citySlug,
  selectedCitySlug,
  onCityPick,
  onClose,
  actions,
}: LocationPanelProps) {
  const router = useRouter();
  const cityCtx = useOptionalCity();
  const { cities } = usePublicCityOptions();
  const [showCityList, setShowCityList] = useState(false);

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

  const selectedCityName =
    cityOptions.find((city) => city.slug === activeCitySlug)?.name ?? activeCitySlug;

  const handleCitySelect = (slug: string) => {
    if (slug === activeCitySlug) {
      setShowCityList(false);
      return;
    }

    // Geo refinements belong to the previous city and must not leak across city changes.
    actions.setDraft({ nearby: false, metro: null, district: null });

    if (onCityPick) {
      onCityPick(slug);
      setShowCityList(false);
      return;
    }

    if (cityCtx?.setCity) {
      cityCtx.setCity(slug);
    } else {
      router.push(`/${slug}`);
    }
    setShowCityList(false);
    onClose();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
      <div className="p-6">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowCityList((value) => !value)}
            className="flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors hover:bg-gray-50"
            aria-expanded={showCityList}
            aria-haspopup="listbox"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <MapPin className="h-5 w-5 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900">{selectedCityName}</div>
              <div className="text-sm text-gray-500">Сменить город</div>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-gray-400 transition-transform duration-200",
                showCityList && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          {showCityList ? (
            <div
              className="ml-14 max-h-56 space-y-1 overflow-y-auto rounded-lg bg-white p-2"
              role="listbox"
              aria-label="Выбор города"
            >
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
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      selected
                        ? "bg-[#EF8759]/10 text-[#EF8759]"
                        : "text-gray-700 hover:bg-gray-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{city.name}</span>
                      <span className="text-xs text-gray-500">Весь город</span>
                    </span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-[#EF8759]" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
