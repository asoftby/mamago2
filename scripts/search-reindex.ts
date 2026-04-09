/**
 * Full rebuild of SearchDocument from source entities (activities, offers, places, routes, articles).
 * Usage: pnpm search:reindex
 */
import { prismaBase } from "../src/lib/prisma";
import { SearchIndexerService } from "../src/lib/search/SearchIndexerService";

async function main() {
  const indexer = new SearchIndexerService(prismaBase);
  console.log("[search:reindex] starting…");
  await indexer.reindexAll();
  console.log("[search:reindex] done.");
}

main()
  .catch((e) => {
    console.error("[search:reindex] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
