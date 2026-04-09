/**
 * 20260327-backfill-is-system.ts
 *
 * Backfill isSystem = true for known system-seeded SignalDefinitions and FilterDefinitions.
 * Idempotent — safe to run multiple times.
 *
 * Run: tsx scripts/data-migrations/20260327-backfill-is-system.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_SIGNAL_SLUGS = ["tempo", "energy", "age"];
const SYSTEM_FILTER_SLUGS = ["when", "age"];

async function main() {
  console.log("🔧 Backfilling isSystem flags...");

  const signals = await prisma.signalDefinition.updateMany({
    where: { slug: { in: SYSTEM_SIGNAL_SLUGS }, isSystem: false },
    data: { isSystem: true },
  });
  console.log(`  → SignalDefinition: ${signals.count} updated`);

  const filters = await prisma.filterDefinition.updateMany({
    where: { slug: { in: SYSTEM_FILTER_SLUGS }, isSystem: false },
    data: { isSystem: true },
  });
  console.log(`  → FilterDefinition: ${filters.count} updated`);

  console.log("✅ Backfill complete.");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
