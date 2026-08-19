/**
 * Import Pipeline dry-run preview — CLI.
 *
 * Не пишет в БД: не создаёт ImportRun/ImportedRecord/ImportReviewTask,
 * не обновляет ImportSource. Только читает source, вызывает parser.parse()
 * и чистые normalizer/scorer функции.
 *
 * Запуск:
 *   pnpm import:preview --source <sourceId>
 *   pnpm import:preview --source <sourceId> --limit 10
 */
import { previewImportForSource } from "../src/server/modules/import/services/import-pipeline.service";
import prisma from "../src/lib/prisma";

function parseArgs(argv: string[]): { source?: string; limit?: number } {
  const result: { source?: string; limit?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--source") result.source = argv[++i];
    if (argv[i] === "--limit") result.limit = Number(argv[++i]);
  }
  return result;
}

async function main() {
  const { source: sourceId, limit } = parseArgs(process.argv.slice(2));

  if (!sourceId) {
    console.error("Usage: pnpm import:preview --source <sourceId> [--limit <number>]");
    process.exitCode = 1;
    return;
  }

  const result = await previewImportForSource(sourceId, { limit });

  console.log("\n=== Import Preview (dry-run, no DB writes) ===");
  console.log(`Source:          ${result.sourceSlug} (${result.sourceId})`);
  console.log(`Parser:          ${result.parserKey}`);
  console.log(`Records found:   ${result.totalFetched}`);
  console.log(`Records processed: ${result.totalProcessed}`);
  console.log(`Parsed OK:       ${result.totalParsed}`);
  console.log(`Errors:          ${result.totalErrors}`);
  if (result.fetchError) {
    console.log(`Fetch error:     ${result.fetchError}`);
  }

  console.log("\n--- First items ---");
  for (const item of result.items.slice(0, 5)) {
    console.log(
      `[${item.normalizeSuccess ? "OK" : "FAIL"}] ${item.entityType} ${item.sourceUrl}` +
        (item.qualityScore !== undefined ? ` score=${item.qualityScore}` : "") +
        (item.warnings?.length ? ` warnings=${item.warnings.join(",")}` : "") +
        (item.error ? ` error=${item.error}` : ""),
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
