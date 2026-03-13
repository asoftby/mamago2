import prisma from "@/lib/prisma";

/**
 * Get comprehensive billing summary for a specific business
 */
export async function getBusinessBillingSummary(businessId: string) {
  const account = await prisma.billingAccount.findUnique({
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

  if (!account) {
    return null;
  }

  // Calculate month spent
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthTransactions = await prisma.billingTransaction.findMany({
    where: {
      billingAccountId: account.id,
      occurredAt: { gte: monthStart },
      status: "SUCCEEDED",
      amount: { lt: 0 },
    },
    select: {
      amount: true,
    },
  });

  const monthSpent = monthTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount.toNumber()),
    0
  );

  return {
    account,
    currentSubscription: account.subscriptions[0] || null,
    defaultPaymentMethod: account.paymentMethods[0] || null,
    monthSpent,
  };
}

/**
 * Get recent transactions for a business
 */
export async function getBusinessRecentTransactions(businessId: string, limit = 10) {
  const account = await prisma.billingAccount.findUnique({
    where: { businessId },
    select: { id: true },
  });

  if (!account) {
    return [];
  }

  return prisma.billingTransaction.findMany({
    where: {
      billingAccountId: account.id,
    },
    include: {
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
    take: limit,
  });
}

/**
 * Get business subscription details
 */
export async function getBusinessSubscription(businessId: string) {
  const account = await prisma.billingAccount.findUnique({
    where: { businessId },
    select: { id: true },
  });

  if (!account) {
    return null;
  }

  return prisma.subscription.findFirst({
    where: {
      billingAccountId: account.id,
      status: {
        in: ["ACTIVE", "PAST_DUE", "TRIALING", "CANCELED"],
      },
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Get business payment methods
 */
export async function getBusinessPaymentMethods(businessId: string) {
  const account = await prisma.billingAccount.findUnique({
    where: { businessId },
    select: { id: true },
  });

  if (!account) {
    return [];
  }

  return prisma.paymentMethod.findMany({
    where: {
      billingAccountId: account.id,
      isActive: true,
    },
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "desc" },
    ],
  });
}
