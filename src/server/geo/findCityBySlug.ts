import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { DEFAULT_COUNTRY_ISO } from "@/server/geo/geoConstants";

function citySlugWhere(
  slug: string,
  opts?: { countryIsoCode?: string; onlyRealCities?: boolean; isActive?: boolean },
): Prisma.CityWhereInput {
  const iso = opts?.countryIsoCode ?? DEFAULT_COUNTRY_ISO;
  return {
    slug,
    country: { isoCode: iso },
    ...(opts?.onlyRealCities !== false ? { isLegacyNonCity: false } : {}),
    ...(opts?.isActive === true ? { isActive: true } : {}),
  };
}

/**
 * Public city lookup by slug (scoped to default country).
 * Replaces `prisma.city.findUnique({ where: { slug } })` after @@unique([countryId, slug]).
 */
export async function findCityBySlug(
  slug: string,
  opts?: {
    countryIsoCode?: string;
    onlyRealCities?: boolean;
    isActive?: boolean;
    select?: Prisma.CitySelect;
    include?: Prisma.CityInclude;
  },
) {
  const where = citySlugWhere(slug, opts);

  if (opts?.select) {
    return prisma.city.findFirst({ where, select: opts.select });
  }
  if (opts?.include) {
    return prisma.city.findFirst({ where, include: opts.include });
  }
  return prisma.city.findFirst({ where });
}

export async function findCityBySlugOrThrow(
  slug: string,
  select: Prisma.CitySelect,
) {
  const city = await findCityBySlug(slug, { select });
  if (!city) throw new Error(`City not found for slug: ${slug}`);
  return city;
}
