import { z } from "zod";

/** Billing identity is not the public Business profile. */
export const billingPayerProfileSchema = z.discriminatedUnion("payerType", [
  z.object({
    payerType: z.literal("LEGAL_ENTITY"),
    legalName: z.string().trim().min(2).max(250),
    unp: z.string().regex(/^\d{9}$/),
    legalAddress: z.string().trim().min(5).max(500),
  }),
  z.object({
    payerType: z.literal("SOLE_PROPRIETOR"),
    legalName: z.string().trim().min(2).max(250),
    unp: z.string().regex(/^\d{9}$/),
    legalAddress: z.string().trim().max(500).optional(),
  }),
  z.object({
    payerType: z.literal("SELF_EMPLOYED"),
    legalName: z.string().trim().min(2).max(250),
    unp: z.string().regex(/^\d{9}$/).optional(),
    legalAddress: z.string().trim().max(500).optional(),
  }),
]);
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const billingPayerDetailsSchema = z.object({
  bankName: optionalText(200), bankCode: optionalText(30), bankAccount: optionalText(64),
  contactName: optionalText(200), contactEmail: z.union([z.literal(""), z.string().email()]).optional(),
  contactPhone: optionalText(50), signatoryName: optionalText(200),
  signatoryPosition: optionalText(100), signatoryBasis: optionalText(200),
});
export const billingPayerInputSchema = z.intersection(billingPayerProfileSchema, billingPayerDetailsSchema);
export type BillingPayerInput = z.infer<typeof billingPayerInputSchema>;
export type BillingPayerIdentity = z.infer<typeof billingPayerProfileSchema>;
