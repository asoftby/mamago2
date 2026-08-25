/** Global MediaUsage repair. Default and --dry-run are read-only. */
import { prismaBase } from "../../src/lib/prisma";
import { buildMediaUsageRepairDryRun } from "../../src/server/media/mediaReferenceAudit";
import { assertCanonicalEnvironment } from "./backfill-media-canonical-names";

export function parseMediaUsageRepairCliArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  if (apply && argv.includes("--dry-run")) {
    throw new Error("Choose either --dry-run or --apply");
  }
  return {
    apply,
    allowProduction: argv.includes("--allow-production"),
  };
}

async function main() {
  const args = parseMediaUsageRepairCliArgs(process.argv.slice(2));
  const [{ currentDatabase }] = await prismaBase.$queryRaw<Array<{ currentDatabase: string }>>`
    SELECT current_database() AS "currentDatabase"
  `;
  const environment = assertCanonicalEnvironment({
    databaseUrl: process.env.DATABASE_URL,
    currentDatabase,
    apply: args.apply,
    allowProduction: args.allowProduction,
  });
  const result = await buildMediaUsageRepairDryRun();
  const report = {
    mode: args.apply ? "apply" : "dry-run",
    environment,
    totalAssets: result.audit.assets.length,
    existingUsageRows: result.existingCount,
    createCount: result.create.length,
    staleCount: result.stale.length,
    duplicateCount: result.duplicates.length,
    unresolvedCount: result.audit.unresolved.length,
    create: result.create,
    stale: result.stale,
    duplicates: result.duplicates,
    unresolved: result.audit.unresolved,
  };
  if (!args.apply) {
    console.log(JSON.stringify(report));
    return;
  }
  if (result.duplicates.length !== 0 || result.audit.unresolved.length !== 0) {
    throw new Error("Repair apply refused: duplicates or unresolved references are present");
  }
  const deleteIds = [...new Set([...result.stale.map((row) => row.id), ...result.duplicates])];
  const applied = await prismaBase.$transaction(async (tx) => {
    const deleted = deleteIds.length
      ? await tx.mediaUsage.deleteMany({ where: { id: { in: deleteIds } } })
      : { count: 0 };
    const created = result.create.length
      ? await tx.mediaUsage.createMany({
          data: result.create.map(({ mediaId, entityType, entityId, field }) => ({
            mediaId,
            entityType,
            entityId,
            field,
          })),
        })
      : { count: 0 };
    return { deleted: deleted.count, created: created.count, total: await tx.mediaUsage.count() };
  });
  if (applied.deleted !== deleteIds.length || applied.created !== result.create.length) {
    throw new Error(`Repair count mismatch after transaction: ${JSON.stringify(applied)}`);
  }
  console.log(JSON.stringify({ ...report, applied }));
}

if (process.argv[1]?.endsWith("repair-media-usage.ts")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prismaBase.$disconnect());
}
