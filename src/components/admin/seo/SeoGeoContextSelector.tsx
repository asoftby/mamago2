"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SeoGeoSelectorOption } from "@/lib/admin/seo/geo";
import type { SeoMarketViewScope } from "@/lib/admin/seo/geo/seoMarket";
import { MapPin } from "lucide-react";
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

  const cities = options.filter((o) => o.group === "city");
  const regions = options.filter((o) => o.group === "region");
  const countries = options.filter((o) => o.group === "country");
  const special = options.filter((o) => o.group === "special");

  async function onChange(next: string) {
    startTransition(async () => {
      await fetch("/api/admin/seo/geo-context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: next }),
      });
      router.refresh();
    });
  }

  async function onViewScope(next: SeoMarketViewScope) {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              SEO-рынок
            </p>
            <p
              className="truncate text-sm font-semibold text-gray-900"
              title={marketLabel}
            >
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
        <div className="w-full shrink-0 sm:ml-auto sm:w-auto sm:min-w-[200px] sm:max-w-[280px]">
          <Select value={token} onValueChange={onChange} disabled={pending}>
            <SelectTrigger
              className="h-9 w-full bg-white sm:w-[240px]"
              aria-label="Выбор SEO-рынка"
            >
              <SelectValue placeholder="Выберите рынок" />
            </SelectTrigger>
            <SelectContent align="end">
              {special.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Обзор</SelectLabel>
                  {special.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {cities.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Города</SelectLabel>
                  {cities.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                      {o.group === "city" && o.regionName
                        ? ` · ${o.regionName}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {regions.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Регионы</SelectLabel>
                  {regions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {countries.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Страна</SelectLabel>
                  {countries.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </div>

      {supportsMarketScopes ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Срез SEO-рынка"
        >
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
      ) : null}
    </div>
  );
}
