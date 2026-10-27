"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEventListingCitySlug } from "@/lib/city/useEventListingCitySlug";
import { serializeAppliedToSearchParams, type DiscoveryFilters } from "@/features/filters/discovery/filters.store";

type Territory = {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  type: "COUNTRY" | "REGION" | "CITY";
  supported: boolean;
  counts: { events: number };
};
type Available = { territories: Territory[] };

export function EventTerritoryFilter({ onApply, filters }: { onApply?: () => void; filters: DiscoveryFilters }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const listingCity = useEventListingCitySlug();
  const [items, setItems] = React.useState<Territory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [regionId, setRegionId] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch("/api/territories/available?section=kuda", { signal: controller.signal })
      .then((res) => { if (!res.ok) throw new Error("Territories unavailable"); return res.json() as Promise<Available>; })
      .then((data) => { setItems(data.territories); setError(false); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const regions = items.filter((item) => item.type === "REGION" && item.supported && item.counts.events > 0);
  const selected = items.find((item) => item.slug === listingCity && item.type !== "COUNTRY");
  const activeRegionId = regionId ?? (selected?.type === "REGION" ? selected.id : selected?.parentId ?? regions[0]?.id ?? null);
  const activeRegion = regions.find((region) => region.id === activeRegionId);
  const cities = items.filter((item) => item.type === "CITY" && item.parentId === activeRegionId && item.supported && item.counts.events > 0);
  const matchesQuery = query.trim().toLocaleLowerCase("ru");
  const matching = matchesQuery
    ? items.filter((item) => item.type !== "COUNTRY" && item.supported && item.counts.events > 0 && item.name.toLocaleLowerCase("ru").includes(matchesQuery))
    : [];
  const currentSlug = pathname?.split("/")[1];
  const selectedSlug = selection ?? selected?.slug ?? listingCity;

  function navigate(slug: string) {
    // Preserve existing age/date/category filters and the family's home-city cookie.
    // Geography-specific district/metro are invalid when switching territories.
    const next = serializeAppliedToSearchParams(new URLSearchParams(params.toString()), filters);
    next.delete("city");
    next.delete("district");
    next.delete("metro");
    next.set("explore", "1");
    router.push(`/${slug}/events?${next.toString()}`);
    onApply?.();
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">Где искать</legend>
      <p className="text-xs text-muted-foreground">Домашний город в шапке не изменится.</p>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Найти город или область"
        aria-label="Найти город или область"
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary"
      />
      {loading && <p className="text-sm text-muted-foreground">Загрузка регионов…</p>}
      {error && <p role="alert" className="text-sm text-muted-foreground">Не удалось загрузить регионы. Откройте фильтры повторно.</p>}
      {!loading && !error && (
        <>
          <button type="button" onClick={() => setSelection("belarus")}
            aria-pressed={selectedSlug === "belarus"}
            className={`min-h-11 w-full rounded-xl border px-3 text-left text-sm font-semibold ${selectedSlug === "belarus" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 hover:bg-gray-50"}`}>
            Не знаю, куда поехать · Вся Беларусь
          </button>
          {matchesQuery ? (
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {matching.length === 0 && <p className="text-sm text-muted-foreground">Ничего не найдено</p>}
              {matching.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelection(item.slug)}
                  aria-pressed={selectedSlug === item.slug}
                  className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm ${selectedSlug === item.slug ? "bg-primary/10 font-semibold text-primary" : "hover:bg-gray-50"}`}>
                  <span>{item.name}</span><span className="text-xs text-muted-foreground">{item.counts.events}</span>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {regions.map((region) => (
                  <button key={region.id} type="button" onClick={() => { setRegionId(region.id); setSelection(region.slug); }}
                    aria-expanded={activeRegionId === region.id}
                    className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm ${activeRegionId === region.id ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}>
                    <span>{region.name}</span><span className="text-xs text-muted-foreground">{region.counts.events}</span>
                  </button>
                ))}
              </div>
              {activeRegion && (
                <div className="space-y-1 border-l-2 border-gray-100 pl-3">
                  <button type="button" onClick={() => setSelection(activeRegion.slug)}
                    aria-pressed={selectedSlug === activeRegion.slug}
                    className={`min-h-11 w-full rounded-xl px-3 text-left text-sm ${selectedSlug === activeRegion.slug ? "bg-primary/10 font-semibold text-primary" : "hover:bg-gray-50"}`}>
                    Вся область
                  </button>
                  {cities.map((city) => (
                    <button key={city.id} type="button" onClick={() => setSelection(city.slug)}
                      aria-pressed={selectedSlug === city.slug}
                      className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm ${selectedSlug === city.slug ? "bg-primary/10 font-semibold text-primary" : "hover:bg-gray-50"}`}>
                      <span>{city.name}</span><span className="text-xs text-muted-foreground">{city.counts.events}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <button type="button" disabled={!selection || (selection === currentSlug && params.get("explore") === "1")}
            onClick={() => selection && navigate(selection)}
            className="min-h-11 w-full rounded-full bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            Применить территорию
          </button>
        </>
      )}
    </fieldset>
  );
}
