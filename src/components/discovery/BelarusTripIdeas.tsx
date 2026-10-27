import Link from "next/link";
import { listAvailableTerritories } from "@/server/territory/listAvailableTerritories";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { countKudaDiscoveryEvents } from "@/server/discovery/kudaDiscoveryFeed";
import { resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";

type Params = Record<string, string | string[] | undefined>;

export async function BelarusTripIdeas({ searchParams }: { searchParams: Params }) {
  const first = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const preset = first("preset");
  const filters = {
    categorySlugs: first("category")?.split(",").filter(Boolean) ?? [],
    genreSlugs: first("genre")?.split(",").filter(Boolean) ?? [],
    occasionSlug: first("occasion") === "halloween" ? "halloween" : null,
    dateRange: resolveEventDateRange({
      preset: preset === "TODAY" || preset === "TOMORROW" || preset === "WEEKEND" ? preset : null,
      from: first("from") ?? first("dateFrom"),
      to: first("to") ?? first("dateTo"),
    }),
    free: first("free") === "true",
    priceMin: first("priceMin") && Number.isFinite(Number(first("priceMin"))) ? Number(first("priceMin")) : null,
    priceMax: first("priceMax") && Number.isFinite(Number(first("priceMax"))) ? Number(first("priceMax")) : null,
    districtId: null,
    metroId: null,
    adultOnly: first("adultOnly") === "true",
  };
  const available = await listAvailableTerritories("kuda");
  const regions = available.territories.filter((t) => t.type === "REGION" && t.supported && t.counts.events > 0);
  const counted = await Promise.all(regions.map(async (region) => {
    const city = await findCityBySlug(region.slug);
    if (!city) return { region, count: 0 };
    const count = await countKudaDiscoveryEvents(city.id, city.slug, {
      explicitTerritorySlug: region.slug,
      format: parseActivityFormatQuery(first("format") ?? null),
      eventFilters: filters,
    });
    return { region, count };
  }));
  const suggestions = counted.filter((item) => item.count > 0).sort((a,b) => b.count - a.count || a.region.name.localeCompare(b.region.name, "ru"));
  const preserved = new URLSearchParams();
  for (const [key,value] of Object.entries(searchParams)) {
    // Another territory is a new result set: start from its first listing page.
    if (["city","explore","district","metro","page"].includes(key) || value == null) continue;
    if (Array.isArray(value)) value.forEach(v => preserved.append(key,v));
    else preserved.set(key,value);
  }
  preserved.set("explore","1");
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Куда поехать на выходные?</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Выберите направление по подходящим событиям. Регионы с результатами показаны первыми;
        внутри региона сохранятся выбранные даты и фильтры.
      </p>
      {suggestions.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-6">
          <p>По выбранным условиям подходящих событий не найдено.</p>
          <Link href="/belarus/events?explore=1" className="mt-3 inline-block text-sm font-semibold text-primary underline">Сбросить уточнения</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map(({region,count}) => (
            <Link key={region.id} href={`/${region.slug}/events?${preserved.toString()}`}
              className="group flex min-h-40 flex-col justify-between rounded-2xl border bg-white p-5 transition-colors hover:border-primary/40 hover:bg-gray-50">
              <div>
                <h2 className="text-lg font-semibold">{region.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {count} {count % 10 === 1 && count % 100 !== 11 ? "событие" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "события" : "событий"} по выбранным условиям
                </p>
              </div>
              <span className="mt-5 text-sm font-semibold text-primary">Посмотреть регион →</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
