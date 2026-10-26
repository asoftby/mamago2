import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TERRITORY_EXPAND_COLUMNS } from "./territoryExpandColumns";

/** Every `territoryId` / `regionTerritoryId` column in the Prisma schema must be reconciled. */
function schemaTerritoryColumns(): Set<string> {
  const found = new Set<string>();
  for (const file of ["schema.prisma", "recommendations.prisma", "gsc.prisma"]) {
    const source = readFileSync(join(__dirname, "../../prisma", file), "utf8");
    let model: string | null = null;
    for (const line of source.split("\n")) {
      const start = line.match(/^model (\w+) \{/);
      if (start) model = start[1];
      else if (line === "}") model = null;
      const field = line.match(/^\s+(territoryId|regionTerritoryId)\s+String\?/);
      if (model && model !== "TerritoryLegacyMap" && field) found.add(`${model}.${field[1]}`);
    }
  }
  return found;
}

const declared = new Set(TERRITORY_EXPAND_COLUMNS.map((c) => `${c.table}.${c.territoryColumn}`));
const inSchema = schemaTerritoryColumns();

assert.deepEqual([...inSchema].sort(), [...declared].sort(), "reconciliation columns must match prisma schema");
assert.equal(declared.size, TERRITORY_EXPAND_COLUMNS.length, "no duplicate columns");

const migration = readFileSync(
  join(__dirname, "../../prisma/migrations/20261026120000_territory_expand/migration.sql"),
  "utf8",
);
for (const c of TERRITORY_EXPAND_COLUMNS) {
  const kind = c.legacyColumn === "cityId" ? "CITY" : "REGION";
  const backfill = `UPDATE "${c.table}" t SET "${c.territoryColumn}" = m."territoryId" FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = '${kind}' AND m."legacyId" = t."${c.legacyColumn}";`;
  assert.ok(migration.includes(backfill), `migration backfills ${c.table}.${c.territoryColumn}`);
}
console.log("territoryExpandColumns.test: ok");
