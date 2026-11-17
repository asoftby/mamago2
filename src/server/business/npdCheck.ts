import prisma from "@/lib/prisma";
import { NPD_SOURCE } from "@/lib/business/registrationIdentity";
import { z } from "zod";
export const npdResultSchema = z.enum(["CONFIRMED", "NOT_FOUND", "UNAVAILABLE"]);
export async function recordNpdCheck(actor: { id: string; role: string }, id: string, result: unknown) {
  if (actor.role !== "ADMIN") throw new Error("ADMIN_REQUIRED");
  const checkedResult = npdResultSchema.parse(result);
    await prisma.$transaction(async tx => {
      const business = await tx.business.findUnique({ where: { id } });
      if (!business || business.subjectType !== "SELF_EMPLOYED_NPD" || business.verificationStatus !== "PENDING") throw new Error("Pending NPD application required");
      await tx.business.update({ where: { id, updatedAt: business.updatedAt }, data: { npdCheckStatus: checkedResult, npdCheckedAt: new Date(), npdCheckedByUserId: actor.id, npdCheckSource: NPD_SOURCE } });
      await tx.businessVerificationLog.create({ data: { businessId: id, statusFrom: business.verificationStatus, statusTo: business.verificationStatus, reviewedByUserId: actor.id, note: `НПД: ${checkedResult}; источник: ${NPD_SOURCE}` } });
    });
}
