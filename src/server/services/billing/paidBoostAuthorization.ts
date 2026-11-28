import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Paid Boost purchases are allowed to an active OWNER or MANAGER of the
 * selected, operationally ACTIVE business. This authorization is intentionally
 * separate from OWNER-only billing statements and account administration.
 */
export class PaidBoostMembershipRequiredError extends Error {
  code = "PAID_BOOST_MEMBERSHIP_REQUIRED" as const;
  constructor() {
    super("Платное продвижение доступно только активному владельцу или менеджеру бизнеса.");
    this.name = "PaidBoostMembershipRequiredError";
  }
}

export function activePaidBoostMemberWhere(businessId: string, userId: string): Prisma.BusinessWhereInput {
  return {
    id: businessId,
    operationalStatus: "ACTIVE",
    members: {
      some: {
        userId,
        isActive: true,
        role: { in: ["OWNER", "MANAGER"] },
      },
    },
  };
}

export async function canPurchasePaidBoost(userId: string, businessId: string, db: Db = prisma): Promise<boolean> {
  if (!userId || !businessId) return false;
  const business = await db.business.findFirst({
    where: activePaidBoostMemberWhere(businessId, userId),
    select: { id: true },
  });
  return Boolean(business);
}

/** Must execute within the purchase transaction, before replay lookup or debit. */
export async function assertPaidBoostPurchaserInTx(tx: Prisma.TransactionClient, businessId: string, userId: string) {
  if (!(await canPurchasePaidBoost(userId, businessId, tx))) {
    throw new PaidBoostMembershipRequiredError();
  }
}
