import { BillingReferenceType, BillingTransactionType, Prisma } from "@prisma/client";
import { assertPaidBoostPurchaserInTx } from "@/server/services/billing/paidBoostAuthorization";
import prisma from "@/lib/prisma";
import { BILLING_CURRENCY, normalizeFinancialAmount } from "@/lib/billing/money";
import {
  BOOST_OPTION_DEFINITIONS,
  type BoostOptionId,
} from "@/lib/billing/boostOptions";
import { debitBusinessDepositInTx } from "./billingAccount.service";
import { validateBoostTargetRegions } from "@/server/geo/boostRegionTargeting";
import { getBoostablePublishedOfferWhere } from "@/server/services/promotion/boostEligibility";

export class BoostPurchaseNotAllowedError extends Error {
  code = "BOOST_PURCHASE_NOT_ALLOWED" as const;
}

export class BoostAlreadyActiveError extends Error {
  code = "BOOST_ALREADY_ACTIVE" as const;
}

export class BoostPricingUnavailableError extends Error {
  code = "BOOST_PRICING_UNAVAILABLE" as const;
}

export function getConfiguredBoostOptions() {
  return BOOST_OPTION_DEFINITIONS.flatMap((definition) => {
    const rawPrice = process.env[definition.envName];
    if (!rawPrice) return [];

    try {
      const price = normalizeFinancialAmount(rawPrice);
      return [{
        id: definition.id,
        durationDays: definition.durationDays,
        price: price.toNumber(),
        currency: BILLING_CURRENCY,
      }];
    } catch {
      throw new BoostPricingUnavailableError(
        `Invalid server Boost price configuration: ${definition.envName}`,
      );
    }
  });
}

export async function purchaseOfferBoost(params: {
  businessId: string;
  /** Authenticated user spending the deposit; must be an active OWNER or MANAGER of this business. */
  actorUserId: string;
  offerId: string;
  optionId: BoostOptionId;
  requestKey: string;
  targetRegionIds?: string[];
}) {
  const definition = BOOST_OPTION_DEFINITIONS.find((item) => item.id === params.optionId);
  if (!definition) {
    throw new BoostPricingUnavailableError("Unknown Boost option");
  }

  const targetRegionIds = await validateBoostTargetRegions(params.targetRegionIds ?? []);

  return prisma.$transaction(async (tx) => {
    // Paid Boost spends money: authorize before replay disclosure or any debit.
    await assertPaidBoostPurchaserInTx(tx, params.businessId, params.actorUserId);
    const replay = await tx.boost.findUnique({
      where: { purchaseRequestKey: params.requestKey },
      include: { billingTransaction: { include: { billingAccount: { select: { businessId: true } } } } },
    });
    if (replay) {
      if (
        replay.billingTransaction?.billingAccount.businessId !== params.businessId ||
        replay.offerId !== params.offerId ||
        replay.durationDays !== definition.durationDays ||
        JSON.stringify([...replay.targetRegionIds].sort()) !== JSON.stringify([...targetRegionIds].sort())
      ) {
        throw new BoostPurchaseNotAllowedError("Request key was used for another Boost purchase");
      }
      const { billingAccount: _billingAccount, ...transaction } = replay.billingTransaction!;
      return { boost: { ...replay, billingTransaction: transaction }, transaction, idempotentReplay: true };
    }

    // A legitimate replay is independent of later price edits or option disablement.
    // A new purchase must still use an enabled, server-configured price.
    const option = getConfiguredBoostOptions().find((item) => item.id === params.optionId);
    if (!option) {
      throw new BoostPricingUnavailableError("Selected Boost option is not enabled");
    }

    // Serializes eligibility and active-Boost decisions for this Offer.
    await tx.$queryRaw`SELECT id FROM "Offer" WHERE id = ${params.offerId} FOR UPDATE`;

    const now = new Date();
    const offer = await tx.offer.findFirst({
      where: {
        id: params.offerId,
        AND: [
          getBoostablePublishedOfferWhere(now),
          { place: { ownerBusinessId: params.businessId } },
        ],
      },
      select: { id: true, title: true },
    });
    if (!offer) {
      throw new BoostPurchaseNotAllowedError("Offer is not publicly eligible or belongs to another business");
    }

    const activeBoost = await tx.boost.findFirst({
      where: { offerId: offer.id, startAt: { lte: now }, endAt: { gt: now } },
      select: { id: true },
    });
    if (activeBoost) {
      throw new BoostAlreadyActiveError("This Offer already has an active Boost");
    }

    const account = await tx.billingAccount.findUnique({
      where: { businessId: params.businessId },
      select: { id: true, status: true, currency: true },
    });
    if (!account || account.status !== "ACTIVE" || account.currency !== BILLING_CURRENCY) {
      throw new BoostPurchaseNotAllowedError("An active BYN billing account is required");
    }

    const endAt = new Date(now.getTime() + option.durationDays * 24 * 60 * 60 * 1000);
    const boost = await tx.boost.create({
      data: {
        offerId: offer.id,
        startAt: now,
        endAt,
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
      description: `Boost предложения «${offer.title}» на ${option.durationDays} дн.`,
      referenceType: BillingReferenceType.OFFER,
      referenceId: boost.id,
      idempotencyKey: `boost:${params.requestKey}`,
      metadata: {
        boostId: boost.id,
        offerId: offer.id,
        optionId: option.id,
        durationDays: option.durationDays,
        price: option.price,
        currency: BILLING_CURRENCY,
        requestKey: params.requestKey,
        targetRegionIds,
      },
    });

    const linkedBoost = await tx.boost.update({
      where: { id: boost.id },
      data: { billingTransactionId: transaction.id },
      include: { billingTransaction: true },
    });

    return { boost: linkedBoost, transaction, idempotentReplay: false };
  });
}
