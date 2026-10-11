import { PartyCategory, PartyOrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { PartyApiError, type UpdatePartyDraft } from "./partyDraft.validation";

export async function createPartyDraft(ownerUserId: string, input: {
  citySlug: string; venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR";
}) {
  const city = await findCityBySlug(input.citySlug, { select: { id: true }, isActive: true });
  if (!city) throw new PartyApiError(422, "Город не найден");
  return prisma.partyOrder.create({
    data: { ownerUserId, citySlug: input.citySlug, venueMode: input.venueMode },
    select: { id: true, version: true, status: true },
  });
}

export async function readPartyOrder(ownerUserId: string, partyId: string) {
  const party = await prisma.partyOrder.findFirst({
    where: { id: partyId, ownerUserId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          offer: { select: { id: true, title: true } },
          requests: {
            select: {
              id: true, partyStage: true, responseDueAt: true,
              partyQuotes: {
                select: {
                  id: true, version: true, status: true, type: true,
                  priceByn: true, includes: true, changeReason: true,
                  prepaymentTerms: true, cancellationTerms: true, validUntil: true,
                },
                orderBy: { version: "desc" },
              },
            },
          },
        },
      },
    },
  });
  if (!party) throw new PartyApiError(404, "Праздник не найден");
  return party;
}

type CatalogOffer = {
  id: string;
  productType: "PARTY_SERVICE" | "PARTY_PACKAGE" | null;
  category: PartyCategory | null;
  priceFrom: number | null;
  currency: string;
  details: Prisma.JsonValue | null;
  components: { category: PartyCategory; isOptional: boolean }[];
  place: { ownerBusinessId: string | null } | null;
};

/** Fetch all selected offers using the same public visibility and approved BIRTHDAY placement. */
export async function verifyPartyOffers(citySlug: string, offerIds: string[]): Promise<Map<string, CatalogOffer>> {
  const city = await findCityBySlug(citySlug, { select: { id: true }, isActive: true });
  if (!city) throw new PartyApiError(422, "Город не найден");
  if (new Set(offerIds).size !== offerIds.length) {
    throw new PartyApiError(422, "Повторяющиеся услуги");
  }
  const rows = await prisma.offer.findMany({
    where: { AND: [
      { id: { in: offerIds } },
      getPublicPublishedOfferWhere(),
      { productType: { in: ["PARTY_SERVICE", "PARTY_PACKAGE"] } },
      { place: { cityId: city.id, ownerBusinessId: { not: null } } },
      { placements: { some: { key: "BIRTHDAY", status: "APPROVED" } } },
    ] },
    select: {
      id: true, productType: true, category: true, priceFrom: true,
      currency: true, details: true,
      components: { select: { category: true, isOptional: true } },
      place: { select: { ownerBusinessId: true } },
    },
  });
  if (rows.length !== offerIds.length) {
    throw new PartyApiError(422, "Одно из предложений больше не опубликовано");
  }
  return new Map(rows.map((offer) => [offer.id, offer]));
}

function isVenueOffer(offer: CatalogOffer): boolean {
  return offer.productType === "PARTY_PACKAGE" || offer.category === "VENUE";
}

function includedCategories(offer: CatalogOffer): PartyCategory[] {
  if (offer.productType !== "PARTY_PACKAGE") return [];
  const details = offer.details && typeof offer.details === "object" &&
    !Array.isArray(offer.details) ? offer.details as Record<string, unknown> : {};
  const included = Array.isArray(details.includedCategories) ? details.includedCategories : [];
  const validCategories = new Set(Object.values(PartyCategory));
  return [...new Set([
    ...included.filter((v): v is PartyCategory => typeof v === "string" &&
      validCategories.has(v as PartyCategory)),
    ...offer.components.filter((v) => !v.isOptional).map((v) => v.category),
  ])];
}

