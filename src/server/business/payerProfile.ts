import prisma from "@/lib/prisma";
import { billingPayerInputSchema, billingPayerDetailsSchema } from "@/lib/validation/billingPayerProfile";
import { businessPayerIdentity } from "@/lib/business/registrationIdentity";
import { z } from "zod";
const modeSchema = z.object({ identityMode: z.enum(["BUSINESS", "OTHER"]) });
const businessDetailsSchema = billingPayerDetailsSchema.extend({ legalAddress: z.string().trim().max(500).optional() });
export async function getBusinessPayer(ownerUserId: string) {
  const business = await prisma.business.findUnique({ where: { ownerUserId }, select: { id: true, subjectType: true, legalName: true, registrationFullName: true, unp: true, billingPayerProfile: true } });
  if (!business) throw new Error("OWNER_REQUIRED");
  const stored = business.billingPayerProfile;
  const identityMode = stored?.identityMode ?? "BUSINESS";
  return { profile: identityMode === "BUSINESS" ? { ...stored, ...businessPayerIdentity(business), identityMode } : stored, identityMode, businessIdentity: businessPayerIdentity(business) };
}
export async function saveBusinessPayer(ownerUserId: string, payload: unknown) {
  const mode = modeSchema.parse(payload);
  const parsed = mode.identityMode === "BUSINESS" ? businessDetailsSchema.parse(payload) : billingPayerInputSchema.parse(payload);
  const business = await prisma.business.findUnique({ where: { ownerUserId }, select: { id: true } });
  if (!business) throw new Error("OWNER_REQUIRED");
  // No writable duplicate of canonical registration identity in BUSINESS mode.
  const identity = mode.identityMode === "BUSINESS" ? { payerType: "BUSINESS", legalName: "", unp: null } : {};
  const data = { ...parsed, ...identity, identityMode: mode.identityMode };
  return prisma.billingPayerProfile.upsert({ where: { businessId: business.id }, create: { businessId: business.id, payerType: "BUSINESS", legalName: "", ...data }, update: data });
}
