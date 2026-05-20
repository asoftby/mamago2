import prisma from "@/lib/prisma";
import { BillingTransactionType, BillingTransactionStatus, Prisma } from "@prisma/client";

export class RefundAmountExceedsAvailableError extends Error {
  code = "REFUND_AMOUNT_EXCEEDS_AVAILABLE" as const;
  originalAmount: number;
  refundedAmount: number;
  availableAmount: number;
  requestedAmount: number;

  constructor(params: {
    originalAmount: number;
    refundedAmount: number;
    availableAmount: number;
    requestedAmount: number;
  }) {
    super("Refund amount exceeds available refundable amount");
    this.name = "RefundAmountExceedsAvailableError";
    this.originalAmount = params.originalAmount;
    this.refundedAmount = params.refundedAmount;
    this.availableAmount = params.availableAmount;
    this.requestedAmount = params.requestedAmount;
  }
}

export class RefundNotAllowedError extends Error {
  code = "REFUND_NOT_ALLOWED" as const;

  constructor(message: string) {
    super(message);
    this.name = "RefundNotAllowedError";
  }
}

function toNumber(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : value.toNumber();
}

function buildRefundSummary(params: {
  parentAmount: Prisma.Decimal | number;
  refunds: Array<{ amount: Prisma.Decimal | number }>;
}) {
  const originalAmount = Math.abs(toNumber(params.parentAmount));
  const refundedAmount = params.refunds.reduce((sum, refund) => sum + Math.abs(toNumber(refund.amount)), 0);
  const availableAmount = Math.max(0, Number((originalAmount - refundedAmount).toFixed(2)));

  return {
    originalAmount,
    refundedAmount,
    availableAmount,
    refundCount: params.refunds.length,
    canRefund: availableAmount > 0,
  };
}

/**
 * Get single transaction by ID with full details
 */
export async function getBillingTransactionById(id: string) {
  const transaction = await prisma.billingTransaction.findUnique({
    where: { id },
    include: {
      billingAccount: {
        include: {
          business: {
            select: {
              id: true,
              name: true,
              ownerUserId: true,
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

  if (!transaction) {
    return null;
  }

  if (transaction.type === BillingTransactionType.REFUND && transaction.parentTransactionId) {
    const parentTransaction = await prisma.billingTransaction.findUnique({
      where: { id: transaction.parentTransactionId },
      include: {
        childTransactions: {
          where: {
            type: BillingTransactionType.REFUND,
            status: BillingTransactionStatus.SUCCEEDED,
          },
          orderBy: {
            occurredAt: "desc",
          },
        },
      },
    });

    const refundSummary = parentTransaction
      ? buildRefundSummary({
          parentAmount: parentTransaction.amount,
          refunds: parentTransaction.childTransactions,
        })
      : buildRefundSummary({
          parentAmount: transaction.amount,
          refunds: [],
        });

    return {
      ...transaction,
      refundSummary,
      refundTransactions: parentTransaction?.childTransactions ?? [],
    };
  }

  const refundTransactions = transaction.childTransactions.filter(
    (child) =>
      child.type === BillingTransactionType.REFUND &&
      child.status === BillingTransactionStatus.SUCCEEDED,
  );

  const refundSummary = buildRefundSummary({
    parentAmount: transaction.amount,
    refunds: refundTransactions,
  });

  return {
    ...transaction,
    refundSummary,
    refundTransactions,
  };
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

export async function getRefundPreview(parentTransactionId: string) {
  const transaction = await prisma.billingTransaction.findUnique({
    where: { id: parentTransactionId },
    include: {
      childTransactions: {
        where: {
          type: BillingTransactionType.REFUND,
          status: BillingTransactionStatus.SUCCEEDED,
        },
        orderBy: {
          occurredAt: "desc",
        },
      },
    },
  });

  if (!transaction) {
    throw new Error("Parent transaction not found");
  }

  if (transaction.status !== BillingTransactionStatus.SUCCEEDED) {
    throw new RefundNotAllowedError("Can only refund succeeded transactions");
  }

  if (transaction.type === BillingTransactionType.REFUND) {
    throw new RefundNotAllowedError("Cannot refund a refund transaction");
  }

  return buildRefundSummary({
    parentAmount: transaction.amount,
    refunds: transaction.childTransactions,
  });
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

  const result = await prisma.$transaction(async (tx) => {
    // Lock the parent transaction row to serialize concurrent refund attempts.
    await tx.$queryRaw`
      SELECT id
      FROM "BillingTransaction"
      WHERE id = ${parentTransactionId}
      FOR UPDATE
    `;

    const parentTx = await tx.billingTransaction.findUnique({
      where: { id: parentTransactionId },
      include: {
        childTransactions: {
          where: {
            type: BillingTransactionType.REFUND,
            status: BillingTransactionStatus.SUCCEEDED,
          },
          orderBy: {
            occurredAt: "desc",
          },
        },
        billingAccount: {
          include: {
            business: {
              select: {
                id: true,
                name: true,
                ownerUserId: true,
              },
            },
          },
        },
      },
    });

    if (!parentTx) {
      throw new Error("Parent transaction not found");
    }

    // Validation
    if (parentTx.status !== BillingTransactionStatus.SUCCEEDED) {
      throw new RefundNotAllowedError("Can only refund succeeded transactions");
    }

    if (parentTx.type === BillingTransactionType.REFUND) {
      throw new RefundNotAllowedError("Cannot refund a refund transaction");
    }

    const refundSummary = buildRefundSummary({
      parentAmount: parentTx.amount,
      refunds: parentTx.childTransactions,
    });
    if (amount > refundSummary.availableAmount) {
      throw new RefundAmountExceedsAvailableError({
        originalAmount: refundSummary.originalAmount,
        refundedAmount: refundSummary.refundedAmount,
        availableAmount: refundSummary.availableAmount,
        requestedAmount: amount,
      });
    }

    const refund = await tx.billingTransaction.create({
      data: {
        billingAccountId: parentTx.billingAccountId,
        type: BillingTransactionType.REFUND,
        status: BillingTransactionStatus.SUCCEEDED,
        amount,
        currency: parentTx.currency,
        description: `Возврат: ${reason}`,
        parentTransactionId,
        referenceType: parentTx.referenceType,
        referenceId: parentTx.referenceId,
        metadata: metadata || { reason },
      },
    });

    await tx.billingAccount.update({
      where: { id: parentTx.billingAccountId },
      data: {
        depositBalance: {
          increment: amount,
        },
      },
    });

    return {
      refund,
      refundSummaryBefore: refundSummary,
      refundSummaryAfter: {
        originalAmount: refundSummary.originalAmount,
        refundedAmount: Number((refundSummary.refundedAmount + amount).toFixed(2)),
        availableAmount: Number((refundSummary.availableAmount - amount).toFixed(2)),
        refundCount: refundSummary.refundCount + 1,
        canRefund: refundSummary.availableAmount - amount > 0,
      },
      business: parentTx.billingAccount.business,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return result;
}
