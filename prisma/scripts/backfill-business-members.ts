/**
 * Backfill: для каждого Business без ACTIVE OWNER membership создаёт
 * BusinessMember(OWNER, isActive) по ownerUserId. Идемпотентно (upsert по
 * unique [businessId, userId]), транзакционно.
 *
 * Цель — снять зависимость кабинета от transitional-fallback в
 * getPartnerCabinetBusiness (см. тикет «BusinessMember backfill»).
 *
 * Dry-run (по умолчанию — НИЧЕГО не пишет, только отчёт):
 *   set -a; source .env; set +a; npx tsx prisma/scripts/backfill-business-members.ts
 * Применить:
 *   set -a; source .env; set +a; npx tsx prisma/scripts/backfill-business-members.ts --apply
 */

import { BusinessMemberRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";

  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      ownerUserId: true,
      members: { where: { isActive: true, role: "OWNER" }, select: { id: true } },
    },
  });

  const needBackfill = businesses.filter((b) => b.members.length === 0);
  const skippableNullOwner = needBackfill.filter((b) => !b.ownerUserId);
  const actionable = needBackfill.filter((b) => b.ownerUserId);

  console.log(`=== Backfill BusinessMember (OWNER) — ${mode} ===`);
  console.log(`Total businesses:                 ${businesses.length}`);
  console.log(`Already have ACTIVE OWNER:         ${businesses.length - needBackfill.length}`);
  console.log(`Missing ACTIVE OWNER:             ${needBackfill.length}`);
  console.log(`  → backfillable (has owner):      ${actionable.length}`);
  console.log(`  → SKIPPED (null ownerUserId):    ${skippableNullOwner.length}`);
  for (const b of skippableNullOwner) {
    console.warn(`    ! ${b.id} "${b.name}" has no ownerUserId — manual review needed`);
  }

  if (actionable.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  for (const b of actionable) {
    console.log(`  ${apply ? "+" : "would create"} OWNER member: business=${b.id} "${b.name}" user=${b.ownerUserId}`);
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    return;
  }

  const created = await prisma.$transaction(
    actionable.map((b) =>
      prisma.businessMember.upsert({
        where: { businessId_userId: { businessId: b.id, userId: b.ownerUserId! } },
        create: {
          businessId: b.id,
          userId: b.ownerUserId!,
          role: BusinessMemberRole.OWNER,
          isActive: true,
        },
        update: { role: BusinessMemberRole.OWNER, isActive: true },
      }),
    ),
  );

  console.log(`\nDone. Upserted ${created.length} OWNER membership row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
