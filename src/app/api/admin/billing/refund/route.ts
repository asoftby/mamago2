import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { createRefund } from "@/server/services/billing/billingTransaction.service";
import { getBillingTransactionById } from "@/server/services/billing/billingTransaction.service";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { transactionId, amount, reason, note } = body;

    // Validation
    if (!transactionId || !amount || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: transactionId, amount, reason" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Get parent transaction
    const parentTx = await getBillingTransactionById(transactionId);

    if (!parentTx) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Validation rules
    if (parentTx.status !== "SUCCEEDED") {
      return NextResponse.json(
        { error: "Can only refund succeeded transactions" },
        { status: 400 }
      );
    }

    if (parentTx.type === "REFUND") {
      return NextResponse.json(
        { error: "Cannot refund a refund transaction" },
        { status: 400 }
      );
    }

    // Check if already refunded
    const existingRefund = parentTx.childTransactions?.find(
      (tx) => tx.type === "REFUND"
    );

    if (existingRefund) {
      return NextResponse.json(
        { error: "Transaction already has a refund" },
        { status: 400 }
      );
    }

    const parentAmount = Math.abs(parentTx.amount.toNumber());

    if (amount > parentAmount) {
      return NextResponse.json(
        { 
          error: "Refund amount cannot exceed original transaction amount",
          originalAmount: parentAmount,
          requestedAmount: amount,
        },
        { status: 400 }
      );
    }

    // Create refund with admin metadata
    const refundReason = note ? `${reason} (${note})` : reason;
    let refund = await createRefund({
      parentTransactionId: transactionId,
      amount,
      reason: refundReason,
    });

    // Update metadata with admin info
    refund = await prisma.billingTransaction.update({
      where: { id: refund.id },
      data: {
        metadata: {
          ...(refund.metadata as Record<string, unknown>),
          adminId: user.id,
          adminEmail: user.email,
          timestamp: new Date().toISOString(),
        },
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create refund" },
      { status: 500 }
    );
  }
}
