import prisma from "@/lib/prisma";
import { BillingTransactionType, BillingTransactionStatus, Prisma } from "@prisma/client";

/**
 * Get single transaction by ID with full details
 */
export async function getBillingTransactionById(id: string) {
  return prisma.billingTransaction.findUnique({
    where: { id },
    include: {
      billingAccount: {
        include: {
          business: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      paymentMethod: true,
      subscription: {
        include: {
          plan: true,
        },
      },
      parentTransaction: true,
      childTransactions: true,
    },
  });
}

export async function getBillingTransactions(filters?: {
  businessId?: string;
  accountId?: string;
  type?: BillingTransactionType;
  status?: BillingTransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.BillingTransactionWhereInput = {};

  if (filters?.accountId) {
    where.billingAccountId = filters.accountId;
  }

  if (filters?.businessId) {
    where.billingAccount = {
      businessId: filters.businessId,
    };
  }

  if (filters?.type) {
    where.type = filters.type;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.occurredAt = {};
    if (filters.dateFrom) where.occurredAt.gte = filters.dateFrom;
    if (filters.dateTo) where.occurredAt.lte = filters.dateTo;
  }

  const [transactions, total] = await Promise.all([
    prisma.billingTransaction.findMany({
      where,
      include: {
        billingAccount: {
          include: {
            business: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        paymentMethod: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        occurredAt: "desc",
      },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    prisma.billingTransaction.count({ where }),
  ]);

  return { transactions, total };
}

/**
 * Create refund transaction (atomic operation)
 * Refunds add money back to the account
 */
export async function createRefund(params: {
  parentTransactionId: string;
  amount: number;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const { parentTransactionId, amount, reason, metadata } = params;

  // Validate amount
  if (amount <= 0) {
    throw new Error("Refund amount must be positive");
  }

  // Execute in atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    // Get parent transaction
    const parentTx = await tx.billingTransaction.findUnique({
      where: { id: parentTransactionId },
      include: {
        childTransactions: {
          where: { type: "REFUND" },
        },
      },
    });

    if (!parentTx) {
      throw new Error("Parent transaction not found");
    }

    // Validation
    if (parentTx.status !== "SUCCEEDED") {
      throw new Error("Can only refund succeeded transactions");
    }

    if (parentTx.type === "REFUND") {
      throw new Error("Cannot refund a refund transaction");
    }

    // Check if already refunded
    if (parentTx.childTransactions && parentTx.childTransactions.length > 0) {
      throw new Error("Transaction already has a refund");
    }

    const parentAmount = Math.abs(parentTx.amount.toNumber());
    if (amount > parentAmount) {
      const error = new Error("Refund amount exceeds original transaction") as Error & {
        code: string;
        originalAmount: number;
        requestedAmount: number;
      };
      error.code = "REFUND_AMOUNT_EXCEEDS_ORIGINAL";
      error.originalAmount = parentAmount;
      error.requestedAmount = amount;
      throw error;
    }

    // Create refund transaction
    const refund = await tx.billingTransaction.create({
      data: {
        billingAccountId: parentTx.billingAccountId,
        type: "REFUND",
        status: "SUCCEEDED",
        amount, // Positive amount (adds to balance)
        currency: parentTx.currency,
        description: `Возврат: ${reason}`,
        parentTransactionId,
        referenceType: parentTx.referenceType,
        referenceId: parentTx.referenceId,
        metadata: metadata || { reason },
      },
    });

    // Update balance atomically
    await tx.billingAccount.update({
      where: { id: parentTx.billingAccountId },
      data: {
        depositBalance: {
          increment: amount,
        },
      },
    });

    return refund;
  });

  return result;
}
