import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingTransactionById } from "@/server/services/billing/billingTransaction.service";
import { getAdminAuditLogsForEntity } from "@/server/services/adminAuditLog.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const transaction = await getBillingTransactionById(id);

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const auditEntityId = transaction.parentTransactionId ?? transaction.id;
    const auditLogs = await getAdminAuditLogsForEntity("BILLING_TRANSACTION", auditEntityId);

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        status: transaction.status,
        amount: transaction.amount.toNumber(),
        currency: transaction.currency,
        description: transaction.description,
        occurredAt: transaction.occurredAt.toISOString(),
        referenceType: transaction.referenceType,
        referenceId: transaction.referenceId,
        parentTransactionId: transaction.parentTransactionId,
        failureReason: transaction.failureReason,
        failureCode: transaction.failureCode,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
        billingAccount: {
          id: transaction.billingAccount.id,
          business: {
            id: transaction.billingAccount.business.id,
            name: transaction.billingAccount.business.name,
          },
        },
        paymentMethod: transaction.paymentMethod,
        subscription: transaction.subscription
          ? {
              id: transaction.subscription.id,
              plan: transaction.subscription.plan
                ? {
                    id: transaction.subscription.plan.id,
                    name: transaction.subscription.plan.name,
                  }
                : null,
            }
          : null,
        parentTransaction: transaction.parentTransaction
          ? {
              id: transaction.parentTransaction.id,
              type: transaction.parentTransaction.type,
              amount: transaction.parentTransaction.amount.toNumber(),
              occurredAt: transaction.parentTransaction.occurredAt.toISOString(),
            }
          : null,
        refundSummary: transaction.refundSummary,
        refundTransactions: transaction.refundTransactions.map((refund) => ({
          id: refund.id,
          amount: refund.amount.toNumber(),
          status: refund.status,
          occurredAt: refund.occurredAt.toISOString(),
          description: refund.description,
          metadata: refund.metadata,
        })),
        auditLogs: auditLogs.map((log) => ({
          id: log.id,
          actorId: log.actorId,
          actorRole: log.actorRole,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          before: log.before,
          after: log.after,
          reason: log.reason,
          metadata: log.metadata,
          createdAt: log.createdAt.toISOString(),
          actor: log.actor
            ? {
                id: log.actor.id,
                email: log.actor.email,
                role: log.actor.role,
              }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("Get admin billing transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
