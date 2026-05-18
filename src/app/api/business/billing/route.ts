import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId } from "@/server/services/billing/billingAccount.service";
import prisma from "@/lib/prisma";

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

    // Get active subscription if exists
    const activeSubscription = account.subscriptions?.[0] || null;

    // Format response (public fields only, no admin metadata)
    return NextResponse.json({
      success: true,
      billing: {
        businessId: business.id,
        businessName: business.name,
        status: account.status,
        depositBalance: account.depositBalance.toNumber(),
        currency: account.currency,
        lowBalanceThreshold: account.lowBalanceThreshold.toNumber(),
        creditLimit: account.creditLimit.toNumber(),
        availableBalance: account.depositBalance.toNumber() + account.creditLimit.toNumber(),
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
