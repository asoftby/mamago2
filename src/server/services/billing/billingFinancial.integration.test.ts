import assert from "node:assert/strict";
import test from "node:test";
import {
  BillingReferenceType,
  Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  BillingIdempotencyConflictError,
  BillingInsufficientFundsError,
  creditBusinessDeposit,
  debitBusinessDeposit,
  recalculateDepositBalance,
  suspendBillingAccount,
  reactivateBillingAccount,
} from "./billingAccount.service";
import { createRefund, getRefundPreview, getBillingTransactionsSummary, RefundNotAllowedError } from "./billingTransaction.service";
import {
  BoostAlreadyActiveError,
  BoostPurchaseNotAllowedError,
  BoostPricingUnavailableError,
  getConfiguredBoostOptions,
  purchaseOfferBoost,
} from "./boostPurchase.service";
import { reconcileBillingAccounts } from "./billingReconciliation.service";
import { purchaseEventBoost } from "./eventBoostPurchase.service";
import { PaidBoostOwnerRequiredError } from "./paidBoostAuthorization";
import { registerPromotionActionFromUserEvent } from "../promotion/promotion.service";

const prefix = `task13-${Date.now()}`;
let userId = "";
let businessId = "";
let accountId = "";
let offerId = "";
let managerId = "";
let foreignOwnerId = "";
let foreignBusinessId = "";

async function resetFinancialState(balance: string) {
  await prisma.boost.deleteMany({ where: { offerId } });
  await prisma.billingTransaction.deleteMany({ where: { billingAccountId: accountId } });
  await prisma.billingAccount.update({
    where: { id: accountId },
    data: { depositBalance: new Prisma.Decimal(balance), creditLimit: 0 },
  });
  if (balance !== "0.00") {
    await prisma.billingTransaction.create({
      data: {
        billingAccountId: accountId,
        type: "DEPOSIT_TOPUP",
        status: "SUCCEEDED",
        amount: new Prisma.Decimal(balance),
        currency: "BYN",
        description: "Disposable opening balance",
        idempotencyKey: `${prefix}:opening:${balance}:${crypto.randomUUID()}`,
      },
    });
  }
}

test.before(async () => {
  process.env.BOOST_PRICE_1D_BYN = "5";
  process.env.BOOST_PRICE_3D_BYN = "12";
  process.env.BOOST_PRICE_7D_BYN = "25";

  const user = await prisma.user.create({ data: { email: `${prefix}@example.invalid`, role: "BUSINESS_OWNER" } });
  userId = user.id;
  const business = await prisma.business.create({
    data: { name: `${prefix} business`, ownerUserId: user.id, status: "APPROVED" },
  });
  businessId = business.id;
  await prisma.businessMember.create({ data: { businessId, userId, role: "OWNER", isActive: true } });
  const manager = await prisma.user.create({ data: { email: `${prefix}-manager@example.invalid` } });
  managerId = manager.id;
  await prisma.businessMember.create({ data: { businessId, userId: managerId, role: "MANAGER", isActive: true } });
  const foreignOwner = await prisma.user.create({ data: { email: `${prefix}-foreign@example.invalid`, role: "BUSINESS_OWNER" } });
  foreignOwnerId = foreignOwner.id;
  const foreignBusiness = await prisma.business.create({
    data: { name: `${prefix} foreign business`, ownerUserId: foreignOwnerId, status: "APPROVED" },
  });
  foreignBusinessId = foreignBusiness.id;
  await prisma.businessMember.create({ data: { businessId: foreignBusinessId, userId: foreignOwnerId, role: "OWNER", isActive: true } });
  const account = await prisma.billingAccount.create({
    data: { businessId, depositBalance: 0, currency: "BYN" },
  });
  accountId = account.id;
  const place = await prisma.place.create({
    data: {
      title: `${prefix} place`,
      shortDesc: "Disposable financial test place",
      activityTypes: [],
      ageTags: [],
      visitFormats: [],
      createdByUserId: user.id,
      ownerBusinessId: businessId,
      status: "PUBLISHED",
    },
  });
  const offer = await prisma.offer.create({
    data: { placeId: place.id, kind: "SERVICE", title: `${prefix} offer`, status: "PUBLISHED" },
  });
  offerId = offer.id;
});

