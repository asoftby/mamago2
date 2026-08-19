import { BillingReferenceType, BillingTransactionType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BILLING_CURRENCY, normalizeFinancialAmount } from "@/lib/billing/money";
import {
  BOOST_OPTION_DEFINITIONS,
  type BoostOptionId,
} from "@/lib/billing/boostOptions";
import { debitBusinessDepositInTx } from "./billingAccount.service";

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
  offerId: string;
  optionId: BoostOptionId;
  requestKey: string;
}) {
  const option = getConfiguredBoostOptions().find((item) => item.id === params.optionId);
  if (!option) {
    throw new BoostPricingUnavailableError("Selected Boost option is not enabled");
  }

  return prisma.$transaction(async (tx) => {
    const replay = await tx.boost.findUnique({
      where: { purchaseRequestKey: params.requestKey },
      include: { billingTransaction: true },
    });
    if (replay) {
      if (
        replay.offerId !== params.offerId ||
        replay.durationDays !== option.durationDays ||
        !replay.price?.equals(option.price)
      ) {
        throw new BoostPurchaseNotAllowedError("Request key was used for another Boost purchase");
      }
      return { boost: replay, transaction: replay.billingTransaction, idempotentReplay: true };
    }

    // Serializes eligibility and active-Boost decisions for this Offer.
    await tx.$queryRaw`SELECT id FROM "Offer" WHERE id = ${params.offerId} FOR UPDATE`;

    const offer = await tx.offer.findFirst({
      where: {
        id: params.offerId,
        status: "PUBLISHED",
        archivedAt: null,
        place: {
          archivedAt: null,
          ownerBusinessId: params.businessId,
        },
      },
      select: { id: true, title: true },
    });
    if (!offer) {
      throw new BoostPurchaseNotAllowedError("Offer is not eligible or belongs to another business");
    }

    const now = new Date();
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
