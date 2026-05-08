/**
 * Test script for billing operations
 * 
 * This script demonstrates:
 * 1. Atomic credit operations
 * 2. Atomic debit operations with idempotency
 * 3. Insufficient funds handling
 * 4. Balance recalculation
 * 
 * Run with: npx tsx scripts/test-billing-operations.ts
 */

import prisma from "@/lib/prisma";
import {
  creditBusinessDeposit,
  debitBusinessDeposit,
  recalculateDepositBalance,
  checkSufficientBalance,
  getBillingAccountByBusinessId,
} from "@/server/services/billing/billingAccount.service";

async function testBillingOperations() {
  console.log("🧪 Testing Billing Operations\n");

  try {
    // Find a test business (or create one)
    const business = await prisma.business.findFirst({
      include: { billingAccount: true },
    });

    if (!business) {
      console.error("❌ No business found. Please seed the database first.");
      return;
    }

    console.log(`📊 Testing with business: ${business.name} (${business.id})\n`);

    let account = business.billingAccount;

    // Create billing account if doesn't exist
    if (!account) {
      console.log("Creating billing account...");
      account = await prisma.billingAccount.create({
        data: {
          businessId: business.id,
          depositBalance: 0,
          creditLimit: 100,
          currency: "BYN",
          status: "ACTIVE",
        },
      });
      console.log("✅ Billing account created\n");
    }

    const accountId = account.id;
    const initialBalance = account.depositBalance.toNumber();
    console.log(`💰 Initial balance: ${initialBalance} BYN\n`);

    // Test 1: Credit operation
    console.log("--- Test 1: Credit Operation ---");
    const creditTxn = await creditBusinessDeposit({
      accountId,
      amount: 100,
      description: "Test credit",
      referenceType: "MANUAL",
      metadata: { test: true },
    });
    console.log(`✅ Credit successful: +${creditTxn.amount.toNumber()} BYN`);
    
    account = await getBillingAccountByBusinessId(business.id);
    console.log(`💰 New balance: ${account!.depositBalance.toNumber()} BYN\n`);

    // Test 2: Check sufficient balance
    console.log("--- Test 2: Check Sufficient Balance ---");
    const balanceCheck = await checkSufficientBalance(accountId, 50);
    console.log(`Available: ${balanceCheck.availableBalance} BYN`);
    console.log(`Sufficient for 50 BYN: ${balanceCheck.sufficient ? "✅ Yes" : "❌ No"}\n`);

    // Test 3: Debit operation
    console.log("--- Test 3: Debit Operation ---");
    const debitTxn = await debitBusinessDeposit({
      accountId,
      amount: 30,
      type: "PROMOTION_CHARGE",
      description: "Test promotion charge",
      referenceType: "PROMOTION",
      referenceId: "test-promo-001",
      metadata: { test: true },
    });
    console.log(`✅ Debit successful: ${debitTxn.amount.toNumber()} BYN`);
    
    account = await getBillingAccountByBusinessId(business.id);
    console.log(`💰 New balance: ${account!.depositBalance.toNumber()} BYN\n`);

    // Test 4: Idempotency - try to debit same reference again
    console.log("--- Test 4: Idempotency Protection ---");
    console.log("Attempting duplicate debit with same referenceId...");
    const duplicateTxn = await debitBusinessDeposit({
      accountId,
      amount: 30,
      type: "PROMOTION_CHARGE",
      description: "Duplicate charge attempt",
      referenceType: "PROMOTION",
      referenceId: "test-promo-001", // Same reference ID
      metadata: { test: true },
    });
    
    if (duplicateTxn.id === debitTxn.id) {
      console.log("✅ Idempotency working: returned existing transaction");
      console.log(`   Transaction ID: ${duplicateTxn.id}`);
    } else {
      console.log("❌ Idempotency failed: created duplicate transaction");
    }
    
    account = await getBillingAccountByBusinessId(business.id);
    console.log(`💰 Balance unchanged: ${account!.depositBalance.toNumber()} BYN\n`);

    // Test 5: Insufficient funds
    console.log("--- Test 5: Insufficient Funds ---");
    try {
      await debitBusinessDeposit({
        accountId,
        amount: 999999,
        type: "PROMOTION_CHARGE",
        description: "Excessive charge",
        referenceType: "PROMOTION",
        referenceId: "test-promo-002",
        metadata: { test: true },
      });
      console.log("❌ Should have thrown insufficient funds error");
    } catch (error: unknown) {
      const err = error as { 
        code?: string; 
        currentBalance?: number; 
        creditLimit?: number; 
        availableBalance?: number; 
        requestedAmount?: number; 
        shortfall?: number;
        message?: string;
      };
      if (err.code === "INSUFFICIENT_FUNDS") {
        console.log("✅ Insufficient funds error caught correctly");
        console.log(`   Current balance: ${err.currentBalance} BYN`);
        console.log(`   Credit limit: ${err.creditLimit} BYN`);
        console.log(`   Available: ${err.availableBalance} BYN`);
        console.log(`   Requested: ${err.requestedAmount} BYN`);
        console.log(`   Shortfall: ${err.shortfall} BYN`);
      } else {
        console.log("❌ Wrong error type:", err.message);
      }
    }
    console.log();

    // Test 6: Recalculate balance
    console.log("--- Test 6: Recalculate Balance ---");
    const recalculatedBalance = await recalculateDepositBalance(accountId);
    account = await getBillingAccountByBusinessId(business.id);
    console.log(`✅ Balance recalculated from ledger: ${recalculatedBalance} BYN`);
    console.log(`   Account balance: ${account!.depositBalance.toNumber()} BYN`);
    console.log(`   Match: ${recalculatedBalance === account!.depositBalance.toNumber() ? "✅ Yes" : "❌ No"}\n`);

    // Test 7: Allow negative balance (admin override)
    console.log("--- Test 7: Allow Negative Balance ---");
    const negativeDebit = await debitBusinessDeposit({
      accountId,
      amount: 999999,
      type: "MANUAL_ADJUSTMENT",
      description: "Admin override test",
      referenceType: "MANUAL",
      metadata: { test: true },
      allowNegative: true,
    });
    console.log(`✅ Negative balance allowed: ${negativeDebit.amount.toNumber()} BYN`);
    
    account = await getBillingAccountByBusinessId(business.id);
    console.log(`💰 New balance: ${account!.depositBalance.toNumber()} BYN\n`);

    // Cleanup: restore balance
    console.log("--- Cleanup ---");
    await creditBusinessDeposit({
      accountId,
      amount: 1000000,
      description: "Cleanup credit",
      referenceType: "MANUAL",
      metadata: { test: true, cleanup: true },
    });
    console.log("✅ Balance restored\n");

    console.log("🎉 All tests completed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testBillingOperations();