test.after(async () => {
  await prisma.boost.deleteMany({ where: { offerId } });
  await prisma.billingTransaction.deleteMany({ where: { billingAccountId: accountId } });
  await prisma.billingAccount.deleteMany({ where: { id: accountId } });
  await prisma.businessMember.deleteMany({ where: { businessId: { in: [businessId, foreignBusinessId] } } });
  await prisma.business.deleteMany({ where: { id: { in: [businessId, foreignBusinessId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, managerId, foreignOwnerId] } } });
  await prisma.$disconnect();
});

test("concurrent 80 + 80 debit from 100 allows exactly one movement", async () => {
  await resetFinancialState("100.00");
  const results = await Promise.allSettled([
    debitBusinessDeposit({
      accountId, amount: 80, type: "MANUAL_ADJUSTMENT", description: "first",
      idempotencyKey: `${prefix}:debit-a`,
    }),
    debitBusinessDeposit({
      accountId, amount: 80, type: "MANUAL_ADJUSTMENT", description: "second",
      idempotencyKey: `${prefix}:debit-b`,
    }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.reason instanceof BillingInsufficientFundsError);
  const account = await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } });
  assert.equal(account.depositBalance.toFixed(2), "20.00");
  assert.equal(await prisma.billingTransaction.count({
    where: { billingAccountId: accountId, amount: new Prisma.Decimal(-80), status: "SUCCEEDED" },
  }), 1);
});

test("credit and debit request keys are idempotent and operation-bound", async () => {
  await resetFinancialState("0.00");
  const creditKey = `${prefix}:admin-credit`;
  await Promise.all([
    creditBusinessDeposit({ accountId, amount: 100, description: "top-up", idempotencyKey: creditKey }),
    creditBusinessDeposit({ accountId, amount: 100, description: "top-up", idempotencyKey: creditKey }),
  ]);
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "100.00");
  assert.equal(await prisma.billingTransaction.count({ where: { billingAccountId: accountId, idempotencyKey: creditKey } }), 1);

  const debitKey = `${prefix}:admin-debit`;
  await Promise.all([
    debitBusinessDeposit({ accountId, amount: 10, type: "MANUAL_ADJUSTMENT", description: "adjust", idempotencyKey: debitKey }),
    debitBusinessDeposit({ accountId, amount: 10, type: "MANUAL_ADJUSTMENT", description: "adjust", idempotencyKey: debitKey }),
  ]);
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "90.00");
  await assert.rejects(
    debitBusinessDeposit({ accountId, amount: 11, type: "MANUAL_ADJUSTMENT", description: "conflict", idempotencyKey: debitKey }),
    BillingIdempotencyConflictError,
  );
});

test("refund is debit-only, capped and idempotent", async () => {
  await resetFinancialState("100.00");
  const debit = await debitBusinessDeposit({
    accountId, amount: 40, type: "FEATURE_CHARGE", description: "paid feature",
    referenceType: BillingReferenceType.OFFER, referenceId: offerId,
    idempotencyKey: `${prefix}:refundable-debit`,
  });
  const refundKey = `${prefix}:refund`;
  const [first, replay] = await Promise.all([
    createRefund({ parentTransactionId: debit.id, amount: 15, currency: "BYN", idempotencyKey: refundKey, reason: "QA reversal" }),
    createRefund({ parentTransactionId: debit.id, amount: 15, currency: "BYN", idempotencyKey: refundKey, reason: "QA reversal" }),
  ]);
  assert.equal(first.refund.id, replay.refund.id);
  assert.equal(await prisma.billingTransaction.count({ where: { billingAccountId: accountId, idempotencyKey: refundKey } }), 1);
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "75.00");
  await assert.rejects(createRefund({
    parentTransactionId: debit.id, amount: 30, currency: "BYN",
    idempotencyKey: `${prefix}:refund-over-cap`, reason: "too much",
  }));

  const topup = await prisma.billingTransaction.findFirstOrThrow({
    where: { billingAccountId: accountId, type: "DEPOSIT_TOPUP" },
  });
  await assert.rejects(
    createRefund({ parentTransactionId: topup.id, amount: 10, currency: "BYN", idempotencyKey: `${prefix}:bad-topup-refund`, reason: "invalid" }),
    RefundNotAllowedError,
  );
  await assert.rejects(
    createRefund({ parentTransactionId: first.refund.id, amount: 1, currency: "BYN", idempotencyKey: `${prefix}:refund-refund`, reason: "invalid" }),
    RefundNotAllowedError,
  );
});

