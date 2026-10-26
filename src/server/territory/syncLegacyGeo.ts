import type { Prisma } from "@prisma/client";
import {
  BELARUS_COUNTRY_SLUG,
  cityTerritoryId,
  countryTerritoryId,
  findBelarusRegionRefByCentreSlug,
  findBelarusRegionRefByOblastSlug,
  regionTerritoryId,
} from "@/server/territory/territoryIds";

/**
 * DUAL WRITE for geography (Country / Region / City -> Territory) during the expand phase.
 *
 * Every code path that creates or edits a legacy geo row calls these helpers right after the write
 * (inside the same transaction when there is one). The helpers are idempotent: they read the legacy
 * row and upsert the mirrored Territory plus its TerritoryLegacyMap entry. Legacy FK columns on
 * content tables are mirrored by the DB trigger from migration 20261027090000, not here.
 *
 * Removed in the contract phase together with the legacy tables.
 */
export type TerritorySyncDb = Pick<
  Prisma.TransactionClient,
  "country" | "region" | "city" | "territory" | "territoryLegacyMap"
>;

type LegacyKind = "COUNTRY" | "REGION" | "CITY";

async function mapEntry(db: TerritorySyncDb, legacyKind: LegacyKind, legacyId: string) {
  return db.territoryLegacyMap.findUnique({
    where: { legacyKind_legacyId: { legacyKind, legacyId } },
    select: { territoryId: true },
  });
}

async function writeMap(db: TerritorySyncDb, legacyKind: LegacyKind, legacyId: string, territoryId: string) {
  await db.territoryLegacyMap.upsert({
    where: { legacyKind_legacyId: { legacyKind, legacyId } },
    create: { legacyKind, legacyId, territoryId },
    update: { territoryId },
  });
}

export async function syncCountryToTerritory(db: TerritorySyncDb, legacyCountryId: string): Promise<string> {
  const country = await db.country.findUnique({ where: { id: legacyCountryId } });
  if (!country) throw new Error(`syncCountryToTerritory: Country ${legacyCountryId} not found`);

  const id = (await mapEntry(db, "COUNTRY", country.id))?.territoryId ?? countryTerritoryId(country.id);
  const fields = {
    slug: country.slug,
    name: country.name,
    isoCode: country.isoCode,
    isActive: country.isActive,
    priority: country.priority,
  };
  if (await db.territory.findUnique({ where: { id }, select: { id: true } })) {
    await db.territory.update({ where: { id }, data: fields });
  } else {
    await db.territory.create({ data: { id, type: "COUNTRY", parentId: null, ...fields } });
  }
  await writeMap(db, "COUNTRY", country.id, id);
  return id;
}

export async function syncRegionToTerritory(db: TerritorySyncDb, legacyRegionId: string): Promise<string> {
  const region = await db.region.findUnique({ where: { id: legacyRegionId }, include: { country: true } });
  if (!region) throw new Error(`syncRegionToTerritory: Region ${legacyRegionId} not found`);

  const countryId = await syncCountryToTerritory(db, region.countryId);
  const ref = region.country.slug === BELARUS_COUNTRY_SLUG ? findBelarusRegionRefByOblastSlug(region.slug) : undefined;
  const id =
    (await mapEntry(db, "REGION", region.id))?.territoryId ??
    regionTerritoryId({ legacyRegionId: region.id, centreSlug: ref?.centreSlug });

  if (await db.territory.findUnique({ where: { id }, select: { id: true } })) {
    // Known oblasts keep the centre-city identity (slug/name/coordinates) chosen by the migration.
    await db.territory.update({
      where: { id },
      data: ref
        ? { isActive: region.isActive, priority: region.priority }
        : { slug: region.slug, name: region.name, isActive: region.isActive, priority: region.priority },
    });
  } else {
    await db.territory.create({
      data: ref
        ? {
            id, type: "REGION", parentId: countryId, slug: ref.centreSlug, name: ref.name, nameIn: ref.nameIn,
            lat: ref.lat, lng: ref.lng, centerLat: ref.lat, centerLng: ref.lng,
            isActive: region.isActive, priority: region.priority,
          }
        : {
            id, type: "REGION", parentId: countryId, slug: region.slug, name: region.name,
            isActive: region.isActive, priority: region.priority,
          },
    });
  }
  await writeMap(db, "REGION", region.id, id);
  return id;
}

export async function syncCityToTerritory(db: TerritorySyncDb, legacyCityId: string): Promise<string> {
  const city = await db.city.findUnique({ where: { id: legacyCityId } });
  if (!city) throw new Error(`syncCityToTerritory: City ${legacyCityId} not found`);

  const countryId = await syncCountryToTerritory(db, city.countryId);
  const regionId = city.regionId ? await syncRegionToTerritory(db, city.regionId) : null;
  const id = (await mapEntry(db, "CITY", city.id))?.territoryId ?? cityTerritoryId(city.id);

  const fields = {
    slug: city.slug,
    name: city.name,
    lat: city.lat,
    lng: city.lng,
    isActive: city.isActive,
    priority: city.priority,
    isVisibleInCityFilter: city.isVisibleInCityFilter,
    isLegacyNonCity: city.isLegacyNonCity,
    centerLat: city.centerLat,
    centerLng: city.centerLng,
    radiusKm: city.radiusKm,
    hasMetro: city.hasMetro,
    metroMaxDistanceM: city.metroMaxDistanceM,
    googlePlaceId: city.googlePlaceId,
    googleName: city.googleName,
    googleNames: (city.googleNames ?? undefined) as Prisma.InputJsonValue | undefined,
  };

  if (await db.territory.findUnique({ where: { id }, select: { id: true } })) {
    // The parent is not touched on update: city -> region links are curated in Territory.
    await db.territory.update({ where: { id }, data: fields });
  } else {
    // A centre city without a legacy region still belongs to its own oblast region when that exists.
    let parentId = regionId;
    if (!parentId && findBelarusRegionRefByCentreSlug(city.slug)) {
      const centreId = regionTerritoryId({ legacyRegionId: "", centreSlug: city.slug });
      if (await db.territory.findUnique({ where: { id: centreId }, select: { id: true } })) parentId = centreId;
    }
    await db.territory.create({
      data: {
        id,
        type: "CITY",
        parentId: parentId ?? countryId,
        nameIn: findBelarusRegionRefByCentreSlug(city.slug)?.cityNameIn ?? null,
        ...fields,
      },
    });
  }
  await writeMap(db, "CITY", city.id, id);
  return id;
}
