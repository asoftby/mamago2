import prisma from "@/lib/prisma";

export const ALL_BELARUS_REGIONS = "*";

export async function listBoostTargetRegions() {
  return prisma.region.findMany({
    where: { isActive: true, type: "OBLAST", country: { slug: "belarus", isActive: true } },
    select: { id: true, name: true, slug: true },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });
}

export async function validateBoostTargetRegions(input: string[]): Promise<string[]> {
  const targets = [...new Set(input)];
  if (targets.length > 6) throw new Error("Можно выбрать не более шести областей.");
  if (targets.includes(ALL_BELARUS_REGIONS)) {
    if (targets.length !== 1) throw new Error("Вся Беларусь выбирается отдельно от областей.");
    return targets;
  }
  if (targets.length === 0) return [];
  const allowed = new Set((await listBoostTargetRegions()).map((region) => region.id));
  if (targets.some((id) => !allowed.has(id))) throw new Error("Указан недоступный регион продвижения.");
  return targets;
}

export async function getDiscoveryRegionContext(cityId: string, citySlug: string) {
  const city = await prisma.city.findUnique({ where: { id: cityId }, select: { regionId: true, country: { select: { slug: true } } } });
  if (!city || city.country.slug !== "belarus") return null;
  if (city.regionId) return city.regionId;
  if (citySlug !== "minsk") return null;
  const minsk = await prisma.region.findFirst({ where: { country: { slug: "belarus" }, slug: "minskaya-oblast", isActive: true }, select: { id: true } });
  return minsk?.id ?? null;
}
