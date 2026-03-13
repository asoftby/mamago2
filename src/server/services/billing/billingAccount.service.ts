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
      lt: where.lowBalanceThreshold || 20,
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
 */
export async function recalculateDepositBalance(accountId: string) {
  const transactions = await prisma.billingTransaction.findMany({
    where: {
      billingAccountId: accountId,
      status: "SUCCEEDED",
    },
    select: {
      amount: true,
    },
  });

  const balance = transactions.reduce((sum, tx) => {
    return sum + tx.amount.toNumber();
  }, 0);

  await prisma.billingAccount.update({
    where: { id: accountId },
    data: { depositBalance: balance },
  });

  return balance;
}

/**
 * Credit business deposit (add money)
 */
export async function creditBusinessDeposit(params: {
  accountId: string;
  amount: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: any;
}) {
  const { accountId, amount, description, referenceType, referenceId, metadata } = params;

  // Create transaction
  const transaction = await prisma.billingTransaction.create({
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

  // Update balance
  await prisma.billingAccount.update({
    where: { id: accountId },
    data: {
      depositBalance: {
        increment: amount,
      },
    },
  });

  return transaction;
}

/**
 * Debit business deposit (charge money)
 */
export async function debitBusinessDeposit(params: {
  accountId: string;
  amount: number;
  type: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: any;
}) {
  const { accountId, amount, type, description, referenceType, referenceId, metadata } = params;

  // Check balance
  const account = await prisma.billingAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error("Billing account not found");
  }

  const newBalance = account.depositBalance.toNumber() - amount;
  if (newBalance < 0 && account.creditLimit.toNumber() === 0) {
    throw new Error("Insufficient balance");
  }

  // Create transaction
  const transaction = await prisma.billingTransaction.create({
    data: {
      billingAccountId: accountId,
      type: type as any,
      status: "SUCCEEDED",
      amount: -amount,
      currency: "BYN",
      description,
      referenceType: (referenceType as any) || "MANUAL",
      referenceId,
      metadata,
    },
  });

  // Update balance
  await prisma.billingAccount.update({
    where: { id: accountId },
    data: {
      depositBalance: {
        decrement: amount,
      },
    },
  });

  return transaction;
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
