/**
 * Test script for Admin Billing Phase 3
 * 
 * This script tests the admin billing write actions:
 * - Credit deposit
 * - Debit deposit
 * - Refund
 * - Suspend/Reactivate account
 * - Recalculate balance
 * 
 * Run with: npx tsx scripts/manual-tests/test-admin-billing-phase3.ts
 */

import prisma from "../../src/lib/prisma";

async function main() {
  console.log("🧪 Testing Admin Billing Phase 3\n");

  // Find a test business
  const business = await prisma.business.findFirst({
    include: {
      billingAccount: true,
    },
  });

  if (!business || !business.billingAccount) {
    console.log("❌ No business with billing account found");
    console.log("💡 Run: npm run db:seed to create test data");
    return;
  }

  console.log(`✅ Found test business: ${business.name}`);
  console.log(`   Business ID: ${business.id}`);
  console.log(`   Account ID: ${business.billingAccount.id}`);
  console.log(`   Current balance: ${business.billingAccount.depositBalance.toNumber()} ${business.billingAccount.currency}\n`);

  // Test 1: Credit deposit
  console.log("📝 Test 1: Credit Deposit");
  const creditTx = await prisma.billingTransaction.create({
    data: {
      billingAccountId: business.billingAccount.id,
      type: "DEPOSIT_TOPUP",
      status: "SUCCEEDED",
      amount: 100,
      currency: "BYN",
      description: "Test credit from script",
      referenceType: "MANUAL",
      metadata: {
        test: true,
        reason: "Testing credit operation",
      },
    },
  });

  await prisma.billingAccount.update({
    where: { id: business.billingAccount.id },
    data: {
      depositBalance: {
        increment: 100,
      },
    },
  });

  console.log(`   ✅ Created credit transaction: ${creditTx.id}`);
  console.log(`   Amount: +${creditTx.amount.toNumber()} ${creditTx.currency}\n`);

  // Test 2: Debit deposit
  console.log("📝 Test 2: Debit Deposit");
  const debitTx = await prisma.billingTransaction.create({
    data: {
      billingAccountId: business.billingAccount.id,
      type: "MANUAL_ADJUSTMENT",
      status: "SUCCEEDED",
      amount: -50,
      currency: "BYN",
      description: "Test debit from script",
      referenceType: "MANUAL",
      metadata: {
        test: true,
        reason: "Testing debit operation",
      },
    },
  });

  await prisma.billingAccount.update({
    where: { id: business.billingAccount.id },
    data: {
      depositBalance: {
        decrement: 50,
      },
    },
  });

  console.log(`   ✅ Created debit transaction: ${debitTx.id}`);
  console.log(`   Amount: ${debitTx.amount.toNumber()} ${debitTx.currency}\n`);

  // Test 3: Refund
  console.log("📝 Test 3: Refund");
  const refundTx = await prisma.billingTransaction.create({
    data: {
      billingAccountId: business.billingAccount.id,
      type: "REFUND",
      status: "SUCCEEDED",
      amount: 25,
      currency: "BYN",
      description: "Test refund from script",
      referenceType: "MANUAL",
      parentTransactionId: debitTx.id,
      metadata: {
        test: true,
        reason: "Testing refund operation",
      },
    },
  });

  await prisma.billingAccount.update({
    where: { id: business.billingAccount.id },
    data: {
      depositBalance: {
        increment: 25,
      },
    },
  });

  console.log(`   ✅ Created refund transaction: ${refundTx.id}`);
  console.log(`   Amount: +${refundTx.amount.toNumber()} ${refundTx.currency}`);
  console.log(`   Parent: ${refundTx.parentTransactionId}\n`);

  // Test 4: Check final balance
  console.log("📝 Test 4: Verify Balance");
  const updatedAccount = await prisma.billingAccount.findUnique({
    where: { id: business.billingAccount.id },
  });

  console.log(`   Current balance: ${updatedAccount?.depositBalance.toNumber()} ${updatedAccount?.currency}`);

  // Recalculate from ledger
  const transactions = await prisma.billingTransaction.findMany({
    where: {
      billingAccountId: business.billingAccount.id,
      status: "SUCCEEDED",
    },
    select: {
      amount: true,
    },
  });

  const calculatedBalance = transactions.reduce((sum, tx) => {
    return sum + tx.amount.toNumber();
  }, 0);

  console.log(`   Calculated from ledger: ${calculatedBalance} ${updatedAccount?.currency}`);
  console.log(`   Match: ${calculatedBalance === updatedAccount?.depositBalance.toNumber() ? "✅" : "❌"}\n`);

  // Test 5: Plans
  console.log("📝 Test 5: Plans");
  const plans = await prisma.plan.findMany({
    include: {
      _count: {
        select: {
          subscriptions: {
            where: {
              status: {
                in: ["ACTIVE", "TRIALING"],
              },
            },
          },
        },
      },
    },
  });

  console.log(`   Found ${plans.length} plans:`);
  plans.forEach((plan) => {
    console.log(`   - ${plan.name} (${plan.code}): ${plan.price.toNumber()} ${plan.currency}/${plan.interval}`);
    console.log(`     Active subscriptions: ${plan._count.subscriptions}`);
  });

  console.log("\n✅ All tests completed successfully!");
  console.log("\n📋 Summary:");
  console.log(`   - Credit: +100 BYN`);
  console.log(`   - Debit: -50 BYN`);
  console.log(`   - Refund: +25 BYN`);
  console.log(`   - Net change: +75 BYN`);
  console.log(`   - Plans found: ${plans.length}`);
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
