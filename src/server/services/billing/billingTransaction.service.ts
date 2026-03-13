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

export async function createRefund(params: {
  parentTransactionId: string;
  amount: number;
  reason: string;
}) {
  const { parentTransactionId, amount, reason } = params;

  const parentTx = await prisma.billingTransaction.findUnique({
    where: { id: parentTransactionId },
  });

  if (!parentTx) {
    throw new Error("Parent transaction not found");
  }

  const refund = await prisma.billingTransaction.create({
    data: {
      billingAccountId: parentTx.billingAccountId,
      type: "REFUND",
      status: "SUCCEEDED",
      amount,
      currency: parentTx.currency,
      description: `Возврат: ${reason}`,
      parentTransactionId,
      referenceType: parentTx.referenceType,
      referenceId: parentTx.referenceId,
      metadata: { reason },
    },
  });

  // Update balance
  await prisma.billingAccount.update({
    where: { id: parentTx.billingAccountId },
    data: {
      depositBalance: {
        increment: amount,
      },
    },
  });

  return refund;
}
