/** Journal taxonomy dry-run / additive apply. Usage:
 * pnpm exec tsx scripts/ops/seed-journal-taxonomy.ts           # inspection only
 * pnpm exec tsx scripts/ops/seed-journal-taxonomy.ts --apply   # after reviewed migration
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Node 22 built-in env loader; do not override DATABASE_URL supplied by deployment.
if (!process.env.DATABASE_URL && existsSync(".env")) loadEnvFile(".env");
import { PrismaClient } from "@prisma/client";
import { JOURNAL_DISCOVERY_TAGS, seedDiscoveryTags } from "../../prisma/seed/discovery-tags";
import { JOURNAL_EXTRA_CATEGORIES, seedJournalCategories } from "../../prisma/seed/journal-categories";

async function main() {
  const prisma = new PrismaClient();
  try {
    const [tags, categories] = await Promise.all([
      prisma.discoveryTag.findMany({ select: { slug: true, title: true } }),
      prisma.eventCategory.findMany({ where: { publicationType: "ARTICLE", parentId: null }, select: { slug: true, nameRu: true } }),
    ]);
    const knownTags = new Set(tags.map(t => t.slug));
    const knownTagNames = new Set(tags.map(t => t.title.trim().toLocaleLowerCase("ru")));
    const knownCategories = new Set(categories.map(c => c.slug));
    const knownCategoryNames = new Set(categories.map(c => c.nameRu.trim().toLocaleLowerCase("ru")));
    const newTags = JOURNAL_DISCOVERY_TAGS.filter(t => !knownTags.has(t.slug) && !knownTagNames.has(t.title.toLocaleLowerCase("ru")));
    const newCategories = JOURNAL_EXTRA_CATEGORIES.filter(c => !knownCategories.has(c.slug) && !knownCategoryNames.has(c.nameRu.toLocaleLowerCase("ru")));
    console.log("Journal taxonomy preview:", { existingTags: tags.length, newTags: newTags.length, existingCategories: categories.length, newCategories: newCategories.length });
    console.log("New categories:", newCategories.map(c => c.nameRu));
    console.log("New tags:", newTags.map(t => t.title));
    if (!process.argv.includes("--apply")) {
      console.log("DRY RUN ONLY. Use --apply after verifying the production backup and migration status.");
      return;
    }
    await seedJournalCategories(prisma);
    await seedDiscoveryTags(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
