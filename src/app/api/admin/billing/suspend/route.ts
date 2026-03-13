import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, suspendBillingAccount } from "@/server/services/billing/billingAccount.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, reason } = body;

    // Validation
    if (!businessId || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: businessId, reason" },
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
  } catch (error: any) {
    console.error("Suspend account error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to suspend account" },
      { status: 500 }
    );
  }
}
