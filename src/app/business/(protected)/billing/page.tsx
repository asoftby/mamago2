import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getBillingAccountByBusinessId } from "@/server/services/billing/billingAccount.service";
import { BalancePage } from "./BalancePage";
import { getBusinessResolvedBillingActionPrices } from "@/server/services/billing/billingActionRateResolver.service";
import {
  BILLING_ACTION_SHORT_TITLES,
  formatBillingActionPrice,
} from "@/lib/billing/actionPricing";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillingBalancePage() {
  if (process.env.NEXT_PUBLIC_BILLING_ENABLED !== "true") {
    redirect("/business/dashboard");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Get user's business
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
    },
  });

  if (!business) {
    redirect("/business/onboarding");
  }

  // Get billing account
  const account = await getBillingAccountByBusinessId(business.id);

  // Get recent transactions
  const recentTransactions = account
    ? await prisma.billingTransaction.findMany({
        where: {
          billingAccountId: account.id,
        },
        orderBy: {
          occurredAt: "desc",
        },
        take: 5,
      })
    : [];

  // Calculate stats for current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTransactions = account
    ? await prisma.billingTransaction.findMany({
        where: {
          billingAccountId: account.id,
          occurredAt: {
            gte: startOfMonth,
          },
          amount: {
            lt: 0, // Only charges (negative amounts)
          },
          status: "SUCCEEDED",
        },
      })
    : [];

  const monthSpent = monthTransactions.reduce(
    (sum, tx) => sum + Math.abs(tx.amount.toNumber()),
    0
  );
  const chargesCount = monthTransactions.length;
  const averageCharge = chargesCount > 0 ? monthSpent / chargesCount : 0;
  const lastCharge = monthTransactions[0] || null;
  const leadsCount = monthTransactions.filter((tx) => tx.type === "LEAD_CHARGE").length;

  const resolvedPrices = await getBusinessResolvedBillingActionPrices({
    businessId: business.id,
  });

  // Get last top-up
  const lastTopUp = account
    ? await prisma.billingTransaction.findFirst({
        where: {
          billingAccountId: account.id,
          type: "DEPOSIT_TOPUP",
          status: "SUCCEEDED",
        },
        orderBy: {
          occurredAt: "desc",
        },
      })
    : null;

  // Check if billing profile exists (for first top-up flow)
  // TODO: Replace with real BillingProfile check when backend is ready
  const hasBillingProfile = false; // Mock: always show requisites modal for now

  // Prepare data for client component
  const balanceData = {
    balance: account?.depositBalance.toNumber() || 0,
    currency: account?.currency || "BYN",
    lowBalanceThreshold: account?.lowBalanceThreshold.toNumber() || 20,
    lastTopUpDate: lastTopUp?.occurredAt || null,
    lastTopUpAmount: lastTopUp ? Math.abs(lastTopUp.amount.toNumber()) : null,
    monthlySpend: monthSpent,
    status: (
      account?.status === "SUSPENDED"
        ? "SUSPENDED"
        : (account?.depositBalance.toNumber() || 0) <= 0
          ? "ZERO_BALANCE"
          : (account?.depositBalance.toNumber() || 0) < (account?.lowBalanceThreshold.toNumber() || 20)
            ? "LOW_BALANCE"
            : "ACTIVE"
    ) as "ACTIVE" | "LOW_BALANCE" | "ZERO_BALANCE" | "SUSPENDED",
  };

  const statsData = {
    monthSpent,
    chargesCount,
    averageCharge,
    leadsCount,
    lastChargeDate: lastCharge?.occurredAt || null,
    lastChargeAmount: lastCharge ? Math.abs(lastCharge.amount.toNumber()) : null,
  };

  const transactionsData = recentTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    typeLabel: getTransactionTypeLabel(tx.type),
    status: mapTransactionStatus(tx.status),
    amount: tx.amount.toNumber(),
    description: tx.description,
    occurredAt: tx.occurredAt,
  }));

  const actionPrices = resolvedPrices
    .filter((item) => item.rule && item.rule.isActive)
    .map((item) => ({
      actionType: item.actionType,
      title: BILLING_ACTION_SHORT_TITLES[item.actionType],
      displayPrice: item.rule ? formatBillingActionPrice(item.rule) : "Бесплатно",
      isIndividual: item.source === "BUSINESS",
    }));

  return (
    <BalancePage
      balance={balanceData}
      stats={statsData}
      transactions={transactionsData}
      actionPrices={actionPrices}
      hasBillingProfile={hasBillingProfile}
    />
  );
}

// Helper functions
function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    DEPOSIT_TOPUP: "Пополнение баланса",
    MANUAL_ADJUSTMENT: "Корректировка",
    PROMOTION_CHARGE: "Продвижение",
    SUBSCRIPTION_CHARGE: "Подписка",
    SUBSCRIPTION_RENEWAL: "Продление подписки",
    LEAD_CHARGE: "Лид",
    FEATURE_CHARGE: "Функция",
    CORRECTION: "Корректировка",
    REFUND: "Возврат",
    BONUS_CREDIT: "Бонус",
  };
  return labels[type] || type;
}

function mapTransactionStatus(
  status: string
): "completed" | "pending" | "failed" | "refunded" {
  const mapping: Record<string, "completed" | "pending" | "failed" | "refunded"> = {
    SUCCEEDED: "completed",
    PENDING: "pending",
    FAILED: "failed",
    CANCELED: "failed",
  };
  return mapping[status] || "pending";
}
