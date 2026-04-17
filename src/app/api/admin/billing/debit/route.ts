import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, debitBusinessDeposit } from "@/server/services/billing/billingAccount.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, amount, reason, note, allowNegative } = body;

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

    // Check balance if negative not allowed
    const currentBalance = account.depositBalance.toNumber();
    const newBalance = currentBalance - amount;

    if (!allowNegative && newBalance < 0) {
      return NextResponse.json(
        { 
          error: "Insufficient balance",
          currentBalance,
          requestedAmount: amount,
          shortfall: Math.abs(newBalance),
        },
        { status: 400 }
      );
    }

    // Create debit transaction
    const transaction = await debitBusinessDeposit({
      accountId: account.id,
      amount,
      type: "MANUAL_ADJUSTMENT",
      description: `Ручное списание депозита администратором: ${reason}`,
      referenceType: "MANUAL",
      metadata: {
        reason,
        note,
        adminId: user.id,
        adminEmail: user.email,
        allowNegative,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        amount: transaction.amount.toNumber(),
        newBalance: currentBalance - amount,
      },
    });
  } catch (error: unknown) {
    console.error("Debit deposit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to debit deposit" },
      { status: 500 }
    );
  }
}
