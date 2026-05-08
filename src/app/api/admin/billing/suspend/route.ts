import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, suspendBillingAccount } from "@/server/services/billing/billingAccount.service";
import { suspendAccountSchema } from "@/lib/validation/billing";

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
      { error: error instanceof Error ? error.message : "Failed to suspend account" },
      { status: 500 }
    );
  }
}
