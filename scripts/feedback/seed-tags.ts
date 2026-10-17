/**
 * Safe, opt-in starter tag population. Existing tag configuration is not
 * overwritten; manual changes in admin have priority over this seed.
 * Requires feedback foundation migration.
 */
import { prisma } from "@/lib/prisma";
import { STARTER_FEEDBACK_TAGS } from "@/lib/feedback/tagCatalog";

async function main() {
  if (!process.argv.includes("--apply") || process.env.FEEDBACK_SEED_ENABLED !== "1") {
    console.log("Preview only: " + STARTER_FEEDBACK_TAGS.length + " tags. Set FEEDBACK_SEED_ENABLED=1 and pass --apply to insert.");
    for (const tag of STARTER_FEEDBACK_TAGS) console.log(tag.key + " | " + tag.label + " | " + tag.scope);
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const tag of STARTER_FEEDBACK_TAGS) {
    const exists = await prisma.feedbackTag.findUnique({ where: { key: tag.key }, select: { id: true } });
    if (exists) { skipped++; continue; }
    await prisma.feedbackTag.create({
      data: {
        key: tag.key,
        label: tag.label,
        scope: tag.scope,
        showFor: [...tag.showFor],
        targetTypes: [...tag.targetTypes],
      },
    });
    created++;
  }
  console.log(JSON.stringify({ created, skipped }));
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
