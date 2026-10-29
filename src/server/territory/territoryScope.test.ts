/**
 * Run: pnpm exec tsx src/server/territory/territoryScope.test.ts
 * Scope resolution against an in-memory Territory table.
 */
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { activityInExactTerritoryScopeWhere, activityInTerritoryScopeWhere, collectDescendantIds, placeInTerritoryScopeWhere, resolveTerritoryScope } from "./territoryScope";

const rows = [
  { id: "c", type: "COUNTRY", slug: "belarus", name: "Беларусь", nameIn: null, parentId: null, isActive: true, isIndexable: true },
  { id: "rm", type: "REGION", slug: "minsk", name: "Минск", nameIn: null, parentId: "c", isActive: true, isIndexable: true },
  { id: "rg", type: "REGION", slug: "grodno", name: "Гродно", nameIn: null, parentId: "c", isActive: true, isIndexable: true },
  { id: "cm", type: "CITY", slug: "minsk", name: "Минск", nameIn: null, parentId: "rm", isActive: true, isIndexable: true },
  { id: "cmg", type: "CITY", slug: "marina-gorka", name: "Марьина Горка", nameIn: null, parentId: "rm", isActive: true, isIndexable: true },
  { id: "cg", type: "CITY", slug: "grodno", name: "Гродно", nameIn: null, parentId: "rg", isActive: true, isIndexable: true },
];
const db = {
  territory: {
    findMany: async ({ where, select }: { where?: { slug?: string }; select?: Record<string, boolean> }) => {
      // resolver: slug lookup; scope: whole table
      let found = rows;
      if (where?.slug) found = rows.filter((r) => r.slug === where.slug);
      return found.map((r) => (select ? Object.fromEntries(Object.entries(r).filter(([key]) => select[key])) : r));
    },
  },
} as unknown as Pick<PrismaClient, "territory">;

assert.deepEqual(collectDescendantIds(rows, "rm").sort(), ["cm", "cmg", "rm"]);
assert.deepEqual(collectDescendantIds(rows, "cm"), ["cm"]);
assert.equal(collectDescendantIds(rows, "c").length, rows.length);

async function main() {
  // `/minsk` = REGION: region + centre city + the other cities of the region.
  const minsk = (await resolveTerritoryScope("minsk", { db }))!;
  assert.equal(minsk.type, "REGION");
  assert.deepEqual([...minsk.territoryIds].sort(), ["cm", "cmg", "rm"]);
  assert.equal(minsk.cityTerritoryId, "cm", "centre city of the region");
  assert.equal(minsk.regionTerritoryId, "rm");
  assert.deepEqual([...minsk.regionScopeIds].sort(), ["cm", "cmg", "rm"]);

  // A small city sees only itself, but knows its region.
  const mg = (await resolveTerritoryScope("marina-gorka", { db }))!;
  assert.deepEqual(mg.territoryIds, ["cmg"]);
  assert.equal(mg.cityTerritoryId, "cmg");
  assert.equal(mg.regionTerritoryId, "rm");
  assert.deepEqual([...mg.regionScopeIds].sort(), ["cm", "cmg", "rm"]);

  // `/belarus` = COUNTRY: everything, no city/region anchor.
  const by = (await resolveTerritoryScope("belarus", { db }))!;
  assert.equal(by.territoryIds.length, rows.length);
  assert.equal(by.cityTerritoryId, null);
  assert.equal(by.regionTerritoryId, null);

  assert.equal(await resolveTerritoryScope("atlantis", { db }), null);

  assert.deepEqual(placeInTerritoryScopeWhere(["a", "b"]), { territoryId: { in: ["a", "b"] } });
  assert.deepEqual(activityInTerritoryScopeWhere(["a"]), {
    OR: [{ territoryId: { in: ["a"] } }, { place: { territoryId: { in: ["a"] } } }, { venue: { territoryId: { in: ["a"] } } }],
  });
  // Explicit geography must use the same precedence as the displayed card city.
  assert.deepEqual(activityInExactTerritoryScopeWhere(["a"]), {
    OR: [
      { venue: { territoryId: { in: ["a"] } } },
      { AND: [
        { OR: [{ venue: null }, { venue: { territoryId: null } }] },
        { place: { territoryId: { in: ["a"] } } },
      ] },
      { AND: [
        { OR: [{ venue: null }, { venue: { territoryId: null } }] },
        { OR: [{ placeId: null }, { place: { territoryId: null } }] },
        { territoryId: { in: ["a"] } },
      ] },
    ],
  });
  console.log("territoryScope.test: ok");
}
main();
