/**
 * Territory EXPAND reconciliation. Read-only; exits 1 on any mismatch.
 * The expand PR must not merge/deploy without a green run.
 *
 *   set -a; source .env; set +a; npx tsx scripts/data-migrations/verify-territory-expand.ts
 */
import { PrismaClient } from "@prisma/client";
import { TERRITORY_EXPAND_COLUMNS } from "./territoryExpandColumns";

const prisma = new PrismaClient();
const failures: string[] = [];
const warnings: string[] = [];

const count = async (sql: string): Promise<number> => {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(sql);
  return Number(rows[0]?.n ?? 0);
};

async function main() {
  // 1. Row counts: every legacy row has exactly one mapping and one Territory.
  for (const [kind, table] of [["COUNTRY", "Country"], ["REGION", "Region"], ["CITY", "City"]] as const) {
    const legacy = await count(`SELECT count(*) n FROM "${table}"`);
    const mapped = await count(`SELECT count(*) n FROM "TerritoryLegacyMap" WHERE "legacyKind" = '${kind}'`);
    const orphanMaps = await count(
      `SELECT count(*) n FROM "TerritoryLegacyMap" m WHERE m."legacyKind" = '${kind}' AND NOT EXISTS (SELECT 1 FROM "${table}" l WHERE l."id" = m."legacyId")`,
    );
    console.log(`${table}: legacy=${legacy} mapped=${mapped}`);
    if (legacy !== mapped) failures.push(`${table}: ${legacy} legacy rows, ${mapped} mapped`);
    if (orphanMaps) failures.push(`${table}: ${orphanMaps} mappings point to missing legacy rows`);
  }

  // 2. Slugs of 1:1 entities match (regions are intentionally re-slugged to the centre city).
  for (const [kind, table] of [["COUNTRY", "Country"], ["CITY", "City"]] as const) {
    const bad = await count(
      `SELECT count(*) n FROM "TerritoryLegacyMap" m JOIN "${table}" l ON l."id" = m."legacyId" JOIN "Territory" t ON t."id" = m."territoryId" WHERE m."legacyKind" = '${kind}' AND t."slug" <> l."slug"`,
    );
    if (bad) failures.push(`${table}: ${bad} slug mismatches`);
  }

  // 3. Hierarchy: CITY under REGION/COUNTRY, REGION under COUNTRY, COUNTRY is a root.
  const badParent = await count(
    `SELECT count(*) n FROM "Territory" t LEFT JOIN "Territory" p ON p."id" = t."parentId"
     WHERE (t."type" = 'COUNTRY' AND t."parentId" IS NOT NULL)
        OR (t."type" = 'REGION' AND p."type" IS DISTINCT FROM 'COUNTRY')
        OR (t."type" = 'CITY' AND p."type" NOT IN ('REGION', 'COUNTRY'))`,
  );
  if (badParent) failures.push(`${badParent} territories have an invalid parent type`);

  const cityUnderCountry = await prisma.$queryRawUnsafe<{ slug: string }[]>(
    `SELECT t."slug" FROM "Territory" t JOIN "Territory" p ON p."id" = t."parentId"
     WHERE t."type" = 'CITY' AND p."type" = 'COUNTRY' AND t."isLegacyNonCity" = false ORDER BY t."slug"`,
  );
  if (cityUnderCountry.length) {
    warnings.push(`cities without a region (assign in admin before switch-read): ${cityUnderCountry.map((c) => c.slug).join(", ")}`);
  }

  // 4. Every FK column: nothing lost, nothing remapped to a different territory.
  for (const c of TERRITORY_EXPAND_COLUMNS) {
    const kind = c.legacyColumn === "cityId" ? "CITY" : "REGION";
    const label = `${c.table}.${c.territoryColumn}`;
    const total = await count(`SELECT count(*) n FROM "${c.table}" WHERE "${c.legacyColumn}" IS NOT NULL`);
    const missing = await count(
      `SELECT count(*) n FROM "${c.table}" WHERE "${c.legacyColumn}" IS NOT NULL AND "${c.territoryColumn}" IS NULL`,
    );
    const wrong = await count(
      `SELECT count(*) n FROM "${c.table}" x JOIN "TerritoryLegacyMap" m ON m."legacyKind" = '${kind}' AND m."legacyId" = x."${c.legacyColumn}"
       WHERE x."${c.territoryColumn}" IS DISTINCT FROM m."territoryId"`,
    );
    const stray = await count(
      `SELECT count(*) n FROM "${c.table}" WHERE "${c.legacyColumn}" IS NULL AND "${c.territoryColumn}" IS NOT NULL`,
    );
    console.log(`${label}: rows=${total} missing=${missing} wrong=${wrong} stray=${stray}`);
    if (missing) failures.push(`${label}: ${missing} rows lost their territory`);
    if (wrong) failures.push(`${label}: ${wrong} rows point to a different territory than ${c.legacyColumn}`);
    if (stray) failures.push(`${label}: ${stray} rows have a territory but no ${c.legacyColumn}`);
  }

  for (const w of warnings) console.warn(`WARN  ${w}`);
  if (failures.length) {
    for (const f of failures) console.error(`FAIL  ${f}`);
    process.exitCode = 1;
  } else {
    console.log("OK: territory expand reconciliation is green");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
