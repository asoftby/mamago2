import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import {
  creditBusinessDepositWithResult,
  creditBusinessDepositInTx,
  ensureBillingAccountForBusiness,
  getBillingAccountByBusinessId,
} from "@/server/services/billing/billingAccount.service";
import { creditDepositSchema } from "@/lib/validation/billing";
import prisma from "@/lib/prisma";
import { BillingReferenceType } from "@prisma/client";
import { logAdminAudit } from "@/server/services/adminAuditLog.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Validate with Zod
    const validation = creditDepositSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { businessId, amount, currency, idempotencyKey, reason, note } = validation.data;

    // Verify business exists
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Get or create billing account
    const account = await getBillingAccountByBusinessId(businessId);

    if (!account) {
      const result = await prisma.$transaction(async (tx) => {
        const newAccount = await ensureBillingAccountForBusiness(businessId, tx);
        await tx.$queryRaw`SELECT id FROM "BillingAccount" WHERE id = ${newAccount.id} FOR UPDATE`;
        const preExisting = await tx.billingTransaction.findFirst({
          where: { billingAccountId: newAccount.id, idempotencyKey },
        });
        const transaction = await creditBusinessDepositInTx(tx, {
          accountId: newAccount.id,
          amount,
          idempotencyKey,
          description: `Ручное начисление депозита администратором: ${reason}`,
          referenceType: BillingReferenceType.MANUAL,
          metadata: {
            reason,
            note,
            adminId: user.id,
            adminEmail: user.email,
            timestamp: new Date().toISOString(),
            currency,
            idempotencyKey,
            firstTopUp: true,
          },
        });

        const updatedAccount = await tx.billingAccount.findUniqueOrThrow({ where: { id: newAccount.id } });
        return {
          transaction,
          idempotentReplay: Boolean(preExisting),
          balance: updatedAccount.depositBalance.toNumber(),
        };
      });

      if (!result.idempotentReplay) await logAdminAudit({
        actorId: user.id,
        actorRole: user.role,
        action: "BILLING_MANUAL_CREDIT",
        entityType: "BILLING_TRANSACTION",
        entityId: result.transaction.id,
        before: {
          balance: 0,
        },
        after: {
          balance: amount,
          transactionAmount: result.transaction.amount.toNumber(),
        },
        reason,
        metadata: {
          note: note || null,
          businessId: business.id,
          businessName: business.name,
          billingAccountCreated: true,
        },
      });

      return NextResponse.json({
        success: true,
        accountCreated: true,
        transaction: {
          id: result.transaction.id,
          amount: result.transaction.amount.toNumber(),
          newBalance: result.balance,
          idempotentReplay: result.idempotentReplay,
        },
      });
    }

    // Existing account - use service
    const result = await creditBusinessDepositWithResult({
      accountId: account.id,
      amount,
      idempotencyKey,
      description: `Ручное начисление депозита администратором: ${reason}`,
      referenceType: BillingReferenceType.MANUAL,
      metadata: {
        reason,
        note,
        adminId: user.id,
        adminEmail: user.email,
        timestamp: new Date().toISOString(),
        currency,
        idempotencyKey,
      },
    });

    if (!result.idempotentReplay) await logAdminAudit({
      actorId: user.id,
      actorRole: user.role,
      action: "BILLING_MANUAL_CREDIT",
      entityType: "BILLING_TRANSACTION",
      entityId: result.transaction.id,
      before: {
        balance: account.depositBalance.toNumber(),
      },
      after: {
        balance: account.depositBalance.toNumber() + amount,
        transactionAmount: result.transaction.amount.toNumber(),
      },
      reason,
      metadata: {
        note: note || null,
        businessId: business.id,
        businessName: business.name,
        billingAccountId: account.id,
      },
    });

    return NextResponse.json({
      success: true,
      accountCreated: false,
      transaction: {
        id: result.transaction.id,
        amount: result.transaction.amount.toNumber(),
        newBalance: result.balance,
        idempotentReplay: result.idempotentReplay,
      },
    });
  } catch (error: unknown) {
    console.error("Credit deposit error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
