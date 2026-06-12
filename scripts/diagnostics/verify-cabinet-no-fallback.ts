/**
 * READ-ONLY verification: for every business owner, the partner cabinet resolves
 * via BusinessMember ALONE (fallback to Business.ownerUserId disabled). Confirms
 * acceptance: cabinet works with the transitional fallback off. No writes.
 */

import { BusinessMemberRole, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// getPartnerCabinetBusiness with the transitional ownerUserId fallback removed.
async function resolveMembershipOnly(userId: string) {
  const member = await prisma.businessMember.findFirst({
    where: {
      userId,
      isActive: true,
      role: { in: [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER] },
    },
    orderBy: { createdAt: "asc" },
    include: { business: true },
  });
  return member?.business ?? null;
}

async function main() {
  const owners = await prisma.business.findMany({
    select: { id: true, name: true, ownerUserId: true },
  });

  let ok = 0;
  let fail = 0;
  for (const b of owners) {
    if (!b.ownerUserId) continue;
    const resolved = await resolveMembershipOnly(b.ownerUserId);
    const good = resolved?.id === b.id;
    console.log(`${good ? "OK " : "FAIL"}  owner=${b.ownerUserId} business="${b.name}" → ${resolved?.id ?? "null"}`);
    good ? ok++ : fail++;
  }

  console.log(`\nResolved via membership only: ${ok} ok, ${fail} fail.`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
