import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getBillingAccountByBusinessId, creditBusinessDeposit } from "@/server/services/billing/billingAccount.service";
import { creditDepositSchema } from "@/lib/validation/billing";
import prisma from "@/lib/prisma";

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

    const { businessId, amount, reason, note } = validation.data;

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
      // Create billing account atomically with first credit
      const result = await prisma.$transaction(async (tx) => {
        // Create billing account
        const newAccount = await tx.billingAccount.create({
          data: {
            businessId,
            depositBalance: 0,
            currency: "BYN",
            status: "ACTIVE",
            lowBalanceThreshold: 20,
            creditLimit: 0,
          },
        });

        // Create credit transaction
        const transaction = await tx.billingTransaction.create({
          data: {
            billingAccountId: newAccount.id,
            type: "DEPOSIT_TOPUP",
            status: "SUCCEEDED",
            amount,
            currency: "BYN",
            description: `Ручное начисление депозита администратором: ${reason}`,
            referenceType: "MANUAL",
            metadata: {
              reason,
              note,
              adminId: user.id,
              adminEmail: user.email,
              timestamp: new Date().toISOString(),
              firstTopUp: true,
            },
          },
        });

        // Update balance
        const updatedAccount = await tx.billingAccount.update({
          where: { id: newAccount.id },
          data: {
            depositBalance: {
              increment: amount,
            },
          },
        });

        return { transaction, account: updatedAccount };
      });

      return NextResponse.json({
        success: true,
        accountCreated: true,
        transaction: {
          id: result.transaction.id,
          amount: result.transaction.amount.toNumber(),
          newBalance: amount,
        },
      });
    }

    // Existing account - use service
    const transaction = await creditBusinessDeposit({
      accountId: account.id,
      amount,
      description: `Ручное начисление депозита администратором: ${reason}`,
      referenceType: "MANUAL",
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
      accountCreated: false,
      transaction: {
        id: transaction.id,
        amount: transaction.amount.toNumber(),
        newBalance: account.depositBalance.toNumber() + amount,
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
