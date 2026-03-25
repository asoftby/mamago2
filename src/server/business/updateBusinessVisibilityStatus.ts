import prisma from "@/lib/prisma";
import type { BusinessOperationalStatus } from "@prisma/client";

/**
 * Видимость бизнеса на сайте (поле `operationalStatus` в БД).
 * Не путать с `verificationStatus` (заявка: PENDING / APPROVED / REJECTED).
 */
export async function updateBusinessVisibilityStatus(
  businessId: string,
  status: BusinessOperationalStatus,
): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { operationalStatus: status },
  });
}
