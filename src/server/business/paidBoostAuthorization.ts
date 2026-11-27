import "server-only";

import prisma from "@/lib/prisma";

/** Explicit paid-billing authorization scoped to the selected business. */
export async function hasActiveBusinessOwnerMembership(userId: string, businessId: string): Promise<boolean> {
  const member = await prisma.businessMember.findFirst({
    where: { userId, businessId, isActive: true, role: "OWNER" },
    select: { id: true },
  });
  return member !== null;
}
