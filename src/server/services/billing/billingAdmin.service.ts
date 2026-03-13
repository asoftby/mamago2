import prisma from "@/lib/prisma";

export async function getBillingOverview() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    revenueToday,
    revenueThisMonth,
    successfulChargesMonth,
    failedPayments,
    activePaidBusinesses,
    lowBalanceBusinesses,
    recentTransactions,
  ] = await Promise.all([
    // Revenue today
    prisma.billingTransaction.aggregate({
      where: {
        occurredAt: { gte: todayStart },
        status: "SUCCEEDED",
        type: { in: ["SUBSCRIPTION_CHARGE", "SUBSCRIPTION_RENEWAL", "DEPOSIT_TOPUP"] },
      },
      _sum: { amount: true },
    }),
    // Revenue this month
    prisma.billingTransaction.aggregate({
      where: {
        occurredAt: { gte: monthStart },
        status: "SUCCEEDED",
        type: { in: ["SUBSCRIPTION_CHARGE", "SUBSCRIPTION_RENEWAL", "DEPOSIT_TOPUP"] },
      },
      _sum: { amount: true },
    }),
    // Successful charges this month
    prisma.billingTransaction.count({
      where: {
        occurredAt: { gte: monthStart },
        status: "SUCCEEDED",
      },
    }),
    // Failed payments
    prisma.billingTransaction.count({
      where: {
        status: "FAILED",
        occurredAt: { gte: monthStart },
      },
    }),
    // Active paid businesses
    prisma.billingAccount.count({
      where: {
        status: "ACTIVE",
        subscriptions: {
          some: {
            status: "ACTIVE",
          },
        },
      },
    }),
    // Low balance businesses
    prisma.billingAccount.count({
      where: {
        status: "ACTIVE",
        depositBalance: {
          lt: 20,
        },
      },
    }),
    // Recent transactions
    prisma.billingTransaction.findMany({
      take: 10,
      orderBy: { occurredAt: "desc" },
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
      },
    }),
  ]);

  return {
    revenueToday: Math.abs(revenueToday._sum.amount?.toNumber() || 0),
    revenueThisMonth: Math.abs(revenueThisMonth._sum.amount?.toNumber() || 0),
    successfulChargesMonth,
    failedPayments,
    activePaidBusinesses,
    lowBalanceBusinesses,
    recentTransactions,
  };
}

export async function getBusinessesRequiringAttention() {
  const [lowBalance, pastDue, failedCharges] = await Promise.all([
    // Low balance
    prisma.billingAccount.findMany({
      where: {
        status: "ACTIVE",
        depositBalance: { lt: 20 },
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 10,
    }),
    // Past due subscriptions
    prisma.subscription.findMany({
      where: {
        status: "PAST_DUE",
      },
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
        plan: true,
      },
      take: 10,
    }),
    // Recent failed charges
    prisma.billingTransaction.findMany({
      where: {
        status: "FAILED",
        occurredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
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
      },
      take: 10,
    }),
  ]);

  return {
    lowBalance,
    pastDue,
    failedCharges,
  };
}
