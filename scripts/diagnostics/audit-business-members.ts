/**
 * READ-ONLY audit: how many Business rows lack any BusinessMember, and how that
 * correlates with status / APPROVED. No writes. See ticket: BusinessMember backfill.
 * Run: set -a; source .env; set +a; npx tsx scripts/diagnostics/audit-business-members.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [total, byStatus, businesses, totalMembers, activeOwnerMembers] = await Promise.all([
    prisma.business.count(),
    prisma.business.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.business.findMany({
      select: {
        id: true,
        status: true,
        ownerUserId: true,
        _count: { select: { members: true } },
      },
    }),
    prisma.businessMember.count(),
    prisma.businessMember.count({ where: { isActive: true, role: "OWNER" } }),
  ]);

  const noMembers = businesses.filter((b) => b._count.members === 0);
  const noMembersByStatus = noMembers.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  // businesses lacking an ACTIVE OWNER membership specifically
  const withActiveOwner = await prisma.business.findMany({
    where: { members: { some: { isActive: true, role: "OWNER" } } },
    select: { id: true },
  });
  const withActiveOwnerSet = new Set(withActiveOwner.map((b) => b.id));
  const missingActiveOwner = businesses.filter((b) => !withActiveOwnerSet.has(b.id));

  console.log("=== BusinessMember audit (read-only) ===");
  console.log("Total businesses:", total);
  console.log("By status:", Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])));
  console.log("Total BusinessMember rows:", totalMembers);
  console.log("Active OWNER member rows:", activeOwnerMembers);
  console.log("");
  console.log("Businesses with ZERO BusinessMember rows:", noMembers.length);
  console.log("  by status:", noMembersByStatus);
  console.log("");
  console.log("Businesses missing an ACTIVE OWNER membership:", missingActiveOwner.length);
  console.log(
    "  of which status=APPROVED:",
    missingActiveOwner.filter((b) => b.status === "APPROVED").length,
  );
  const nullOwner = businesses.filter((b) => !b.ownerUserId);
  console.log("");
  console.log("Businesses with null ownerUserId (cannot backfill):", nullOwner.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
