/**
 * Run: pnpm exec tsx scripts/data-migrations/territoryReverseTriggers.test.ts
 * Static checks of the reverse-trigger migration + behaviour against the DATABASE_URL database
 * (migrations applied; the push gate supplies a throwaway one). Creates and removes its own rows.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TERRITORY_EXPAND_COLUMNS } from "./territoryExpandColumns";

const dir = join(__dirname, "../../prisma/migrations/20261028090000_territory_reverse_triggers");
const up = readFileSync(join(dir, "migration.sql"), "utf8");
const down = readFileSync(join(dir, "down.sql.txt"), "utf8");
const REQUIRED = new Set(["District", "MetroStation", "HomeStoryItem"]);

for (const c of TERRITORY_EXPAND_COLUMNS) {
  const kind = c.legacyColumn === "cityId" ? "CITY" : "REGION";
  const name = `territory_reverse_${c.table}_${c.legacyColumn}`;
  const req = REQUIRED.has(c.table) && c.legacyColumn === "cityId" ? "required" : "nullable";
  assert.ok(
    up.includes(`CREATE TRIGGER "${name}" BEFORE INSERT OR UPDATE OF "${c.territoryColumn}" ON "${c.table}" FOR EACH ROW EXECUTE FUNCTION "territory_sync_to_legacy"('${c.legacyColumn}', '${c.territoryColumn}', '${kind}', '${req}');`),
    `reverse trigger for ${c.table}.${c.territoryColumn}`,
  );
  assert.ok(down.includes(`DROP TRIGGER IF EXISTS "${name}" ON "${c.table}";`), `down drops ${name}`);
}
assert.equal((up.match(/CREATE TRIGGER/g) ?? []).length, TERRITORY_EXPAND_COLUMNS.length);
assert.ok(down.includes('DROP FUNCTION IF EXISTS "territory_sync_to_legacy"();'));
console.log("territoryReverseTriggers.test: static ok");

async function behaviour() {
  const { default: prisma } = await import("../../src/lib/prisma");
  const { syncCityToTerritory, syncCountryToTerritory } = await import("../../src/server/territory/syncLegacyGeo");
  const sfx = Date.now().toString(36);
  const country = await prisma.country.create({ data: { name: `RT ${sfx}`, slug: `rt-${sfx}`, isoCode: null, isActive: true } });
  const cityA = await prisma.city.create({ data: { countryId: country.id, name: "A", slug: `rt-a-${sfx}` } });
  const cityB = await prisma.city.create({ data: { countryId: country.id, name: "B", slug: `rt-b-${sfx}` } });
  const countryTerritory = await syncCountryToTerritory(prisma, country.id);
  const terA = await syncCityToTerritory(prisma, cityA.id);
  const terB = await syncCityToTerritory(prisma, cityB.id);
  const created: string[] = [];
  const row = async (id: string) =>
    (await prisma.searchQueryLog.findUniqueOrThrow({ where: { id }, select: { cityId: true, territoryId: true } }));
  const insert = async (data: { cityId?: string | null; territoryId?: string | null }) => {
    const r = await prisma.searchQueryLog.create({ data: { query: `rt-${sfx}`, resultsCount: 0, ...data } });
    created.push(r.id);
    return r.id;
  };

  try {
    // INSERT with only the Territory column -> legacy city derived.
    let id = await insert({ territoryId: terA });
    assert.deepEqual(await row(id), { cityId: cityA.id, territoryId: terA });

    // INSERT with only the legacy column -> mirror derived (PR 2 trigger still works).
    id = await insert({ cityId: cityB.id });
    assert.deepEqual(await row(id), { cityId: cityB.id, territoryId: terB });

    // UPDATE of the Territory column only -> legacy follows.
    await prisma.searchQueryLog.update({ where: { id }, data: { territoryId: terA } });
    assert.deepEqual(await row(id), { cityId: cityA.id, territoryId: terA });

    // UPDATE of the legacy column only -> mirror follows.
    await prisma.searchQueryLog.update({ where: { id }, data: { cityId: cityB.id } });
    assert.deepEqual(await row(id), { cityId: cityB.id, territoryId: terB });

    // Both columns in one statement: legacy wins, mirror rebuilt from it.
    await prisma.searchQueryLog.update({ where: { id }, data: { cityId: cityA.id, territoryId: terB } });
    assert.deepEqual(await row(id), { cityId: cityA.id, territoryId: terA });

    // Unrelated update leaves both untouched.
    await prisma.searchQueryLog.update({ where: { id }, data: { resultsCount: 7 } });
    assert.deepEqual(await row(id), { cityId: cityA.id, territoryId: terA });

    // Clearing the Territory column clears the nullable legacy column.
    await prisma.searchQueryLog.update({ where: { id }, data: { territoryId: null } });
    assert.deepEqual(await row(id), { cityId: null, territoryId: null });

    // A Territory without a legacy city row (COUNTRY for a city column) -> legacy NULL, mirror kept.
    id = await insert({ territoryId: countryTerritory });
    assert.deepEqual(await row(id), { cityId: null, territoryId: countryTerritory });

    // Required legacy columns raise instead of diverging (District.cityId is NOT NULL).
    await assert.rejects(
      prisma.$executeRawUnsafe(
        `INSERT INTO "District" ("id","name","territoryId","updatedAt") VALUES ('rt-d-${sfx}','d','${countryTerritory}', now())`,
      ),
      /has no legacy CITY row/,
    );
    console.log("territoryReverseTriggers.test: behaviour ok");
  } finally {
    await prisma.searchQueryLog.deleteMany({ where: { id: { in: created } } });
    await prisma.territoryLegacyMap.deleteMany({ where: { territoryId: { in: [terA, terB, countryTerritory] } } });
    await prisma.territory.deleteMany({ where: { id: { in: [terA, terB, countryTerritory] } } });
    await prisma.city.deleteMany({ where: { id: { in: [cityA.id, cityB.id] } } });
    await prisma.country.delete({ where: { id: country.id } });
    await prisma.$disconnect();
  }
}

behaviour().catch((error) => {
  console.error(error);
  process.exit(1);
});
