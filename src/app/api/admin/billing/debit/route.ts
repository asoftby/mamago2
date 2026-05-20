import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  BillingInsufficientFundsError,
  debitBusinessDeposit,
  getBillingAccountByBusinessId,
} from "@/server/services/billing/billingAccount.service";
import { BillingReferenceType, BillingTransactionType } from "@prisma/client";
import { debitDepositSchema } from "@/lib/validation/billing";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";

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
        type: BillingTransactionType.MANUAL_ADJUSTMENT,
        description: `Ручное списание депозита администратором: ${reason}`,
        referenceType: BillingReferenceType.MANUAL,
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

      await logAdminAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "BILLING_MANUAL_DEBIT",
        entityType: "BILLING_TRANSACTION",
        entityId: transaction.id,
        before: {
          balance: currentBalance,
        },
        after: {
          balance: currentBalance - amount,
          transactionAmount: transaction.amount.toNumber(),
          allowNegative,
        },
        reason,
        metadata: {
          note: note || null,
          businessId,
          billingAccountId: account.id,
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
      if (error instanceof BillingInsufficientFundsError) {
        return NextResponse.json(
          { 
            error: "Insufficient balance",
            currentBalance: error.currentBalance,
            creditLimit: error.creditLimit,
            availableBalance: error.availableBalance,
            requestedAmount: error.requestedAmount,
            shortfall: error.shortfall,
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
