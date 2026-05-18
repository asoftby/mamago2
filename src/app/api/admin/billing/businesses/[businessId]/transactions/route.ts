import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingTransactions } from "@/server/services/billing/billingTransaction.service";
import { getBillingAccountByBusinessId } from "@/server/services/billing/billingAccount.service";
import { parsePaginationParams } from "@/lib/api/pagination";
import { BillingTransactionType, BillingTransactionStatus } from "@prisma/client";

/**
 * GET /api/admin/billing/businesses/[businessId]/transactions
 * Get transaction history for a business
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { businessId } = await context.params;
    console.log("[Admin Transactions API] businessId:", businessId);

    // Verify business has billing account
    const account = await getBillingAccountByBusinessId(businessId);
    console.log("[Admin Transactions API] account found:", !!account, account?.id);
    
    if (!account) {
      return NextResponse.json(
        { error: "Billing account not found" },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;
    const { limit, skip: offset } = parsePaginationParams(searchParams, { defaultLimit: 50 });
    const dateFrom = searchParams.get("dateFrom")
      ? new Date(searchParams.get("dateFrom")!)
      : undefined;
    const dateTo = searchParams.get("dateTo")
      ? new Date(searchParams.get("dateTo")!)
      : undefined;

    // Get transactions
    const { transactions, total } = await getBillingTransactions({
      businessId,
      type: type as BillingTransactionType | undefined,
      status: status as BillingTransactionStatus | undefined,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    console.log("[Admin Transactions API] Found transactions:", transactions.length, "total:", total);

    // Format transactions for response
    const formattedTransactions = transactions.map((tx) => {
      const metadata = tx.metadata as Record<string, unknown> | null;

      return {
        id: tx.id,
        type: tx.type,
        status: tx.status,
        amount: tx.amount.toNumber(),
        currency: tx.currency,
        description: tx.description,
        occurredAt: tx.occurredAt,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        parentTransactionId: tx.parentTransactionId,
        // Admin metadata
        adminId: metadata?.adminId || null,
        adminEmail: metadata?.adminEmail || null,
        reason: metadata?.reason || null,
        note: metadata?.note || null,
        // Related entities
        subscription: tx.subscription
          ? {
              id: tx.subscription.id,
              planName: tx.subscription.plan?.name,
            }
          : null,
        paymentMethod: tx.paymentMethod
          ? {
              id: tx.paymentMethod.id,
              type: tx.paymentMethod.type,
            }
          : null,
        // Failure info
        failureReason: tx.failureReason,
        failureCode: tx.failureCode,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: unknown) {
    console.error("Get transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
