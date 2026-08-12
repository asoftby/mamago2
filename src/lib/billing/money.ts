import { Prisma } from "@prisma/client";

export const BILLING_CURRENCY = "BYN" as const;
export const MAX_FINANCIAL_AMOUNT = new Prisma.Decimal("1000000.00");

export class InvalidFinancialAmountError extends Error {
  code = "INVALID_FINANCIAL_AMOUNT" as const;

  constructor(message: string) {
    super(message);
    this.name = "InvalidFinancialAmountError";
  }
}

export function normalizeFinancialAmount(value: number | string | Prisma.Decimal) {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new InvalidFinancialAmountError("Amount must be a finite decimal value");
  }

  if (!amount.isFinite() || amount.lte(0)) {
    throw new InvalidFinancialAmountError("Amount must be positive and finite");
  }
  if (amount.decimalPlaces() > 2) {
    throw new InvalidFinancialAmountError("Amount must have at most 2 decimal places");
  }
  if (amount.gt(MAX_FINANCIAL_AMOUNT)) {
    throw new InvalidFinancialAmountError("Amount exceeds the allowed maximum");
  }

  return amount.toDecimalPlaces(2);
}