test("financial writes reject non-finite, over-precision and excessive amounts", async () => {
  await resetFinancialState("100.00");
  await assert.rejects(creditBusinessDeposit({ accountId, amount: 1.001, description: "invalid" }));
  await assert.rejects(creditBusinessDeposit({ accountId, amount: Number.POSITIVE_INFINITY, description: "invalid" }));
  await assert.rejects(creditBusinessDeposit({ accountId, amount: 1_000_000.01, description: "invalid" }));
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "100.00");
});

test("Boost uses server price and atomically links one debit", async () => {
  await resetFinancialState("100.00");
  assert.deepEqual(getConfiguredBoostOptions(), [
    { id: "BOOST_1_DAY", durationDays: 1, price: 5, currency: "BYN" },
    { id: "BOOST_3_DAYS", durationDays: 3, price: 12, currency: "BYN" },
    { id: "BOOST_7_DAYS", durationDays: 7, price: 25, currency: "BYN" },
  ]);
  const key = `${prefix}:boost-success`;
  const purchase = await purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_3_DAYS", requestKey: key });
  const replay = await purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_3_DAYS", requestKey: key });
  await assert.rejects(
    purchaseOfferBoost({ businessId: foreignBusinessId, actorUserId: foreignOwnerId, offerId, optionId: "BOOST_3_DAYS", requestKey: key }),
    BoostPurchaseNotAllowedError,
  );
  assert.equal(purchase.boost.id, replay.boost.id);
  assert.equal(purchase.boost.price?.toFixed(2), "12.00");
  assert.equal(purchase.boost.durationDays, 3);
  assert.equal(purchase.boost.billingTransactionId, purchase.transaction?.id);
  assert.equal(purchase.transaction?.amount.toFixed(2), "-12.00");
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "88.00");
  assert.equal(await prisma.boost.count({ where: { offerId } }), 1);
});

