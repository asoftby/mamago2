/**
 * Run: pnpm exec tsx src/server/territory/syncLegacyGeo.test.ts
 * Dual-write helper against an in-memory fake of the Prisma delegates it uses.
 */
import assert from "node:assert/strict";
import { syncCityToTerritory, syncCountryToTerritory, syncRegionToTerritory, type TerritorySyncDb } from "./syncLegacyGeo";

type Row = Record<string, any>;

function fakeDb(seed: { countries?: Row[]; regions?: Row[]; cities?: Row[]; territories?: Row[] }) {
  const countries = seed.countries ?? [];
  const regions = seed.regions ?? [];
  const cities = seed.cities ?? [];
  const territories = new Map<string, Row>((seed.territories ?? []).map((t) => [t.id, t]));
  const maps = new Map<string, string>();
  const byId = (rows: Row[]) => async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null;
  const db = {
    country: { findUnique: byId(countries) },
    region: {
      findUnique: async ({ where }: any) => {
        const r = regions.find((x) => x.id === where.id);
        return r ? { ...r, country: countries.find((c) => c.id === r.countryId) } : null;
      },
    },
    city: { findUnique: byId(cities) },
    territory: {
      findUnique: async ({ where }: any) => territories.get(where.id) ?? null,
      create: async ({ data }: any) => {
        assert.ok(!territories.has(data.id), `duplicate Territory ${data.id}`);
        territories.set(data.id, { ...data });
        return data;
      },
      update: async ({ where, data }: any) => {
        Object.assign(territories.get(where.id)!, data);
        return territories.get(where.id);
      },
    },
    territoryLegacyMap: {
      findUnique: async ({ where }: any) => {
        const key = `${where.legacyKind_legacyId.legacyKind}:${where.legacyKind_legacyId.legacyId}`;
        return maps.has(key) ? { territoryId: maps.get(key) } : null;
      },
      upsert: async ({ where, create }: any) => {
        maps.set(`${where.legacyKind_legacyId.legacyKind}:${where.legacyKind_legacyId.legacyId}`, create.territoryId);
      },
    },
  };
  return { db: db as unknown as TerritorySyncDb, territories, maps };
}

const by = { id: "c1", slug: "belarus", name: "Беларусь", isoCode: "BY", isActive: true, priority: 100 };
const oblast = { id: "r1", countryId: "c1", slug: "minskaya-oblast", name: "Минская область", isActive: true, priority: 100 };
const cityBase = {
  countryId: "c1", regionId: null, lat: 1, lng: 2, isActive: true, priority: 0, isVisibleInCityFilter: true,
  isLegacyNonCity: false, centerLat: null, centerLng: null, radiusKm: null, hasMetro: false, metroMaxDistanceM: null,
  googlePlaceId: null, googleName: null, googleNames: null,
};

async function main() {
  // Country: deterministic id, mirrored fields, map entry, idempotent.
  {
    const { db, territories, maps } = fakeDb({ countries: [by] });
    assert.equal(await syncCountryToTerritory(db, "c1"), "ter_country_c1");
    await syncCountryToTerritory(db, "c1");
    assert.equal(territories.size, 1);
    assert.equal(territories.get("ter_country_c1")!.type, "COUNTRY");
    assert.equal(maps.get("COUNTRY:c1"), "ter_country_c1");
  }

  // Known Belarus oblast -> REGION named after the centre city, keeps its identity on update.
  {
    const { db, territories, maps } = fakeDb({ countries: [by], regions: [oblast] });
    assert.equal(await syncRegionToTerritory(db, "r1"), "ter_region_minsk");
    const created = territories.get("ter_region_minsk")!;
    assert.deepEqual([created.type, created.slug, created.parentId, created.centerLat], ["REGION", "minsk", "ter_country_c1", 53.9006]);
    assert.equal(maps.get("REGION:r1"), "ter_region_minsk");
    oblast.isActive = false;
    await syncRegionToTerritory(db, "r1");
    assert.equal(territories.get("ter_region_minsk")!.isActive, false);
    assert.equal(territories.get("ter_region_minsk")!.slug, "minsk", "update must not revert slug to *-oblast");
    oblast.isActive = true;
  }

  // Unknown region keeps its own slug and a legacy-id based Territory id (no cross-country collision).
  {
    const other = { id: "r9", countryId: "c1", slug: "some-region", name: "Some", isActive: true, priority: 1 };
    const { db, territories } = fakeDb({ countries: [by], regions: [other] });
    assert.equal(await syncRegionToTerritory(db, "r9"), "ter_region_r9");
    assert.equal(territories.get("ter_region_r9")!.slug, "some-region");
  }

  // City: parent from its legacy region; centre city without region lands under its own region.
  {
    const kop = { ...cityBase, id: "k1", slug: "kopishche", name: "Копище", regionId: "r1" };
    const minsk = { ...cityBase, id: "m1", slug: "minsk", name: "Минск" };
    const { db, territories, maps } = fakeDb({ countries: [by], regions: [oblast], cities: [kop, minsk] });
    assert.equal(await syncCityToTerritory(db, "k1"), "ter_city_k1");
    assert.equal(territories.get("ter_city_k1")!.parentId, "ter_region_minsk");
    assert.equal(maps.get("CITY:k1"), "ter_city_k1");
    await syncCityToTerritory(db, "m1");
    assert.equal(territories.get("ter_city_m1")!.parentId, "ter_region_minsk");
    assert.equal(territories.get("ter_city_m1")!.nameIn, "в Минске");
    const regions = [...territories.values()].filter((t) => t.type === "REGION" && t.slug === "minsk");
    assert.equal(regions.length, 1, "region minsk and city minsk coexist, one REGION");
  }

  // City update syncs flags but keeps a curated parent (kopishche moved by hand stays put).
  {
    const kop = { ...cityBase, id: "k1", slug: "kopishche", name: "Копище" };
    const { db, territories } = fakeDb({
      countries: [by], regions: [oblast], cities: [kop],
      territories: [{ id: "ter_city_k1", type: "CITY", parentId: "ter_region_minsk", slug: "kopishche", isActive: true }],
    });
    kop.isActive = false;
    await syncCityToTerritory(db, "k1");
    assert.equal(territories.get("ter_city_k1")!.isActive, false);
    assert.equal(territories.get("ter_city_k1")!.parentId, "ter_region_minsk");
  }

  await assert.rejects(() => syncCityToTerritory(fakeDb({}).db, "missing"), /not found/);
  console.log("syncLegacyGeo.test: ok");
}

void main();
