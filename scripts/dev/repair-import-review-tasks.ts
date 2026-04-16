/**
 * Создать отсутствующие ImportReviewTask для orphaned ImportedRecord.
 *
 * Usage:
 *   npx tsx scripts/dev/repair-import-review-tasks.ts
 *   npx tsx scripts/dev/repair-import-review-tasks.ts <runId>
 *   npx tsx scripts/dev/repair-import-review-tasks.ts <runId> <limit>
 */
import { repairOrphanImportReviewTasks } from "../../src/server/modules/import/services/import-review-task.service";

async function main() {
  const runId = process.argv[2] || undefined;
  const limitArg = process.argv[3];
  const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;

  const result = await repairOrphanImportReviewTasks({ runId, limit });
  console.log(JSON.stringify({ runId: runId ?? "all", ...result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
