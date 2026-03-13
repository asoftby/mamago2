import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, recalculateDepositBalance } from "@/server/services/billing/billingAccount.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId } = body;

    // Validation
    if (!businessId) {
      return NextResponse.json(
        { error: "Missing required field: businessId" },
        { status: 400 }
      );
    }

    // Get billing account
    const account = await getBillingAccountByBusinessId(businessId);

    if (!account) {
      return NextResponse.json(
        { error: "Billing account not found" },
        { status: 404 }
      );
    }

    const oldBalance = account.depositBalance.toNumber();

    // Recalculate balance from ledger
    const newBalance = await recalculateDepositBalance(account.id);

    return NextResponse.json({
      success: true,
      oldBalance,
      newBalance,
      difference: newBalance - oldBalance,
    });
  } catch (error: any) {
    console.error("Recalculate balance error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to recalculate balance" },
      { status: 500 }
    );
  }
}
