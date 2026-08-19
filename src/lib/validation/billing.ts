import { z } from "zod";

const financialAmountSchema = z.number().finite().positive().max(1_000_000).refine(
  (value) => Number.isInteger(value * 100),
  "Amount must have at most 2 decimal places",
);
const financialRequestKeySchema = z.string().trim().min(8).max(128);
const bynCurrencySchema = z.literal("BYN");

/**
 * Validation schemas for admin billing operations
 */

export const creditDepositSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  amount: financialAmountSchema,
  currency: bynCurrencySchema,
  idempotencyKey: financialRequestKeySchema,
  reason: z.string().min(1, "Reason is required"),
  note: z.string().optional(),
});

export const debitDepositSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  amount: financialAmountSchema,
  currency: bynCurrencySchema,
  idempotencyKey: financialRequestKeySchema,
  reason: z.string().min(1, "Reason is required"),
  note: z.string().optional(),
  allowNegative: z.boolean().optional().default(false),
});

export const refundTransactionSchema = z.object({
  transactionId: z.string().min(1, "Transaction ID is required"),
  amount: financialAmountSchema,
  currency: bynCurrencySchema,
  idempotencyKey: financialRequestKeySchema,
  reason: z.string().min(1, "Reason is required"),
  note: z.string().optional(),
});

export const suspendAccountSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
  reason: z.string().min(1, "Reason is required"),
});

export const reactivateAccountSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
});

export const recalculateBalanceSchema = z.object({
  businessId: z.string().min(1, "Business ID is required"),
});

export const getTransactionsSchema = z.object({
  businessId: z.string().optional(),
  accountId: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0),
});

export type CreditDepositInput = z.infer<typeof creditDepositSchema>;
export type DebitDepositInput = z.infer<typeof debitDepositSchema>;
export type RefundTransactionInput = z.infer<typeof refundTransactionSchema>;
export type SuspendAccountInput = z.infer<typeof suspendAccountSchema>;
export type ReactivateAccountInput = z.infer<typeof reactivateAccountSchema>;
export type RecalculateBalanceInput = z.infer<typeof recalculateBalanceSchema>;
export type GetTransactionsInput = z.infer<typeof getTransactionsSchema>;
