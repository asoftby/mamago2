/**
 * Find-or-create Country / Region / City from normalized Google geo.
 * Never creates City from regionName alone.
 */

import type { RegionType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { slugifyRu } from "@/lib/slugify";
import { resolveCityFromComponents } from "@/server/geo/city-resolver";
import {
  extractGeoFromGooglePlace,
  type GoogleAddressComponent,
} from "@/server/geo/extractGeoFromGooglePlace";
import { DEFAULT_COUNTRY_ISO, DEFAULT_COUNTRY_SLUG } from "@/server/geo/geoConstants";

export type ResolveGeoEntitiesResult = {
  countryId: string | null;
  regionId: string | null;
  cityId: string | null;
  needsReview: boolean;
  warning?: string;
};

function regionTypeFromName(name: string): RegionType {
  if (/область|вобласць|oblast/i.test(name)) return "OBLAST";
  if (/province|провинция/i.test(name)) return "PROVINCE";
  if (/state/i.test(name)) return "STATE";
  if (/район|district/i.test(name)) return "DISTRICT";
  return "REGION";
}

async function findOrCreateCountry(
  name: string | null,
  isoCode: string | null,
): Promise<string | null> {
  if (isoCode) {
    const byIso = await prisma.country.findUnique({ where: { isoCode } });
    if (byIso) return byIso.id;
  }

  if (!name && !isoCode) return null;

  const slug = isoCode?.toLowerCase() === "by" ? DEFAULT_COUNTRY_SLUG : slugifyRu(name ?? isoCode ?? "country", "country");

  const existing = await prisma.country.findFirst({
    where: isoCode ? { isoCode } : { slug },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.country.create({
    data: {
      name: name ?? isoCode ?? slug,
      slug,
      isoCode: isoCode ?? undefined,
      isActive: isoCode === DEFAULT_COUNTRY_ISO,
      priority: isoCode === DEFAULT_COUNTRY_ISO ? 100 : 0,
    },
    select: { id: true },
  });
  return created.id;
}

async function findOrCreateRegion(
  countryId: string,
  regionName: string | null,
): Promise<string | null> {
  if (!regionName?.trim()) return null;

  const slug = slugifyRu(regionName, "region");
  const existing = await prisma.region.findUnique({
    where: { countryId_slug: { countryId, slug } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.region.create({
    data: {
      countryId,
      name: regionName.trim(),
      slug,
      type: regionTypeFromName(regionName),
      isActive: true,
      priority: 0,
    },
    select: { id: true },
  });
  return created.id;
}

async function findOrCreateCity(args: {
  countryId: string;
  regionId: string | null;
  cityName: string;
  citySlug: string | null;
}): Promise<string | null> {
  const { countryId, regionId, cityName, citySlug } = args;
  const slug = citySlug ?? slugifyRu(cityName, "city");

  const existing = await prisma.city.findUnique({
    where: { countryId_slug: { countryId, slug } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const byName = await prisma.city.findFirst({
    where: {
      countryId,
      isLegacyNonCity: false,
      OR: [
        { name: { equals: cityName, mode: "insensitive" } },
        { googleName: { equals: cityName, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (byName) return byName.id;

  const created = await prisma.city.create({
    data: {
      countryId,
      regionId,
      name: cityName,
      slug,
      googleName: cityName,
      createdFromGoogle: true,
      isActive: false,
      isVisibleInCityFilter: false,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Resolves geo entities from Google address components.
 * Does not create City when only region is present.
 */
export async function resolveGeoEntitiesFromGooglePlace(
  addressComponents: GoogleAddressComponent[],
  formattedAddress?: string | null,
): Promise<ResolveGeoEntitiesResult> {
  const extracted = extractGeoFromGooglePlace(addressComponents);
  const resolver = resolveCityFromComponents(addressComponents, formattedAddress);

  const countryId = await findOrCreateCountry(extracted.countryName, extracted.countryCode);
  if (!countryId) {
    return {
      countryId: null,
      regionId: null,
      cityId: null,
      needsReview: true,
      warning: "Country not found in Google address components",
    };
  }

  const regionId = await findOrCreateRegion(countryId, extracted.regionName);

  if (!extracted.cityName || !resolver.cityName) {
    return {
      countryId,
      regionId,
      cityId: null,
      needsReview: true,
      warning: extracted.regionName
        ? `Only region "${extracted.regionName}" found — City not created`
        : "No locality/postal_town in Google address",
    };
  }

  if (resolver.needsReview && !resolver.citySlug) {
    return {
      countryId,
      regionId,
      cityId: null,
      needsReview: true,
      warning: `City "${extracted.cityName}" needs manual review`,
    };
  }

  const cityId = await findOrCreateCity({
    countryId,
    regionId,
    cityName: resolver.cityName,
    citySlug: resolver.citySlug,
  });

  return {
    countryId,
    regionId,
    cityId,
    needsReview: resolver.needsReview,
  };
}
