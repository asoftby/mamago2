import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, suspendBillingAccount } from "@/server/services/billing/billingAccount.service";
import { suspendAccountSchema } from "@/lib/validation/billing";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with Zod
    const validation = suspendAccountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { businessId, reason } = validation.data;

    // Get billing account
    const account = await getBillingAccountByBusinessId(businessId);

    if (!account) {
      return NextResponse.json(
        { error: "Billing account not found" },
        { status: 404 }
      );
    }

    if (account.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Account is already suspended" },
        { status: 400 }
      );
    }

    // Suspend account
    const updatedAccount = await suspendBillingAccount(account.id, reason);

    await logAdminAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "BILLING_ACCOUNT_SUSPENDED",
      entityType: "BILLING_ACCOUNT",
      entityId: account.id,
      before: {
        status: account.status,
        suspendedAt: account.suspendedAt?.toISOString() ?? null,
        suspendedReason: account.suspendedReason ?? null,
      },
      after: {
        status: updatedAccount.status,
        suspendedAt: updatedAccount.suspendedAt?.toISOString() ?? null,
        suspendedReason: updatedAccount.suspendedReason ?? null,
      },
      reason,
      metadata: {
        businessId,
        businessName: account.business.name,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        id: updatedAccount.id,
        status: updatedAccount.status,
        suspendedAt: updatedAccount.suspendedAt,
        suspendedReason: updatedAccount.suspendedReason,
      },
    });
  } catch (error: unknown) {
    console.error("Suspend account error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
