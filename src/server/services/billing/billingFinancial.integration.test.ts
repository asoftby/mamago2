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
} from "./billingAccount.service";
import { createRefund, RefundNotAllowedError } from "./billingTransaction.service";
import {
  BoostAlreadyActiveError,
  purchaseOfferBoost,
} from "./boostPurchase.service";
import { reconcileBillingAccounts } from "./billingReconciliation.service";
import { registerPromotionActionFromUserEvent } from "../promotion/promotion.service";

const prefix = `task13-${Date.now()}`;
let userId = "";
let businessId = "";
let accountId = "";
let offerId = "";

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
  process.env.BOOST_PRICE_1_DAY_BYN = "10.00";
  process.env.BOOST_PRICE_3_DAYS_BYN = "25.00";
  process.env.BOOST_PRICE_7_DAYS_BYN = "50.00";

  const user = await prisma.user.create({ data: { email: `${prefix}@example.invalid`, role: "BUSINESS_OWNER" } });
  userId = user.id;
  const business = await prisma.business.create({
    data: { name: `${prefix} business`, ownerUserId: user.id, status: "APPROVED" },
  });
  businessId = business.id;
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
  await prisma.business.deleteMany({ where: { id: businessId } });
  await prisma.user.deleteMany({ where: { id: userId } });
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
  const key = `${prefix}:boost-success`;
  const purchase = await purchaseOfferBoost({ businessId, offerId, optionId: "BOOST_3_DAYS", requestKey: key });
  const replay = await purchaseOfferBoost({ businessId, offerId, optionId: "BOOST_3_DAYS", requestKey: key });
  assert.equal(purchase.boost.id, replay.boost.id);
  assert.equal(purchase.boost.price?.toFixed(2), "25.00");
  assert.equal(purchase.boost.durationDays, 3);
  assert.equal(purchase.boost.billingTransactionId, purchase.transaction?.id);
  assert.equal(purchase.transaction?.amount.toFixed(2), "-25.00");
  assert.equal((await prisma.billingAccount.findUniqueOrThrow({ where: { id: accountId } })).depositBalance.toFixed(2), "75.00");
  assert.equal(await prisma.boost.count({ where: { offerId } }), 1);
});

test("Boost rejects insufficient funds, foreign ownership and concurrent active duplicates", async () => {
  await resetFinancialState("5.00");
  await assert.rejects(
    purchaseOfferBoost({ businessId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:insufficient` }),
    BillingInsufficientFundsError,
  );
  assert.equal(await prisma.boost.count({ where: { offerId } }), 0);
  assert.equal(await prisma.billingTransaction.count({ where: { billingAccountId: accountId, type: "FEATURE_CHARGE" } }), 0);

  await assert.rejects(
    purchaseOfferBoost({ businessId: "foreign-business", offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:foreign` }),
  );

  await resetFinancialState("100.00");
  const concurrent = await Promise.allSettled([
    purchaseOfferBoost({ businessId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:boost-a` }),
    purchaseOfferBoost({ businessId, offerId, optionId: "BOOST_1_DAY", requestKey: `${prefix}:boost-b` }),
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
