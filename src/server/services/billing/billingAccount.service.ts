/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma";
import { BillingAccountStatus, Prisma } from "@prisma/client";

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
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" },
        ],
      },
    },
  });
}

/**
 * Check if account has sufficient balance for a charge
 */
export async function checkSufficientBalance(
  accountId: string,
  amount: number
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
    // Get all succeeded transactions
    const transactions = await tx.billingTransaction.findMany({
      where: {
        billingAccountId: accountId,
        status: "SUCCEEDED",
      },
      select: {
        amount: true,
      },
    });

    // Calculate balance from ledger
    const calculatedBalance = transactions.reduce((sum, txn) => {
      return sum + txn.amount.toNumber();
    }, 0);

    // Update account balance
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

/**
 * Credit business deposit (add money)
 * Atomic operation using Prisma transaction
 */
export async function creditBusinessDeposit(params: {
  accountId: string;
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const { accountId, amount, description, referenceType, referenceId, metadata } = params;

  // Validate amount
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Execute in atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create transaction record
    const transaction = await tx.billingTransaction.create({
      data: {
        billingAccountId: accountId,
        type: "DEPOSIT_TOPUP",
        status: "SUCCEEDED",
        amount,
        currency: "BYN",
        description,
        referenceType: (referenceType as any) || "MANUAL",
        referenceId,
        metadata,
      },
    });

    // Update balance atomically
    const updatedAccount = await tx.billingAccount.update({
      where: { id: accountId },
      data: {
        depositBalance: {
          increment: amount,
        },
      },
    });

    return { transaction, account: updatedAccount };
  });

  return result.transaction;
}

/**
 * Debit business deposit (charge money)
 * Atomic operation with idempotency protection
 */
export async function debitBusinessDeposit(params: {
  accountId: string;
  amount: number;
  type: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Prisma.InputJsonValue;
  allowNegative?: boolean;
}) {
  const { accountId, amount, type, description, referenceType, referenceId, metadata, allowNegative = false } = params;

  // Validate amount
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Idempotency check: prevent duplicate charges for same reference
  // Skip for MANUAL_ADJUSTMENT as multiple manual operations are allowed
  if (referenceType && referenceType !== "MANUAL" && referenceId) {
    const existingTransaction = await prisma.billingTransaction.findFirst({
      where: {
        billingAccountId: accountId,
        type: type as any,
        referenceType: referenceType as any,
        referenceId,
        status: "SUCCEEDED",
      },
    });

    if (existingTransaction) {
      // Return existing transaction instead of creating duplicate
      return existingTransaction;
    }
  }

  // Execute in atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // Get current account state
    const account = await tx.billingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error("Billing account not found");
    }

    // Calculate available balance
    const currentBalance = account.depositBalance.toNumber();
    const creditLimit = account.creditLimit.toNumber();
    const availableBalance = currentBalance + creditLimit;
    const newBalance = currentBalance - amount;

    // Check if sufficient funds (unless allowNegative is true)
    if (!allowNegative && newBalance < -creditLimit) {
      const error = new Error("Insufficient balance") as any;
      error.code = "INSUFFICIENT_FUNDS";
      error.currentBalance = currentBalance;
      error.creditLimit = creditLimit;
      error.availableBalance = availableBalance;
      error.requestedAmount = amount;
      error.shortfall = Math.abs(newBalance + creditLimit);
      throw error;
    }

    // Create transaction record
    const transaction = await tx.billingTransaction.create({
      data: {
        billingAccountId: accountId,
        type: type as any,
        status: "SUCCEEDED",
        amount: -amount, // Negative for debit
        currency: "BYN",
        description,
        referenceType: (referenceType as any) || "MANUAL",
        referenceId,
        metadata,
      },
    });

    // Update balance atomically
    const updatedAccount = await tx.billingAccount.update({
      where: { id: accountId },
      data: {
        depositBalance: {
          decrement: amount,
        },
      },
    });

    return { transaction, account: updatedAccount };
  });

  return result.transaction;
}

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
