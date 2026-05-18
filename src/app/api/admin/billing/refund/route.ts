import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { createRefund } from "@/server/services/billing/billingTransaction.service";
import { refundTransactionSchema } from "@/lib/validation/billing";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with Zod
    const validation = refundTransactionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { transactionId, amount, reason, note } = validation.data;

    // Create refund with admin metadata (service handles all validation and atomicity)
    const refundReason = note ? `${reason} (${note})` : reason;
    const refund = await createRefund({
      parentTransactionId: transactionId,
      amount,
      reason: refundReason,
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
      refund: {
        id: refund.id,
        amount: refund.amount.toNumber(),
        parentTransactionId: transactionId,
      },
    });
  } catch (error: unknown) {
    console.error("Refund error:", error);
    
    // Handle specific error codes
    if (error instanceof Error) {
      const err = error as { code?: string; originalAmount?: number; requestedAmount?: number };
      if (err.code === "REFUND_AMOUNT_EXCEEDS_ORIGINAL") {
        return NextResponse.json(
          {
            error: "Refund amount cannot exceed original transaction amount",
            originalAmount: err.originalAmount,
            requestedAmount: err.requestedAmount,
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to create refund" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create refund" },
      { status: 500 }
    );
  }
}
