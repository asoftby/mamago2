import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Paid Boost spends the business deposit. Only a principal who may see that
 * deposit may spend it: the same predicate as the billing read guard
 * (business owner of record with an active OWNER membership). MANAGER keeps
 * the free daily Boost, which does not touch money.
 */
export class PaidBoostOwnerRequiredError extends Error {
  code = "PAID_BOOST_OWNER_REQUIRED" as const;
  constructor() {
    super("Платный Boost может приобрести только владелец бизнеса.");
    this.name = "PaidBoostOwnerRequiredError";
  }
}

export function activeBillingOwnerWhere(businessId: string, userId: string): Prisma.BusinessWhereInput {
  return {
    id: businessId,
    ownerUserId: userId,
    members: { some: { userId, isActive: true, role: "OWNER" } },
  };
}

export async function canPurchasePaidBoost(userId: string, businessId: string, db: Db = prisma): Promise<boolean> {
  if (!userId || !businessId) return false;
  const business = await db.business.findFirst({
    where: activeBillingOwnerWhere(businessId, userId),
    select: { id: true },
  });
  return Boolean(business);
}

/** Must run inside the purchase transaction, before replay lookup or any debit. */
export async function assertPaidBoostOwnerInTx(tx: Prisma.TransactionClient, businessId: string, userId: string) {
  if (!(await canPurchasePaidBoost(userId, businessId, tx))) {
    throw new PaidBoostOwnerRequiredError();
  }
}
