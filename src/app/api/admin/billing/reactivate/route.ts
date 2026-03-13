import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, reactivateBillingAccount } from "@/server/services/billing/billingAccount.service";

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

    if (account.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Account is already active" },
        { status: 400 }
      );
    }

    // Reactivate account
    const updatedAccount = await reactivateBillingAccount(account.id);

    return NextResponse.json({
      success: true,
      account: {
        id: updatedAccount.id,
        status: updatedAccount.status,
      },
    });
  } catch (error: any) {
    console.error("Reactivate account error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reactivate account" },
      { status: 500 }
    );
  }
}
