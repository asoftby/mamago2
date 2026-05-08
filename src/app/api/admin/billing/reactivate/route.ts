import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, reactivateBillingAccount } from "@/server/services/billing/billingAccount.service";
import { reactivateAccountSchema } from "@/lib/validation/billing";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with Zod
    const validation = reactivateAccountSchema.safeParse(body);
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
  } catch (error: unknown) {
    console.error("Reactivate account error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reactivate account" },
      { status: 500 }
    );
  }
}
