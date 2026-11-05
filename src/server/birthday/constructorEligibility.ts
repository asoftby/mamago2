import type { Prisma } from "@prisma/client";

export const constructorBusinessSelect = {
  id: true, operationalStatus: true, verificationStatus: true,
  billingAccount: { select: { status: true, depositBalance: true } },
} satisfies Prisma.BusinessSelect;
type ConstructorBusiness = Prisma.BusinessGetPayload<{ select: typeof constructorBusinessSelect }>;

/** One admission predicate, independent of promotions, credit limits and ranking. No billing writes. */
export function isEligibleForConstructor(business: ConstructorBusiness | null | undefined): boolean {
  return Boolean(business && business.operationalStatus === "ACTIVE" &&
    business.verificationStatus === "APPROVED" && business.billingAccount?.status === "ACTIVE" &&
    business.billingAccount.depositBalance.greaterThan(0));
}
