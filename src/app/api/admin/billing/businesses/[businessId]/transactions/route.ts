import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  getBillingTransactions,
  getBillingTransactionsSummary,
} from "@/server/services/billing/billingTransaction.service";
import { getBillingAccountByBusinessId } from "@/server/services/billing/billingAccount.service";
import { parsePaginationParams } from "@/lib/api/pagination";
import { BillingTransactionType, BillingTransactionStatus } from "@prisma/client";
import {
  getBusinessResolvedBillingActionPrices,
  listBillingActionRates,
} from "@/server/services/billing/billingActionRateResolver.service";

function parseDateStart(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateEnd(value: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(23, 59, 59, 999);
  return date;
}

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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { businessId } = await context.params;

    const account = await getBillingAccountByBusinessId(businessId);

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
    const { page, limit, skip: offset } = parsePaginationParams(searchParams, { defaultLimit: 20 });
    const dateFrom = parseDateStart(searchParams.get("dateFrom"));
    const dateTo = parseDateEnd(searchParams.get("dateTo"));

    const filters = {
      businessId,
      type: type as BillingTransactionType | undefined,
      status: status as BillingTransactionStatus | undefined,
      dateFrom,
      dateTo,
    };

    const [{ transactions, total }, summary, businessRates, resolvedPrices] = await Promise.all([
      getBillingTransactions({
        ...filters,
        limit,
        offset,
      }),
      getBillingTransactionsSummary(filters),
      listBillingActionRates({
        scopeType: "BUSINESS",
        scopeId: businessId,
        includeInactive: true,
      }),
      getBusinessResolvedBillingActionPrices({ businessId }),
    ]);

    type TransactionRow = (typeof transactions)[number];
    type BusinessRateRow = (typeof businessRates)[number];
    type ResolvedPriceRow = (typeof resolvedPrices)[number];

    const formattedTransactions = transactions.map((tx: TransactionRow) => {
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
        hasRefund: tx.childTransactions.length > 0,
        refunds: tx.childTransactions.map((refund: TransactionRow["childTransactions"][number]) => ({
          id: refund.id,
          amount: refund.amount.toNumber(),
          occurredAt: refund.occurredAt,
          parentTransactionId: refund.parentTransactionId,
        })),
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
      account: {
        id: account.id,
        businessId: account.businessId,
        status: account.status,
        depositBalance: account.depositBalance.toNumber(),
        currency: account.currency,
        lowBalanceThreshold: account.lowBalanceThreshold.toNumber(),
        creditLimit: account.creditLimit.toNumber(),
      },
      summary,
      pricing: {
        businessRates: businessRates.map((rate: BusinessRateRow) => ({
          id: rate.id,
          actionType: rate.actionType,
          scopeType: rate.scopeType,
          pricingType: rate.pricingType,
          fixedAmount: rate.fixedAmount?.toNumber() ?? null,
          percentRate: rate.percentRate?.toNumber() ?? null,
          minimumAmount: rate.minimumAmount?.toNumber() ?? null,
          maximumAmount: rate.maximumAmount?.toNumber() ?? null,
          currency: rate.currency,
          isActive: rate.isActive,
          startsAt: rate.startsAt?.toISOString() ?? null,
          endsAt: rate.endsAt?.toISOString() ?? null,
          reason: rate.reason ?? null,
        })),
        resolvedPrices: resolvedPrices.map((item: ResolvedPriceRow) => ({
          actionType: item.actionType,
          source: item.source,
          rule: item.rule
            ? {
                id: item.rule.id,
                pricingType: item.rule.pricingType,
                fixedAmount: item.rule.fixedAmount?.toNumber() ?? null,
                percentRate: item.rule.percentRate?.toNumber() ?? null,
                minimumAmount: item.rule.minimumAmount?.toNumber() ?? null,
                maximumAmount: item.rule.maximumAmount?.toNumber() ?? null,
                currency: item.rule.currency,
                startsAt: item.rule.startsAt?.toISOString() ?? null,
                endsAt: item.rule.endsAt?.toISOString() ?? null,
                reason: item.rule.reason ?? null,
              }
            : null,
        })),
      },
      transactions: formattedTransactions,
      pagination: {
        page,
        total,
        limit,
        offset,
        totalPages: Math.max(1, Math.ceil(total / limit)),
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
