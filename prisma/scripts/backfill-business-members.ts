/**
 * Одноразовый бэкфилл: для каждого Business создаёт BusinessMember(OWNER) по ownerUserId.
 * Запуск после миграции: pnpm tsx prisma/scripts/backfill-business-members.ts
 */

import { BusinessMemberRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const businesses = await prisma.business.findMany({
    select: { id: true, ownerUserId: true },
  });

  if (businesses.length === 0) {
    console.log("No businesses — nothing to do.");
    return;
  }

  const result = await prisma.businessMember.createMany({
    data: businesses.map((b) => ({
      businessId: b.id,
      userId: b.ownerUserId,
      role: BusinessMemberRole.OWNER,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  console.log(`BusinessMember rows created (skipped duplicates): ${result.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
