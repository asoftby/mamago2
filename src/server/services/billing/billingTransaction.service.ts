import prisma from "@/lib/prisma";
import { BillingTransactionType, BillingTransactionStatus, Prisma } from "@prisma/client";
import { BILLING_CURRENCY, normalizeFinancialAmount } from "@/lib/billing/money";
import { BillingIdempotencyConflictError } from "./billingAccount.service";

type BillingTransactionFilters = {
  businessId?: string;
  accountId?: string;
  type?: BillingTransactionType;
  status?: BillingTransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
};

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

export const INTERNAL_BALANCE_REFUNDABLE_TYPES = new Set<BillingTransactionType>([
  BillingTransactionType.FEATURE_CHARGE,
  BillingTransactionType.PROMOTION_CHARGE,
  BillingTransactionType.LEAD_CHARGE,
]);

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

function buildBillingTransactionWhere(filters?: BillingTransactionFilters) {
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

  return where;
}

export async function getBillingTransactionsSummary(filters?: BillingTransactionFilters) {
  const where = buildBillingTransactionWhere(filters);
  const [rows, transactionsCount] = await Promise.all([
    prisma.billingTransaction.findMany({
      where,
      select: {
        type: true,
        status: true,
        amount: true,
      },
    }),
    prisma.billingTransaction.count({ where }),
  ]);

  const summary = rows.reduce(
    (summary, row) => {
      const amount = row.amount.toNumber();

      if (row.status === BillingTransactionStatus.SUCCEEDED) {
        summary.netChange += amount;

        if (row.type === BillingTransactionType.DEPOSIT_TOPUP) {
          summary.totalTopups += Math.abs(amount);
        } else if (row.type === BillingTransactionType.REFUND) {
          summary.totalRefunds += Math.abs(amount);
        } else if (amount < 0) {
          summary.totalCharges += Math.abs(amount);
        }
      }

      return summary;
    },
    {
      totalTopups: 0,
      totalCharges: 0,
      totalRefunds: 0,
      netChange: 0,
      transactionsCount,
    },
  );

  return {
    totalTopups: Number(summary.totalTopups.toFixed(2)),
    totalCharges: Number(summary.totalCharges.toFixed(2)),
    totalRefunds: Number(summary.totalRefunds.toFixed(2)),
    netChange: Number(summary.netChange.toFixed(2)),
    transactionsCount: summary.transactionsCount,
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

export async function getBillingTransactions(filters?: BillingTransactionFilters) {
  const where = buildBillingTransactionWhere(filters);

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
        childTransactions: {
          where: {
            type: BillingTransactionType.REFUND,
            status: BillingTransactionStatus.SUCCEEDED,
          },
          select: {
            id: true,
            amount: true,
            occurredAt: true,
            parentTransactionId: true,
            status: true,
            type: true,
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
async function createRefundOnce(params: {
  parentTransactionId: string;
  amount: number;
  currency: typeof BILLING_CURRENCY;
  idempotencyKey: string;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const { parentTransactionId, currency, idempotencyKey, reason, metadata } = params;
  const normalizedAmount = normalizeFinancialAmount(params.amount);

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
    if (!INTERNAL_BALANCE_REFUNDABLE_TYPES.has(parentTx.type)) {
      throw new RefundNotAllowedError("This transaction type cannot be refunded to internal balance");
    }
    if (parentTx.amount.gte(0)) {
      throw new RefundNotAllowedError("Only debit transactions can be refunded to internal balance");
    }
    if (currency !== BILLING_CURRENCY || parentTx.currency !== BILLING_CURRENCY) {
      throw new RefundNotAllowedError("Internal refunds support BYN only");
    }

    const existingRefund = await tx.billingTransaction.findFirst({
      where: {
        billingAccountId: parentTx.billingAccountId,
        idempotencyKey,
      },
    });
    if (existingRefund) {
      if (
        existingRefund.type !== BillingTransactionType.REFUND ||
        existingRefund.parentTransactionId !== parentTransactionId ||
        !existingRefund.amount.equals(normalizedAmount)
      ) {
        throw new BillingIdempotencyConflictError();
      }

      const existingSummary = buildRefundSummary({
        parentAmount: parentTx.amount,
        refunds: parentTx.childTransactions,
      });
      return {
        refund: existingRefund,
        refundSummaryBefore: existingSummary,
        refundSummaryAfter: existingSummary,
        business: parentTx.billingAccount.business,
        idempotentReplay: true,
      };
    }

    const refundSummary = buildRefundSummary({
      parentAmount: parentTx.amount,
      refunds: parentTx.childTransactions,
    });
    const refundAmount = normalizedAmount.toNumber();
    if (refundAmount > refundSummary.availableAmount) {
      throw new RefundAmountExceedsAvailableError({
        originalAmount: refundSummary.originalAmount,
        refundedAmount: refundSummary.refundedAmount,
        availableAmount: refundSummary.availableAmount,
        requestedAmount: refundAmount,
      });
    }

    const refund = await tx.billingTransaction.create({
      data: {
        billingAccountId: parentTx.billingAccountId,
        type: BillingTransactionType.REFUND,
        status: BillingTransactionStatus.SUCCEEDED,
        amount: normalizedAmount,
        currency: parentTx.currency,
        description: `Возврат: ${reason}`,
        parentTransactionId,
        idempotencyKey,
        referenceType: parentTx.referenceType,
        referenceId: parentTx.referenceId,
        metadata: metadata || { reason },
      },
    });

    await tx.billingAccount.update({
      where: { id: parentTx.billingAccountId },
      data: {
        depositBalance: {
          increment: normalizedAmount,
        },
      },
    });

    return {
      refund,
      refundSummaryBefore: refundSummary,
      refundSummaryAfter: {
        originalAmount: refundSummary.originalAmount,
        refundedAmount: Number((refundSummary.refundedAmount + refundAmount).toFixed(2)),
        availableAmount: Number((refundSummary.availableAmount - refundAmount).toFixed(2)),
        refundCount: refundSummary.refundCount + 1,
        canRefund: refundSummary.availableAmount - refundAmount > 0,
      },
      business: parentTx.billingAccount.business,
      idempotentReplay: false,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return result;
}

export async function createRefund(params: Parameters<typeof createRefundOnce>[0]) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await createRefundOnce(params);
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === 3) throw error;
    }
  }

  throw new Error("Refund retry loop exhausted");
}
