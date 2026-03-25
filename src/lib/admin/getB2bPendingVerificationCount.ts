import prisma from "@/lib/prisma";

/** Заявки в очереди «На проверке» (совпадает с вкладкой PENDING в /admin/b2b/requests). */
export async function getB2bPendingVerificationCount(): Promise<number> {
  return prisma.business.count({
    where: { verificationStatus: "PENDING" },
  });
}
