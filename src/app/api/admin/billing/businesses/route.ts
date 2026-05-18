import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccounts } from "@/server/services/billing/billingAccount.service";
import { BillingAccountStatus } from "@prisma/client";

/**
 * GET /api/admin/billing/businesses
 * List all billing accounts with summary
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const lowBalance = searchParams.get("lowBalance") === "true";
    const search = searchParams.get("search") || undefined;

    // Get all billing accounts
    const accounts = await getBillingAccounts({
      status: status as BillingAccountStatus | undefined,
      lowBalance,
      search,
    });

    // Calculate summary statistics
    const summary = {
      totalAccounts: accounts.length,
      activeCount: accounts.filter((a) => a.status === "ACTIVE").length,
      suspendedCount: accounts.filter((a) => a.status === "SUSPENDED").length,
      lowBalanceCount: accounts.filter(
        (a) => a.depositBalance.toNumber() < a.lowBalanceThreshold.toNumber()
      ).length,
      negativeBalanceCount: accounts.filter(
        (a) => a.depositBalance.toNumber() < 0
      ).length,
      totalBalance: accounts.reduce(
        (sum, a) => sum + a.depositBalance.toNumber(),
        0
      ),
    };

    // Format accounts for response
    const formattedAccounts = accounts.map((account) => {
      const balance = account.depositBalance.toNumber();
      const threshold = account.lowBalanceThreshold.toNumber();
      const creditLimit = account.creditLimit.toNumber();

      // Determine warning level
      let warning: "none" | "low" | "negative" | "critical" = "none";
      if (balance < 0) {
        warning = balance < -creditLimit ? "critical" : "negative";
      } else if (balance < threshold) {
        warning = "low";
      }

      return {
        billingAccountId: account.id,
        businessId: account.businessId,
        businessName: account.business.name,
        ownerEmail: account.business.owner?.email || null,
        status: account.status,
        depositBalance: balance,
        creditLimit: creditLimit,
        availableBalance: balance + creditLimit,
        currency: account.currency,
        lowBalanceThreshold: threshold,
        transactionCount: account._count?.transactions || 0,
        warning,
        suspendedAt: account.suspendedAt,
        suspendedReason: account.suspendedReason,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      summary,
      accounts: formattedAccounts,
    });
  } catch (error: unknown) {
    console.error("Get billing accounts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
