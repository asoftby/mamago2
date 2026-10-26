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

// DUAL WRITE triggers: every mirrored column has one, and the down script drops each of them.
const triggers = readFileSync(
  join(__dirname, "../../prisma/migrations/20261027090000_territory_dual_write_triggers/migration.sql"),
  "utf8",
);
const triggersDown = readFileSync(
  join(__dirname, "../../prisma/migrations/20261027090000_territory_dual_write_triggers/down.sql.txt"),
  "utf8",
);
for (const c of TERRITORY_EXPAND_COLUMNS) {
  const kind = c.legacyColumn === "cityId" ? "CITY" : "REGION";
  const name = `territory_sync_${c.table}_${c.legacyColumn}`;
  assert.ok(
    triggers.includes(`CREATE TRIGGER "${name}" BEFORE INSERT OR UPDATE OF "${c.legacyColumn}" ON "${c.table}" FOR EACH ROW EXECUTE FUNCTION "territory_sync_from_legacy"('${c.legacyColumn}', '${c.territoryColumn}', '${kind}');`),
    `dual-write trigger for ${c.table}.${c.legacyColumn}`,
  );
  assert.ok(triggersDown.includes(`DROP TRIGGER IF EXISTS "${name}" ON "${c.table}";`), `down drops ${name}`);
}
console.log("territoryExpandColumns.test (triggers): ok");
