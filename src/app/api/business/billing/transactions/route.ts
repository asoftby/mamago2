import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingTransactions } from "@/server/services/billing/billingTransaction.service";
import prisma from "@/lib/prisma";

/**
 * GET /api/business/billing/transactions
 * Get transaction history for current business (read-only, public fields only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await prisma.business.findUnique({
      where: { ownerUserId: user.id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found. Only business owners can access billing." },
        { status: 404 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const dateFrom = searchParams.get("dateFrom")
      ? new Date(searchParams.get("dateFrom")!)
      : undefined;
    const dateTo = searchParams.get("dateTo")
      ? new Date(searchParams.get("dateTo")!)
      : undefined;

    // Get transactions for this business only
    const { transactions, total } = await getBillingTransactions({
      businessId: business.id,
      dateFrom,
      dateTo,
      limit,
      offset,
    });

    // Format transactions (public fields only, no admin metadata)
    const formattedTransactions = transactions.map((tx) => {
      // Create public description (hide admin internal notes)
      let publicDescription = tx.description;
      
      // Remove admin-specific prefixes for cleaner display
      publicDescription = publicDescription
        .replace(/^Ручное начисление депозита администратором:\s*/i, "Пополнение баланса: ")
        .replace(/^Ручное списание депозита администратором:\s*/i, "Списание: ")
        .replace(/^Возврат:\s*/i, "Возврат средств: ");

      return {
        id: tx.id,
        createdAt: tx.createdAt,
        occurredAt: tx.occurredAt,
        type: tx.type,
        status: tx.status,
        amount: tx.amount.toNumber(),
        currency: tx.currency,
        publicDescription,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        // Include subscription info if relevant
        subscription: tx.subscription
          ? {
              planName: tx.subscription.plan?.name || "Unknown Plan",
            }
          : null,
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
    console.error("Get business transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
