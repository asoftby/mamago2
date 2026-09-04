import { unstable_cache } from "next/cache";
import prisma from "@/lib/prisma";

/**
 * Для ленты «Куда пойти» хаб может включать не только сам город, но и связанные населённые пункты
 * (например Минск + Марьина Горка), без смены URL — пользователь по-прежнему на /minsk/kuda.
 *
 * Ключ — slug города-хаба из URL; значение — дополнительные slug городов из справочника `City`.
 * Сам хаб в список не дублируем: он берётся из текущей страницы.
 */
export const DISCOVERY_HUB_EXTRA_CITY_SLUGS: Readonly<Record<string, readonly string[]>> = {
  minsk: ["marina-gorka"],
};

export const DISCOVERY_HUB_CITY_IDS_REVALIDATE_SECONDS = 60 * 60;

type DiscoveryHubCityIds = {
  primaryCityId: string;
  expandedCityIds: string[];
};

function fallbackHubCityIds(hubCityId: string): DiscoveryHubCityIds {
  return { primaryCityId: hubCityId, expandedCityIds: [hubCityId] };
}

async function readKudaDiscoveryCityIds(
  hubCitySlug: string,
  hubCityId: string,
  extras: readonly string[],
): Promise<DiscoveryHubCityIds> {
  const slugs = [hubCitySlug, ...extras];
  const rows = await prisma.city.findMany({
    where: { slug: { in: slugs }, isLegacyNonCity: false },
    select: { id: true, slug: true },
  });

  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const expandedCityIds: string[] = [];
  const primary = bySlug.get(hubCitySlug);
  if (primary) expandedCityIds.push(primary);
  for (const s of extras) {
    const id = bySlug.get(s);
    if (id && !expandedCityIds.includes(id)) expandedCityIds.push(id);
  }
  if (!primary || expandedCityIds.length === 0) {
    return fallbackHubCityIds(hubCityId);
  }
  return { primaryCityId: primary, expandedCityIds };
}

export async function resolveKudaDiscoveryCityIds(
  hubCitySlug: string,
  hubCityId: string,
): Promise<DiscoveryHubCityIds> {
  const extras = DISCOVERY_HUB_EXTRA_CITY_SLUGS[hubCitySlug];
  if (!extras?.length) {
    // Most cities are not hubs: preserve the zero-DB fast path and avoid even
    // invoking the incremental cache for a value already present in the call.
    return fallbackHubCityIds(hubCityId);
  }

  return unstable_cache(
    () => readKudaDiscoveryCityIds(hubCitySlug, hubCityId, extras),
    ["discovery-hub-city-ids", hubCitySlug, hubCityId, ...extras],
    { revalidate: DISCOVERY_HUB_CITY_IDS_REVALIDATE_SECONDS },
  )();
}
