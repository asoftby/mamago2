import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, recalculateDepositBalance } from "@/server/services/billing/billingAccount.service";
import { recalculateBalanceSchema } from "@/lib/validation/billing";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with Zod
    const validation = recalculateBalanceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { businessId } = validation.data;

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

    await logAdminAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "BILLING_BALANCE_RECALCULATED",
      entityType: "BILLING_ACCOUNT",
      entityId: account.id,
      before: {
        balance: oldBalance,
      },
      after: {
        balance: newBalance,
        difference: newBalance - oldBalance,
      },
      metadata: {
        businessId,
        businessName: account.business.name,
      },
    });

    return NextResponse.json({
      success: true,
      oldBalance,
      newBalance,
      difference: newBalance - oldBalance,
    });
  } catch (error: unknown) {
    console.error("Recalculate balance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
