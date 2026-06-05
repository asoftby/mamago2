import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId } from "@/server/services/billing/billingAccount.service";
import prisma from "@/lib/prisma";
import { getBusinessResolvedBillingActionPrices } from "@/server/services/billing/billingActionRateResolver.service";
import {
  BILLING_ACTION_SHORT_TITLES,
  formatBillingActionPrice,
} from "@/lib/billing/actionPricing";

/**
 * GET /api/business/billing
 * Get billing account info for current business (read-only)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json(
        { error: "Business not found. Only business owners can access billing." },
        { status: 404 }
      );
    }

    // Get billing account
    const account = await getBillingAccountByBusinessId(business.id);

    if (!account) {
      return NextResponse.json(
        { error: "Billing account not found" },
        { status: 404 }
      );
    }

    const activeSubscription = account.subscriptions?.[0] || null;
    const resolvedPrices = await getBusinessResolvedBillingActionPrices({
      businessId: business.id,
    });

    const balanceAmount = account.depositBalance.toNumber();
    const balanceStatus =
      account.status === "SUSPENDED"
        ? "SUSPENDED"
        : balanceAmount <= 0
          ? "ZERO_BALANCE"
          : balanceAmount < account.lowBalanceThreshold.toNumber()
            ? "LOW_BALANCE"
            : "ACTIVE";

    const actionPrices = resolvedPrices
      .filter((item) => item.rule && item.rule.isActive)
      .map((item) => ({
        actionType: item.actionType,
        title: BILLING_ACTION_SHORT_TITLES[item.actionType],
        description: "Вы платите только за полезные действия клиентов.",
        displayPrice: item.rule ? formatBillingActionPrice(item.rule) : "Бесплатно",
        isIndividual: item.source === "BUSINESS",
        pricingType: item.rule?.pricingType ?? "FREE",
      }));

    return NextResponse.json({
      success: true,
      balance: {
        amount: balanceAmount,
        currency: account.currency,
        status: balanceStatus,
      },
      actionPrices,
      billing: {
        businessId: business.id,
        businessName: business.name,
        status: account.status,
        depositBalance: balanceAmount,
        currency: account.currency,
        lowBalanceThreshold: account.lowBalanceThreshold.toNumber(),
        creditLimit: account.creditLimit.toNumber(),
        availableBalance: balanceAmount + account.creditLimit.toNumber(),
        currentPlan: activeSubscription
          ? {
              name: activeSubscription.plan?.name || null,
              status: activeSubscription.status,
              currentPeriodEnd: activeSubscription.currentPeriodEnd,
            }
          : null,
        canTopUpOnline: false,
        topUpInstruction: "Для пополнения баланса свяжитесь с mamaGo по адресу support@mamago.by",
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error("Get business billing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
