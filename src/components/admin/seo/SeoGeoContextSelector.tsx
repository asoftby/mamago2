"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SEO_GEO_ALL_CITIES_VALUE,
  SEO_GEO_EMPTY_VALUE,
  buildSeoGeoSelectorModel,
} from "@/lib/admin/seo/geo/selectorModel";
import type { SeoGeoSelectorOption } from "@/lib/admin/seo/geo";
import type { SeoMarketViewScope } from "@/lib/admin/seo/geo/seoMarket";
import { cn } from "@/lib/utils";

interface SeoGeoContextSelectorProps {
  token: string;
  marketLabel: string;
  cityName: string | null;
  regionName: string | null;
  viewScope: SeoMarketViewScope;
  supportsMarketScopes: boolean;
  options: SeoGeoSelectorOption[];
}

const VIEW_CHIPS: Array<{ value: SeoMarketViewScope; label: string }> = [
  { value: "market", label: "Весь рынок" },
  { value: "city", label: "Город" },
  { value: "region", label: "Регион" },
  { value: "country", label: "Страна" },
];

export function SeoGeoContextSelector({
  token,
  marketLabel,
  cityName,
  regionName,
  viewScope,
  supportsMarketScopes,
  options,
}: SeoGeoContextSelectorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const model = buildSeoGeoSelectorModel(token, options);
  const regions = options.filter((option) => option.group === "region");
  const countries = options.filter((option) => option.group === "country");

  function setContext(next: string) {
    if (next === SEO_GEO_EMPTY_VALUE) return;
    startTransition(async () => {
      await fetch("/api/admin/seo/geo-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: next }),
      });
      router.refresh();
    });
  }

  function setCity(next: string) {
    if (next === SEO_GEO_ALL_CITIES_VALUE) {
      setContext(model.regionValue);
      return;
    }
    setContext(next);
  }

  function postContext(tokenValue: "all") {
    startTransition(async () => {
      await fetch("/api/admin/seo/geo-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenValue }),
      });
      router.refresh();
    });
  }

  function onViewScope(next: SeoMarketViewScope) {
    startTransition(async () => {
      await fetch("/api/admin/seo/geo-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ marketView: next }),
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">SEO-рынок</p>
            <p className="truncate text-sm font-semibold text-gray-900" title={marketLabel}>
              {marketLabel}
            </p>
            {(cityName || regionName) && (
              <p className="mt-1 text-xs text-gray-500">
                {cityName ? <>Город: {cityName}</> : null}
                {cityName && regionName ? " · " : null}
                {regionName ? <>Регион: {regionName}</> : null}
              </p>
            )}
          </div>
        </div>

        <div
          className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[500px]"
          data-testid="seo-geo-controls"
        >
          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>Город</span>
            <Select value={model.cityValue} onValueChange={setCity} disabled={pending}>
              <SelectTrigger className="h-9 w-full bg-white lg:w-[240px]" aria-label="Город">
                <SelectValue placeholder="Все города" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={SEO_GEO_EMPTY_VALUE}>Выберите город</SelectItem>
                {model.regionValue !== SEO_GEO_EMPTY_VALUE ? (
                  <SelectItem value={SEO_GEO_ALL_CITIES_VALUE}>Все города региона</SelectItem>
                ) : null}
                {model.cities.map((city) => (
                  <SelectItem key={city.value} value={city.value}>{city.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-1 text-xs font-medium text-gray-600">
            <span>Регион</span>
            <Select value={model.regionValue} onValueChange={setContext} disabled={pending}>
              <SelectTrigger className="h-9 w-full bg-white lg:w-[240px]" aria-label="Регион">
                <SelectValue placeholder="Выберите регион" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={SEO_GEO_EMPTY_VALUE}>Выберите регион</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region.value} value={region.value}>{region.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        {supportsMarketScopes ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Срез SEO-рынка">
            {VIEW_CHIPS.map((chip) => {
              const active = viewScope === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  disabled={pending}
                  onClick={() => onViewScope(chip.value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:text-gray-900",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        ) : <div />}

        <div className="flex items-center gap-2">
          <Select value={model.countryValue} onValueChange={setContext} disabled={pending}>
            <SelectTrigger className="h-8 w-[170px] bg-white text-xs" aria-label="Страна">
              <SelectValue placeholder="Страна" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={SEO_GEO_EMPTY_VALUE}>Выберите страну</SelectItem>
              {countries.map((country) => (
                <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
            disabled={pending || token === "all"}
            onClick={() => postContext("all")}
          >
            Сбросить
          </button>
        </div>
      </div>
    </div>
  );
}
