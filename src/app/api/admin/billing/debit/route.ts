import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, debitBusinessDeposit } from "@/server/services/billing/billingAccount.service";
import { debitDepositSchema } from "@/lib/validation/billing";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with Zod
    const validation = debitDepositSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { businessId, amount, reason, note, allowNegative } = validation.data;

    // Get billing account
    const account = await getBillingAccountByBusinessId(businessId);

    if (!account) {
      return NextResponse.json(
        { error: "Billing account not found" },
        { status: 404 }
      );
    }

    const currentBalance = account.depositBalance.toNumber();

    // Create debit transaction (service handles balance check and atomicity)
    try {
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
        allowNegative,
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
      // Handle insufficient funds error from service
      const err = error as { code?: string; currentBalance?: number; creditLimit?: number; availableBalance?: number; requestedAmount?: number; shortfall?: number };
      if (err.code === "INSUFFICIENT_FUNDS") {
        return NextResponse.json(
          { 
            error: "Insufficient balance",
            currentBalance: err.currentBalance,
            creditLimit: err.creditLimit,
            availableBalance: err.availableBalance,
            requestedAmount: err.requestedAmount,
            shortfall: err.shortfall,
          },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error("Debit deposit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
