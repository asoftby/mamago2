import { BillingReferenceType, BillingTransactionType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BILLING_CURRENCY } from "@/lib/billing/money";
import type { BoostOptionId } from "@/lib/billing/boostOptions";
import { getConfiguredBoostOptions } from "@/server/services/billing/boostPurchase.service";
import { debitBusinessDepositInTx } from "@/server/services/billing/billingAccount.service";
import { validateBoostTargetRegions } from "@/server/geo/boostRegionTargeting";

export async function purchaseEventBoost(params: {
  businessId: string;
  ownerUserId: string;
  activityId: string;
  optionId: BoostOptionId;
  requestKey: string;
  targetRegionIds: string[];
}) {
  const option = getConfiguredBoostOptions().find((item) => item.id === params.optionId);
  if (!option) throw new Error("Тариф Boost недоступен.");
  const targetRegionIds = await validateBoostTargetRegions(params.targetRegionIds);

  return prisma.$transaction(async (tx) => {
    const replay = await tx.boost.findUnique({ where: { purchaseRequestKey: params.requestKey } });
    if (replay) {
      if (replay.activityId !== params.activityId || replay.durationDays !== option.durationDays ||
          !replay.price?.equals(option.price) ||
          JSON.stringify([...replay.targetRegionIds].sort()) !== JSON.stringify([...targetRegionIds].sort())) {
        throw new Error("Ключ запроса уже использован для другой покупки.");
      }
      return { boostId: replay.id, idempotentReplay: true };
    }

    await tx.$queryRaw`SELECT id FROM "Activity" WHERE id = ${params.activityId} FOR UPDATE`;
    const event = await tx.activity.findFirst({
      where: { id: params.activityId, OR: [{ businessId: params.businessId }, { ownerUserId: params.ownerUserId }], type: "EVENT", status: "PUBLISHED" },
      select: { id: true, title: true },
    });
    if (!event) throw new Error("Событие не опубликовано или не принадлежит вашему бизнесу.");

    const now = new Date();
    const active = await tx.boost.findFirst({
      where: { activityId: event.id, startAt: { lte: now }, endAt: { gt: now } },
      select: { id: true },
    });
    if (active) throw new Error("Для этого события уже действует Boost.");

    const account = await tx.billingAccount.findUnique({
      where: { businessId: params.businessId },
      select: { id: true, status: true, currency: true },
    });
    if (!account || account.status !== "ACTIVE" || account.currency !== BILLING_CURRENCY) {
      throw new Error("Необходим активный депозитный счёт в BYN.");
    }

    const boost = await tx.boost.create({
      data: {
        activityId: event.id,
        startAt: now,
        endAt: new Date(now.getTime() + option.durationDays * 86_400_000),
        durationDays: option.durationDays,
        price: new Prisma.Decimal(option.price),
        currency: BILLING_CURRENCY,
        purchaseRequestKey: params.requestKey,
        targetRegionIds,
      },
    });
    const transaction = await debitBusinessDepositInTx(tx, {
      accountId: account.id,
      amount: option.price,
      type: BillingTransactionType.FEATURE_CHARGE,
      description: `Boost события «${event.title}» на ${option.durationDays} дн.`,
      referenceType: BillingReferenceType.EVENT,
      referenceId: boost.id,
      idempotencyKey: `boost:${params.requestKey}`,
      metadata: {
        boostId: boost.id, activityId: event.id, optionId: option.id,
        targetRegionIds, durationDays: option.durationDays, price: option.price,
        currency: BILLING_CURRENCY, requestKey: params.requestKey,
      },
    });
    await tx.boost.update({
      where: { id: boost.id }, data: { billingTransactionId: transaction.id },
    });
    return { boostId: boost.id, idempotentReplay: false };
  });
}