export async function updatePartyDraft(
  ownerUserId: string, partyId: string, input: UpdatePartyDraft,
) {
  const existing = await prisma.partyOrder.findFirst({
    where: { id: partyId, ownerUserId },
    select: { citySlug: true, status: true, version: true, venueMode: true },
  });
  if (!existing) throw new PartyApiError(404, "Праздник не найден");
  if (existing.status !== PartyOrderStatus.DRAFT || existing.version !== input.version) {
    throw new PartyApiError(409, "Черновик изменился. Обновите страницу");
  }

  const selectionChange = input.anchorOfferId !== undefined;
  const newMode = input.venueMode ?? existing.venueMode;
  let anchor: CatalogOffer | null = null;
  let addons: CatalogOffer[] = [];
  if (selectionChange && input.anchorOfferId) {
    const ids = [input.anchorOfferId, ...(input.addonOfferIds ?? [])];
    const verified = await verifyPartyOffers(existing.citySlug, ids);
    anchor = verified.get(input.anchorOfferId) ?? null;
    if (!anchor) throw new PartyApiError(422, "Основное предложение не найдено");
    if ((newMode === "VENUE" || newMode === "PACKAGE") !== isVenueOffer(anchor)) {
      throw new PartyApiError(422, "Основное предложение не соответствует формату");
    }
    addons = (input.addonOfferIds ?? []).map((id) => verified.get(id)!);
    const included = new Set(includedCategories(anchor));
    if (addons.some((offer) => isVenueOffer(offer) || (offer.category && included.has(offer.category)))) {
      throw new PartyApiError(422, "Дополнительная услуга уже входит в пакет или является площадкой");
    }
  } else if (selectionChange && input.addonOfferIds?.length) {
    throw new PartyApiError(422, "Для дополнительных услуг выберите основную");
  }

  const { version, anchorOfferId, addonOfferIds, ...changes } = input;
  void anchorOfferId;
  void addonOfferIds;
  const data: Prisma.PartyOrderUpdateManyMutationInput = {
    ...changes,
    eventDate: changes.eventDate === undefined
      ? undefined : changes.eventDate === null ? null : new Date(changes.eventDate + "T00:00:00Z"),
    budgetByn: changes.budgetByn === undefined
      ? undefined : changes.budgetByn === null ? null : new Prisma.Decimal(changes.budgetByn),
    contactName: changes.contactName === undefined ? undefined : changes.contactName?.trim() || null,
    contactPhone: changes.contactPhone === undefined ? undefined : changes.contactPhone?.trim() || null,
    childName: changes.childName === undefined ? undefined : changes.childName?.trim() || null,
    version: { increment: 1 },
  };

  return prisma.$transaction(async (tx) => {
    const result = await tx.partyOrder.updateMany({
      where: { id: partyId, ownerUserId, status: "DRAFT", version },
      data,
    });
    if (result.count !== 1) throw new PartyApiError(409, "Черновик изменился. Обновите страницу");

    if (selectionChange) {
      // Only DRAFT items exist; any sent request would prevent reaching here.
      await tx.partyOrderItem.deleteMany({ where: { partyOrderId: partyId } });
      if (anchor) {
        const businessId = anchor.place?.ownerBusinessId ?? null;
        if (!businessId) throw new PartyApiError(422, "Исполнитель недоступен");
        const anchorItem = await tx.partyOrderItem.create({
          data: {
            partyOrderId: partyId, category: anchor.category ?? PartyCategory.OTHER,
            offerId: anchor.id, businessId, role: "ANCHOR",
            offerPriceSnapshot: anchor.currency === "BYN" && anchor.priceFrom != null
              ? new Prisma.Decimal(anchor.priceFrom) : null,
            position: 0,
          },
        });
        let position = 1;
        for (const category of includedCategories(anchor)) {
          await tx.partyOrderItem.create({
            data: {
              partyOrderId: partyId, category, businessId, parentItemId: anchorItem.id,
              role: "INCLUDED", position: position++,
            },
          });
        }
        for (const addon of addons) {
          await tx.partyOrderItem.create({
            data: {
              partyOrderId: partyId, category: addon.category ?? PartyCategory.OTHER,
              offerId: addon.id, businessId: addon.place?.ownerBusinessId,
              role: "STANDALONE",
              offerPriceSnapshot: addon.currency === "BYN" && addon.priceFrom != null
                ? new Prisma.Decimal(addon.priceFrom) : null,
              position: position++,
            },
          });
        }
      }
    }
    return tx.partyOrder.findUniqueOrThrow({
      where: { id: partyId },
      include: { items: { orderBy: { position: "asc" } } },
    });
  });
}
