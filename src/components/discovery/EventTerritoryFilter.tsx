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

export function EventTerritoryFilter({ onApply, onBeforeNavigate, filters }: { onApply?: () => void; onBeforeNavigate: () => void; filters: DiscoveryFilters }) {
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
  const [expanded, setExpanded] = React.useState(false);

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
  const activeRegionId = regionId;
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
    onBeforeNavigate();
    router.push(`/${slug}/events?${next.toString()}`);
    onApply?.();
  }

  const chosen = items.find((item) => item.slug === selectedSlug);
  const currentLabel = selectedSlug === "belarus" ? "Вся Беларусь"
    : chosen?.name ?? (listingCity === "minsk" ? "Минск и область" : listingCity);

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="event-territory-options"
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 text-left text-sm font-medium text-foreground hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="min-w-0 truncate">{currentLabel}</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={expanded ? "shrink-0 rotate-180" : "shrink-0"}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div id="event-territory-options" className="space-y-3 rounded-xl border border-border bg-white p-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти город или область"
            aria-label="Найти город или область"
            className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary"
          />
          {loading && <p className="text-sm text-muted-foreground">Загрузка регионов…</p>}
          {error && <p role="alert" className="text-sm text-muted-foreground">Не удалось загрузить регионы</p>}
          {!loading && !error && (
            <div className="max-h-60 space-y-1 overflow-y-auto">
              <button type="button" onClick={() => setSelection("belarus")}
                aria-pressed={selectedSlug === "belarus"}
                className={`min-h-11 w-full rounded-lg px-3 text-left text-sm ${selectedSlug === "belarus" ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"}`}>
                Вся Беларусь
              </button>
              {matchesQuery ? (
                matching.length ? matching.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelection(item.slug)}
                    aria-pressed={selectedSlug === item.slug}
                    className={`min-h-11 w-full rounded-lg px-3 text-left text-sm ${selectedSlug === item.slug ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"}`}>
                    {item.name}
                  </button>
                )) : <p className="px-3 py-2 text-sm text-muted-foreground">Ничего не найдено</p>
              ) : regions.map((region) => (
                <div key={region.id}>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => { setRegionId(region.id); setSelection(region.slug); }}
                      aria-pressed={selectedSlug === region.slug}
                      className={`min-h-11 min-w-0 flex-1 rounded-lg px-3 text-left text-sm ${selectedSlug === region.slug ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"}`}>
                      {region.name}
                    </button>
                    <button type="button" aria-label={`Показать города: ${region.name}`}
                      aria-expanded={activeRegionId === region.id}
                      onClick={() => setRegionId(activeRegionId === region.id ? null : region.id)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted/40">⌄</button>
                  </div>
                  {activeRegionId === region.id && (
                    <div className="ml-4 space-y-1 border-l border-border pl-3">
                      {cities.map((city) => (
                        <button key={city.id} type="button" onClick={() => setSelection(city.slug)}
                          aria-pressed={selectedSlug === city.slug}
                          className={`min-h-10 w-full rounded-lg px-3 text-left text-sm ${selectedSlug === city.slug ? "bg-primary/10 font-semibold text-primary" : "hover:bg-muted/40"}`}>
                          {city.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button type="button" disabled={!selection || (selection === currentSlug && params.get("explore") === "1")}
            onClick={() => selection && navigate(selection)}
            className="min-h-11 w-full rounded-full bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            Применить
          </button>
        </div>
      )}
    </div>
  );
}
