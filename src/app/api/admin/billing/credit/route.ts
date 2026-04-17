import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, creditBusinessDeposit } from "@/server/services/billing/billingAccount.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, amount, reason, note } = body;

    // Validation
    if (!businessId || !amount || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: businessId, amount, reason" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
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

    // Create credit transaction
    const transaction = await creditBusinessDeposit({
      accountId: account.id,
      amount,
      description: `Ручное начисление депозита администратором: ${reason}`,
      referenceType: "MANUAL",
      metadata: {
        reason,
        note,
        adminId: user.id,
        adminEmail: user.email,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        amount: transaction.amount.toNumber(),
        newBalance: account.depositBalance.toNumber() + amount,
      },
    });
  } catch (error: unknown) {
    console.error("Credit deposit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to credit deposit" },
      { status: 500 }
    );
  }
}
