/** Global MediaUsage repair. Default and --dry-run are read-only. */
import prisma from "../../src/lib/prisma";
import { buildMediaUsageRepairDryRun } from "../../src/server/media/mediaReferenceAudit";

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const result = await buildMediaUsageRepairDryRun();
  const report = {
    mode: apply ? "apply" : "dry-run",
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
  if (!apply) {
    console.log(JSON.stringify(report));
    return;
  }
  if (result.duplicates.length !== 0 || result.audit.unresolved.length !== 0) {
    throw new Error("Repair apply refused: duplicates or unresolved references are present");
  }
  const deleteIds = [...new Set([...result.stale.map((row) => row.id), ...result.duplicates])];
  const applied = await prisma.$transaction(async (tx) => {
    const deleted = deleteIds.length
      ? await tx.mediaUsage.deleteMany({ where: { id: { in: deleteIds } } })
      : { count: 0 };
    const created = result.create.length
      ? await tx.mediaUsage.createMany({
          data: result.create.map(({ mediaId, entityType, entityId, field }) => ({ mediaId, entityType, entityId, field })),
        })
      : { count: 0 };
    return { deleted: deleted.count, created: created.count, total: await tx.mediaUsage.count() };
  });
  if (applied.deleted !== deleteIds.length || applied.created !== result.create.length) {
    throw new Error(`Repair count mismatch after transaction: ${JSON.stringify(applied)}`);
  }
  console.log(JSON.stringify({ ...report, applied }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
