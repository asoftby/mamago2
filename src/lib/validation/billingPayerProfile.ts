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
export type BillingPayerIdentity = z.infer<typeof billingPayerProfileSchema>;
