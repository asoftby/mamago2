import prisma from "@/lib/prisma";

/**
 * Для ленты «Куда пойти» хаб может включать не только сам город, но и связанные населённые пункты
 * (например Минск + Минская область), без смены URL — пользователь по-прежнему на /minsk/kuda.
 *
 * Ключ — slug города-хаба из URL; значение — дополнительные slug городов из справочника `City`.
 * Сам хаб в список не дублируем: он берётся из текущей страницы.
 */
export const DISCOVERY_HUB_EXTRA_CITY_SLUGS: Readonly<Record<string, readonly string[]>> = {
  minsk: ["minskaya-oblast", "marina-gorka"],
};

export async function resolveKudaDiscoveryCityIds(
  hubCitySlug: string,
  hubCityId: string,
): Promise<{ primaryCityId: string; expandedCityIds: string[] }> {
  const extras = DISCOVERY_HUB_EXTRA_CITY_SLUGS[hubCitySlug];
  if (!extras?.length) {
    return { primaryCityId: hubCityId, expandedCityIds: [hubCityId] };
  }

  const slugs = [hubCitySlug, ...extras];
  const rows = await prisma.city.findMany({
    where: { slug: { in: slugs } },
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
  if (!primary) {
    return { primaryCityId: hubCityId, expandedCityIds: [hubCityId] };
  }
  if (expandedCityIds.length === 0) {
    return { primaryCityId: hubCityId, expandedCityIds: [hubCityId] };
  }
  return { primaryCityId: primary, expandedCityIds };
}
