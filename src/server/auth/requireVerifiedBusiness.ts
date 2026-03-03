/**
 * Server-side guard for verified business requirement
 * Use in API routes that create publications (Place/Offer/Event)
 */

import prisma from "@/lib/prisma";
import { canPublish } from "@/server/services/businessVerification.service";

/**
 * Verify that user's business is approved for publishing
 * @throws Error if business not found or not approved
 */
export async function requireVerifiedBusiness(userId: string): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { ownerUserId: userId },
    select: { id: true, verificationStatus: true },
  });

  if (!business) {
    throw new Error("BUSINESS_NOT_FOUND");
  }

  if (!canPublish(business.verificationStatus)) {
    throw new Error("BUSINESS_NOT_VERIFIED");
  }
}
