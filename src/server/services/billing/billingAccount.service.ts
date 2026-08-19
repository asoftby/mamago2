import prisma from "@/lib/prisma";
import {
  BillingAccountStatus,
  BillingReferenceType,
  BillingTransactionType,
  Prisma,
} from "@prisma/client";
import { BILLING_CURRENCY, normalizeFinancialAmount } from "@/lib/billing/money";

type BillingTxClient = Prisma.TransactionClient;

export class BillingInsufficientFundsError extends Error {
  code = "INSUFFICIENT_FUNDS" as const;
  currentBalance: number;
  creditLimit: number;
  availableBalance: number;
  requestedAmount: number;
  shortfall: number;

  constructor(params: {
    currentBalance: number;
    creditLimit: number;
    availableBalance: number;
    requestedAmount: number;
    shortfall: number;
  }) {
    super("Insufficient balance");
    this.name = "BillingInsufficientFundsError";
    this.currentBalance = params.currentBalance;
    this.creditLimit = params.creditLimit;
    this.availableBalance = params.availableBalance;
    this.requestedAmount = params.requestedAmount;
    this.shortfall = params.shortfall;
  }
}

export class BillingIdempotencyConflictError extends Error {
  code = "IDEMPOTENCY_CONFLICT" as const;

  constructor() {
    super("Idempotency key was already used for a different financial operation");
    this.name = "BillingIdempotencyConflictError";
  }
}

export interface DebitBusinessDepositParams {
  accountId: string;
  amount: number | string | Prisma.Decimal;
  type: BillingTransactionType;
  description: string;
  referenceType?: BillingReferenceType;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
  allowNegative?: boolean;
}

export interface CreditBusinessDepositParams {
  accountId: string;
  amount: number | string | Prisma.Decimal;
  description: string;
  referenceType?: BillingReferenceType;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
}

export function buildRequestChargeIdempotencyKey(params: {
  businessId: string;
  bookingRequestId: string;
  chargeType: "LEAD_CHARGE";
}) {
  return `${params.businessId}:${params.bookingRequestId}:${params.chargeType}`;
}

/**
 * Get billing account by business ID
 */