test("Boost pricing rejects unsupported options and fails closed on missing or invalid config", async () => {
  await resetFinancialState("100.00");
  await assert.rejects(
    purchaseOfferBoost({
      businessId,
      actorUserId: userId,
      offerId,
      optionId: "BOOST_14_DAYS" as never,
      requestKey: `${prefix}:unsupported-duration`,
    }),
    BoostPricingUnavailableError,
  );

  const originalOneDayPrice = process.env.BOOST_PRICE_1D_BYN;
  delete process.env.BOOST_PRICE_1D_BYN;
  assert.equal(getConfiguredBoostOptions().some((option) => option.id === "BOOST_1_DAY"), false);
  await assert.rejects(
    purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:missing-price` }),
    BoostPricingUnavailableError,
  );

  process.env.BOOST_PRICE_1D_BYN = "0";
  assert.throws(() => getConfiguredBoostOptions(), BoostPricingUnavailableError);
  process.env.BOOST_PRICE_1D_BYN = originalOneDayPrice;

  assert.equal(await prisma.boost.count({ where: { offerId } }), 0);
  assert.equal(await prisma.billingTransaction.count({
    where: { billingAccountId: accountId, type: "FEATURE_CHARGE" },
  }), 0);
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "100.00");
});

test("Boost rejects insufficient funds, foreign ownership and concurrent active duplicates", async () => {
  await resetFinancialState("4.00");
  await assert.rejects(
    purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:insufficient` }),
    BillingInsufficientFundsError,
  );
  assert.equal(await prisma.boost.count({ where: { offerId } }), 0);
  assert.equal(await prisma.billingTransaction.count({ where: { billingAccountId: accountId, type: "FEATURE_CHARGE" } }), 0);

  await assert.rejects(
    purchaseOfferBoost({ businessId: "foreign-business", actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:foreign` }),
    PaidBoostOwnerRequiredError,
  );

  await resetFinancialState("100.00");
  const concurrent = await Promise.allSettled([
    purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:boost-a` }),
    purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:boost-b` }),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  const failure = concurrent.find((result) => result.status === "rejected");
  assert.ok(failure && failure.reason instanceof BoostAlreadyActiveError);
  assert.equal(await prisma.boost.count({ where: { offerId } }), 1);
  assert.equal(await prisma.billingTransaction.count({ where: { billingAccountId: accountId, type: "FEATURE_CHARGE" } }), 1);
});

test("paid Promotion is disabled and reconciliation detects divergence without fixing", async () => {
  const promotionResult = await registerPromotionActionFromUserEvent({
    userEventId: "not-persisted", eventType: "CTA_CLICK", entityType: "OFFER", entityId: offerId,
  });
  assert.deepEqual(promotionResult, { applied: false, reason: "paid_promotion_disabled" });

  await resetFinancialState("100.00");
  const matched = await reconcileBillingAccounts();
  assert.equal(matched.rows.find((row) => row.accountId === accountId)?.matched, true);
  await prisma.billingAccount.update({ where: { id: accountId }, data: { depositBalance: 99 } });
  const mismatched = await reconcileBillingAccounts();
  assert.equal(mismatched.rows.find((row) => row.accountId === accountId)?.mismatchAmount, "-1.00");
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "99.00");
});

test("decimal credit limit permits exact boundary debit", async () => {
  await resetFinancialState("0.10");
  await prisma.billingAccount.update({ where: { id: accountId }, data: { creditLimit: new Prisma.Decimal("0.20") } });
  await debitBusinessDeposit({ accountId, amount: 0.30, type: "FEATURE_CHARGE", description: "exact boundary" });
  const account = await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } });
  assert.equal(account.depositBalance.toFixed(2), "-0.20");
});

test("suspended account rejects new service debit without changing balance", async () => {
  await resetFinancialState("10.00");
  await suspendBillingAccount(accountId, "test");
  try {
    await assert.rejects(debitBusinessDeposit({ accountId, amount: 1, type: "PROMOTION_CHARGE", description: "blocked" }), /not active/);
    const account = await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } });
    assert.equal(account.depositBalance.toFixed(2), "10.00");
  } finally {
    await reactivateBillingAccount(accountId);
  }
});

test("reconciliation and concurrent credit preserve ledger balance", async () => {
  await resetFinancialState("0.10");
  await Promise.all([
    recalculateDepositBalance(accountId),
    creditBusinessDeposit({ accountId, amount: 0.20, description: "concurrent credit" }),
  ]);
  const account = await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } });
  assert.equal(account.depositBalance.toFixed(2), "0.30");
});

test("fractional partial refunds exhaust the original debit exactly", async () => {
  await resetFinancialState("1.00");
  const debit = await debitBusinessDeposit({ accountId, amount: 0.30, type: "FEATURE_CHARGE", description: "fractional debit" });
  await createRefund({ parentTransactionId: debit.id, amount: 0.10, currency: "BYN", idempotencyKey: `${prefix}:fractional-a`, reason: "partial" });
  const result = await createRefund({ parentTransactionId: debit.id, amount: 0.20, currency: "BYN", idempotencyKey: `${prefix}:fractional-b`, reason: "remaining" });
  assert.equal(result.refundSummaryAfter.availableAmount, 0);
  assert.equal(result.refundSummaryAfter.canRefund, false);
});

test("paid Boost is owner-only on the server, including replay and direct service calls", async () => {
  await resetFinancialState("100.00");
  const ownerKey = `${prefix}:owner-paid`;
  await purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: ownerKey });
  // MANAGER cannot replay the owner's key (no disclosure) or start a new paid purchase.
  await assert.rejects(
    purchaseOfferBoost({ businessId, actorUserId: managerId, offerId, optionId: "BOOST_1_DAY", requestKey: ownerKey }),
    PaidBoostOwnerRequiredError,
  );
  await prisma.boost.deleteMany({ where: { offerId } });
  await assert.rejects(
    purchaseOfferBoost({ businessId, actorUserId: managerId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:manager-offer` }),
    PaidBoostOwnerRequiredError,
  );
  await assert.rejects(
    purchaseEventBoost({ businessId, ownerUserId: managerId, activityId: "any-event", optionId: "BOOST_1_DAY", requestKey: `${prefix}:manager-event`, targetRegionIds: [] }),
    PaidBoostOwnerRequiredError,
  );
  // An owner whose OWNER membership is inactive loses spending rights too.
  await prisma.businessMember.updateMany({ where: { businessId, userId }, data: { isActive: false } });
  try {
    await assert.rejects(
      purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:inactive-owner` }),
      PaidBoostOwnerRequiredError,
    );
  } finally {
    await prisma.businessMember.updateMany({ where: { businessId, userId }, data: { isActive: true } });
  }
  assert.equal(await prisma.boost.count({ where: { offerId } }), 0);
  assert.equal(await prisma.billingTransaction.count({ where: { billingAccountId: accountId, type: "FEATURE_CHARGE" } }), 1);
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "95.00");
});

test("refund preview rejects topups and accepts eligible debit", async () => {
  await resetFinancialState("1.00");
  const topup = await creditBusinessDeposit({ accountId, amount: 0.10, description: "preview topup" });
  await assert.rejects(getRefundPreview(topup.id), RefundNotAllowedError);
  const debit = await debitBusinessDeposit({ accountId, amount: 0.30, type: "FEATURE_CHARGE", description: "preview debit" });
  const preview = await getRefundPreview(debit.id);
  assert.equal(preview.availableAmount, 0.30);
  assert.equal(preview.canRefund, true);
});

test("transaction summary preserves fractional ledger totals", async () => {
  await resetFinancialState("0.10");
  await creditBusinessDeposit({ accountId, amount: 0.20, description: "fractional credit" });
  const debit = await debitBusinessDeposit({ accountId, amount: 0.30, type: "FEATURE_CHARGE", description: "summary debit" });
  await createRefund({ parentTransactionId: debit.id, amount: 0.10, currency: "BYN", idempotencyKey: `${prefix}:summary-refund`, reason: "partial" });
  assert.deepEqual(await getBillingTransactionsSummary({ accountId }), {
    totalTopups: 0.30, totalCharges: 0.30, totalRefunds: 0.10, netChange: 0.10, transactionsCount: 4,
  });
});

test("a paid Boost replay survives a tariff change without a second debit", async () => {
  await resetFinancialState("100.00");
  const key = `${prefix}:tariff-change`;
  const first = await purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: key });
  const original = process.env.BOOST_PRICE_1D_BYN;
  try {
    for (const changed of ["9", undefined]) {
      if (changed === undefined) delete process.env.BOOST_PRICE_1D_BYN;
      else process.env.BOOST_PRICE_1D_BYN = changed;
      const replay = await purchaseOfferBoost({ businessId, actorUserId: userId, offerId, optionId: "BOOST_1_DAY", requestKey: key });
      assert.equal(replay.idempotentReplay, true);
      assert.equal(replay.boost.id, first.boost.id);
    }
  } finally {
    process.env.BOOST_PRICE_1D_BYN = original;
  }
  assert.equal(await prisma.billingTransaction.count({ where: { billingAccountId: accountId, type: "FEATURE_CHARGE" } }), 1);
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "95.00");
});
