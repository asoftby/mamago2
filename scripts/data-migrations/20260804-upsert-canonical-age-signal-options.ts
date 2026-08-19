/**
 * 20260804-upsert-canonical-age-signal-options.ts
 *
 * Restore Event Wizard / public age chips to the canonical fine-grained set
 * from src/lib/config/ages.ts (AGE_OPTIONS).
 *
 * Context:
 * - Event Step1 loads ages from GET /api/public/signals/age (SignalDefinition slug=age).
 * - DEV still had the legacy coarse seed buckets only: 0-3, 3-5, 5-8, 8-12.
 * - Local already had the fine-grained options (plus leftover legacy rows).
 *
 * Behavior (idempotent):
 * 1) Upsert AGE_OPTIONS values under the active `age` SignalDefinition.
 * 2) Soft-deactivate legacy coarse values that are NOT in AGE_OPTIONS
 *    (0-3, 5-8, 8-12). Keeps 3-5 (canonical).
 * 3) Does NOT mutate Activity/Event ageTags or any content rows.
 *
 * Run: set -a; source .env; set +a; tsx scripts/data-migrations/20260804-upsert-canonical-age-signal-options.ts
 */

import { PrismaClient } from "@prisma/client";
import { AGE_OPTIONS } from "../../src/lib/config/ages";

const prisma = new PrismaClient();

const CANONICAL_VALUES = new Set(AGE_OPTIONS.map((o) => o.key));

/** Legacy seed buckets that conflict with the fine-grained wizard set. */
const LEGACY_COARSE_VALUES = ["0-3", "5-8", "8-12"] as const;

async function main() {
  console.log("🔧 Upserting canonical age SignalOptions...");

  const def = await prisma.signalDefinition.findFirst({
    where: { slug: "age", isActive: true },
    select: { id: true, slug: true },
  });

  if (!def) {
    throw new Error('Active SignalDefinition slug="age" not found');
  }

  console.log(`  → definitionId=${def.id}`);

  let upserted = 0;
  for (const opt of AGE_OPTIONS) {
    await prisma.signalOption.upsert({
      where: {
        definitionId_value: { definitionId: def.id, value: opt.key },
      },
      update: {
        label: opt.label,
        order: opt.order,
        isActive: true,
      },
      create: {
        definitionId: def.id,
        value: opt.key,
        label: opt.label,
        order: opt.order,
        isActive: true,
      },
    });
    upserted += 1;
  }
  console.log(`  → upserted/activated: ${upserted} canonical options`);

  const deactivated = await prisma.signalOption.updateMany({
    where: {
      definitionId: def.id,
      value: { in: [...LEGACY_COARSE_VALUES] },
      isActive: true,
    },
    data: { isActive: false },
  });
  console.log(`  → soft-deactivated legacy coarse: ${deactivated.count}`);

  // Local may have used value "18" instead of canonical "18+".
  const deactivated18 = await prisma.signalOption.updateMany({
    where: {
      definitionId: def.id,
      value: "18",
      isActive: true,
    },
    data: { isActive: false },
  });
  if (deactivated18.count > 0) {
    console.log(`  → soft-deactivated non-canonical value "18": ${deactivated18.count}`);
  }

  const active = await prisma.signalOption.findMany({
    where: { definitionId: def.id, isActive: true },
    orderBy: [{ order: "asc" }, { value: "asc" }],
    select: { value: true, label: true, order: true },
  });

  console.log("  → active options after migration:");
  for (const row of active) {
    const mark = CANONICAL_VALUES.has(row.value) ? "✓" : "?";
    console.log(`     ${mark} [${row.order}] ${row.value} — ${row.label}`);
  }

  const unexpected = active.filter((r) => !CANONICAL_VALUES.has(r.value));
  if (unexpected.length > 0) {
    console.warn(
      `  ⚠ unexpected active values remain: ${unexpected.map((r) => r.value).join(", ")}`,
    );
  }

  console.log("✅ Age signal options migration complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