export async function getBillingAccountByBusinessId(businessId: string) {
  return prisma.billingAccount.findUnique({
    where: { businessId },
    include: {
      business: {
        include: {
          owner: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      subscriptions: {
        where: {
          status: {
            in: ["ACTIVE", "PAST_DUE", "TRIALING"],
          },
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      paymentMethods: {
        where: {
          isActive: true,
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
    },
  });
}

export async function ensureBillingAccountForBusiness(
  businessId: string,
  tx?: BillingTxClient,
) {
  const db = tx ?? prisma;

  return db.billingAccount.upsert({
    where: { businessId },
    update: {},
    create: {
      businessId,
      depositBalance: 0,
      currency: "BYN",
      status: BillingAccountStatus.ACTIVE,
      lowBalanceThreshold: 20,
      creditLimit: 0,
    },
  });
}

/**
 * Check if account has sufficient balance for a charge
 */
export async function checkSufficientBalance(
  accountId: string,
  amount: number,
): Promise<{
  sufficient: boolean;
  currentBalance: number;
  creditLimit: number;
  availableBalance: number;
  shortfall: number;
}> {
  const account = await prisma.billingAccount.findUnique({
    where: { id: accountId },
    select: {
      depositBalance: true,
      creditLimit: true,
    },
  });

  if (!account) {
    throw new Error("Billing account not found");
  }

  const currentBalance = account.depositBalance.toNumber();
  const creditLimit = account.creditLimit.toNumber();
  const availableBalance = currentBalance + creditLimit;
  const sufficient = availableBalance >= amount;
  const shortfall = sufficient ? 0 : amount - availableBalance;

  return {
    sufficient,
    currentBalance,
    creditLimit,
    availableBalance,
    shortfall,
  };
}

/**
 * Get all billing accounts with filters
 */
export async function getBillingAccounts(filters?: {
  status?: BillingAccountStatus;
  lowBalance?: boolean;
  search?: string;
}) {
  const where: Prisma.BillingAccountWhereInput = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.lowBalance) {
    where.depositBalance = {
      lt: 20,
    };
  }

  if (filters?.search) {
    where.business = {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { owner: { email: { contains: filters.search, mode: "insensitive" } } },
      ],
    };
  }

  return prisma.billingAccount.findMany({
    where,
    include: {
      business: {
        include: {
          owner: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      subscriptions: {
        where: {
          status: {
            in: ["ACTIVE", "PAST_DUE", "TRIALING"],
          },
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Recalculate deposit balance from transaction ledger
 * Atomic operation to ensure consistency
 */
export async function recalculateDepositBalance(accountId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const transactions = await tx.billingTransaction.findMany({
      where: {
        billingAccountId: accountId,
        status: "SUCCEEDED",
      },
      select: {
        amount: true,
      },
    });

    const calculatedBalance = transactions.reduce((sum, txn) => {
      return sum + txn.amount.toNumber();
    }, 0);

    const updatedAccount = await tx.billingAccount.update({
      where: { id: accountId },
      data: { depositBalance: calculatedBalance },
    });

    return {
      accountId,
      previousBalance: updatedAccount.depositBalance.toNumber(),
      calculatedBalance,
      transactionCount: transactions.length,
    };
  });

  return result.calculatedBalance;
}

async function findExistingTransactionByIdempotencyKey(
  tx: BillingTxClient,
  params: {
    accountId: string;
    idempotencyKey?: string;
  },
) {
  if (!params.idempotencyKey) return null;

  return tx.billingTransaction.findFirst({
    where: {
      billingAccountId: params.accountId,
      idempotencyKey: params.idempotencyKey,
    },
  });
}

async function creditBusinessDepositInTx(
  tx: BillingTxClient,
  params: CreditBusinessDepositParams,
) {
  const {
    accountId,
    amount,
    description,
    referenceType = BillingReferenceType.MANUAL,
    referenceId,
    idempotencyKey,
    metadata,
  } = params;

  const normalizedAmount = normalizeFinancialAmount(amount);

  // Serialize idempotency check and the balance mutation for this account.
  await tx.$queryRaw`SELECT id FROM "BillingAccount" WHERE id = ${accountId} FOR UPDATE`;

  const existingTransaction = await findExistingTransactionByIdempotencyKey(tx, {
    accountId,
    idempotencyKey,
  });
  if (existingTransaction) {
    if (
      existingTransaction.type !== BillingTransactionType.DEPOSIT_TOPUP ||
      !existingTransaction.amount.equals(normalizedAmount) ||
      existingTransaction.referenceType !== referenceType ||
      existingTransaction.referenceId !== (referenceId ?? null)
    ) {
      throw new BillingIdempotencyConflictError();
    }
    return existingTransaction;
  }

  const transaction = await tx.billingTransaction.create({
    data: {
      billingAccountId: accountId,
      type: BillingTransactionType.DEPOSIT_TOPUP,
      status: "SUCCEEDED",
      amount: normalizedAmount,
      currency: BILLING_CURRENCY,
      description,
      referenceType,
      referenceId,
      idempotencyKey,
      metadata,
    },
  });

  await tx.billingAccount.update({
    where: { id: accountId },
    data: {
      depositBalance: {
        increment: normalizedAmount,
      },
    },
  });

  return transaction;
}

/**
 * Credit business deposit (add money)
 * Atomic operation using Prisma transaction
 */
export async function creditBusinessDeposit(params: CreditBusinessDepositParams) {
  return prisma.$transaction(async (tx) => creditBusinessDepositInTx(tx, params));
}

export async function creditBusinessDepositWithResult(params: CreditBusinessDepositParams) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BillingAccount" WHERE id = ${params.accountId} FOR UPDATE`;
    const preExisting = await findExistingTransactionByIdempotencyKey(tx, params);
    const transaction = await creditBusinessDepositInTx(tx, params);
    const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: params.accountId } });
    return {
      transaction,
      idempotentReplay: Boolean(preExisting),
      balance: account.depositBalance.toNumber(),
    };
  });
}

async function debitBusinessDepositInTx(
  tx: BillingTxClient,
  params: DebitBusinessDepositParams,
) {
  const {
    accountId,
    amount,
    type,
    description,
    referenceType = BillingReferenceType.MANUAL,
    referenceId,
    idempotencyKey,
    metadata,
    allowNegative = false,
  } = params;

  const normalizedAmount = normalizeFinancialAmount(amount);

  // The lock makes the following sufficient-funds check authoritative.
  await tx.$queryRaw`SELECT id FROM "BillingAccount" WHERE id = ${accountId} FOR UPDATE`;

  const existingTransaction = await findExistingTransactionByIdempotencyKey(tx, {
    accountId,
    idempotencyKey,
  });
  if (existingTransaction) {
    if (
      existingTransaction.type !== type ||
      !existingTransaction.amount.equals(normalizedAmount.negated()) ||
      existingTransaction.referenceType !== referenceType ||
      existingTransaction.referenceId !== (referenceId ?? null)
    ) {
      throw new BillingIdempotencyConflictError();
    }
    return existingTransaction;
  }

  const account = await tx.billingAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error("Billing account not found");
  }

  const currentBalance = account.depositBalance.toNumber();
  const creditLimit = account.creditLimit.toNumber();
  const availableBalance = currentBalance + creditLimit;
  const requestedAmount = normalizedAmount.toNumber();
  const newBalance = currentBalance - requestedAmount;

  if (!allowNegative && newBalance < -creditLimit) {
    throw new BillingInsufficientFundsError({
      currentBalance,
      creditLimit,
      availableBalance,
      requestedAmount,
      shortfall: Math.abs(newBalance + creditLimit),
    });
  }

  const transaction = await tx.billingTransaction.create({
    data: {
      billingAccountId: accountId,
      type,
      status: "SUCCEEDED",
      amount: normalizedAmount.negated(),
      currency: account.currency,
      description,
      referenceType,
      referenceId,
      idempotencyKey,
      metadata,
    },
  });

  await tx.billingAccount.update({
    where: { id: accountId },
    data: {
      depositBalance: {
        decrement: normalizedAmount,
      },
    },
  });

  return transaction;
}

/**
 * Debit business deposit (charge money)
 * Atomic operation with DB-backed idempotency key support
 */
export async function debitBusinessDeposit(params: DebitBusinessDepositParams) {
  return prisma.$transaction(async (tx) => debitBusinessDepositInTx(tx, params));
}

export async function debitBusinessDepositWithResult(params: DebitBusinessDepositParams) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "BillingAccount" WHERE id = ${params.accountId} FOR UPDATE`;
    const preExisting = await findExistingTransactionByIdempotencyKey(tx, params);
    const transaction = await debitBusinessDepositInTx(tx, params);
    const account = await tx.billingAccount.findUniqueOrThrow({ where: { id: params.accountId } });
    return {
      transaction,
      idempotentReplay: Boolean(preExisting),
      balance: account.depositBalance.toNumber(),
    };
  });
}

export async function debitLeadChargeForBookingRequest(params: {
  businessId: string;
  bookingRequestId: string;
  amount: number;
  description: string;
  metadata?: Prisma.InputJsonValue;
  allowNegative?: boolean;
}) {
  const account = await getBillingAccountByBusinessId(params.businessId);

  if (!account) {
    throw new Error("Billing account not found");
  }

  return debitBusinessDeposit({
    accountId: account.id,
    amount: params.amount,
    type: BillingTransactionType.LEAD_CHARGE,
    description: params.description,
    referenceType: BillingReferenceType.REQUEST,
    referenceId: params.bookingRequestId,
    idempotencyKey: buildRequestChargeIdempotencyKey({
      businessId: params.businessId,
      bookingRequestId: params.bookingRequestId,
      chargeType: "LEAD_CHARGE",
    }),
    metadata: params.metadata,
    allowNegative: params.allowNegative ?? false,
  });
}

export { creditBusinessDepositInTx, debitBusinessDepositInTx };

/**
 * Suspend billing account
 */
export async function suspendBillingAccount(accountId: string, reason: string) {
  return prisma.billingAccount.update({
    where: { id: accountId },
    data: {
      status: BillingAccountStatus.SUSPENDED,
      suspendedAt: new Date(),
      suspendedReason: reason,
    },
  });
}

/**
 * Reactivate billing account
 */
export async function reactivateBillingAccount(accountId: string) {
  return prisma.billingAccount.update({
    where: { id: accountId },
    data: {
      status: BillingAccountStatus.ACTIVE,
      suspendedAt: null,
      suspendedReason: null,
    },
  });
}
