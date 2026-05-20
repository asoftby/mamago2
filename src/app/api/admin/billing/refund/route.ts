import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  createRefund,
  RefundAmountExceedsAvailableError,
  RefundNotAllowedError,
} from "@/server/services/billing/billingTransaction.service";
import { refundTransactionSchema } from "@/lib/validation/billing";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";

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
    const result = await createRefund({
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

    await logAdminAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "BILLING_REFUND_CREATED",
      entityType: "BILLING_TRANSACTION",
      entityId: transactionId,
      before: {
        refundedAmount: result.refundSummaryBefore.refundedAmount,
        availableAmount: result.refundSummaryBefore.availableAmount,
      },
      after: {
        refundedAmount: result.refundSummaryAfter.refundedAmount,
        availableAmount: result.refundSummaryAfter.availableAmount,
        refundId: result.refund.id,
      },
      reason,
      metadata: {
        businessId: result.business.id,
        businessName: result.business.name,
        refundId: result.refund.id,
        parentTransactionId: transactionId,
        amount,
        reason,
        note: note || null,
        originalAmount: result.refundSummaryBefore.originalAmount,
        refundTransactionId: result.refund.id,
      },
    });

    return NextResponse.json({
      success: true,
      refund: {
        id: result.refund.id,
        amount: result.refund.amount.toNumber(),
        parentTransactionId: transactionId,
      },
      summary: result.refundSummaryAfter,
    });
  } catch (error: unknown) {
    console.error("Refund error:", error);
    
    if (error instanceof RefundAmountExceedsAvailableError) {
      return NextResponse.json(
        {
          error: "Refund amount exceeds available refundable amount",
          originalAmount: error.originalAmount,
          refundedAmount: error.refundedAmount,
          availableAmount: error.availableAmount,
          requestedAmount: error.requestedAmount,
        },
        { status: 400 }
      );
    }

    if (error instanceof RefundNotAllowedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: "Failed to create refund" }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create refund" },
      { status: 500 }
    );
  }
}
