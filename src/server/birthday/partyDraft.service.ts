import { childScopeFor } from "@/server/family/familyAccess";
import { partyOrderReadModel } from "./partyOrderReadModel";
import { isEligibleForConstructor } from "./constructorEligibility";
import { constructorOfferSelect, constructorPartyDetails, toConstructorOffer } from "./constructorOffer";
import { assessConstructorGeography } from "./constructorMatching";
import { getPublicBirthdayOfferWhere } from "./birthdayOfferVisibility";
import { PartyCategory, PartyOrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { PartyApiError, type UpdatePartyDraft } from "./partyDraft.validation";
import {
  assertCompatibleSelection, includedCategories, offerPriceSnapshot, type CatalogOffer,
} from "./partySelection";

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
          offer: { select: { id: true, title: true, priceMode: true, priceFrom: true, currency: true } },
          requests: {
            orderBy: { createdAt: "desc" },
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
  return { ...party, summary: partyOrderReadModel(party) };
}

/** Fetch all selected offers using the same public visibility and approved BIRTHDAY placement. */
export async function verifyPartyOffers(
  citySlug: string, offerIds: string[], tx?: Prisma.TransactionClient, venueMode: "VENUE" | "PACKAGE" | "HOME" | "OUTDOOR" = "VENUE",
): Promise<Map<string, CatalogOffer>> {
  const city = await findCityBySlug(citySlug, { select: { id: true }, isActive: true });
  if (!city) throw new PartyApiError(422, "Город не найден");
  if (new Set(offerIds).size !== offerIds.length) {
    throw new PartyApiError(422, "Повторяющиеся услуги");
  }
  const db = tx ?? prisma;
  const destination = await db.territoryLegacyMap.findUnique({ where: { legacyKind_legacyId: { legacyKind: "CITY", legacyId: city.id } }, select: { territoryId: true } });
  const fetched = await db.offer.findMany({
    where: { AND: [{ id: { in: offerIds } },getPublicBirthdayOfferWhere(null)] },
    select: constructorOfferSelect,
  });
  const rows = fetched.filter(offer => {
    if (!isEligibleForConstructor(offer.place?.ownerBusiness)) return false;
    try { return assessConstructorGeography(toConstructorOffer(offer),destination ? { state: "KNOWN", value: { territoryId: destination.territoryId, placeId: null } } : { state: "UNKNOWN", reason: "NOT_PROVIDED" },venueMode) !== "MISMATCH"; }
    catch { return false; }
  });
  if (rows.length !== offerIds.length) {
    throw new PartyApiError(422, "Одно из предложений больше не опубликовано");
  }
  return new Map(rows.map((offer) => [offer.id, { ...offer, details: constructorPartyDetails(offer), constructorPrice: toConstructorOffer(offer).price }]));
}

function snapshotDecimal(offer: CatalogOffer): Prisma.Decimal | null {
  const price = offerPriceSnapshot(offer);
  return price == null ? null : new Prisma.Decimal(price);
}

export async function updatePartyDraft(
  ownerUserId: string, partyId: string, input: UpdatePartyDraft,
) {
  const existing = await prisma.partyOrder.findFirst({
    where: { id: partyId, ownerUserId },
    select: { citySlug: true, status: true, version: true, venueMode: true, childAge: true, recipientAudience: true },
  });
  if (!existing) throw new PartyApiError(404, "Праздник не найден");
  if (existing.status !== PartyOrderStatus.DRAFT || existing.version !== input.version) {
    throw new PartyApiError(409, "Черновик изменился. Обновите страницу");
  }

  if (input.selectedChildId && !await prisma.child.findFirst({
    where: { id: input.selectedChildId, ...(await childScopeFor(ownerUserId)) }, select: { id: true },
  })) throw new PartyApiError(422, "Выбранный профиль ребёнка недоступен");

  const recipientAudience = input.recipientAudience === undefined ? existing.recipientAudience : input.recipientAudience;
  const childAge = input.childAge === undefined ? existing.childAge : input.childAge;
  const conflictingAge = childAge !== null && recipientAudience !== null &&
    (childAge >= 18 ? "ADULT" : "CHILD") !== recipientAudience;
  if (conflictingAge && input.childAge !== undefined) {
    throw new PartyApiError(422, "Возраст не соответствует выбранному получателю");
  }

  const selectionChange = input.anchorOfferId !== undefined;
  const newMode = input.venueMode ?? existing.venueMode;
  if (input.venueMode && input.venueMode !== existing.venueMode && !selectionChange) {
    throw new PartyApiError(422, "При смене формата выберите основное предложение заново");
  }
  let anchor: CatalogOffer | null = null;
  let addons: CatalogOffer[] = [];
  if (selectionChange && input.anchorOfferId) {
    const ids = [input.anchorOfferId, ...(input.addonOfferIds ?? [])];
    const verified = await verifyPartyOffers(existing.citySlug, ids, undefined, newMode);
    anchor = verified.get(input.anchorOfferId) ?? null;
    if (!anchor) throw new PartyApiError(422, "Основное предложение не найдено");
    addons = (input.addonOfferIds ?? []).map((id) => verified.get(id)!);
    assertCompatibleSelection(newMode, anchor, addons);
  } else if (selectionChange && input.addonOfferIds?.length) {
    throw new PartyApiError(422, "Для дополнительных услуг выберите основную");
  }

  const { version, anchorOfferId, addonOfferIds, addonCategories, ...changes } = input;
  void anchorOfferId;
  void addonOfferIds;
  void addonCategories;
  const data: Prisma.PartyOrderUpdateManyMutationInput = {
    ...changes,
    ...(conflictingAge ? { childAge: null } : {}),
    ...(input.recipientAudience === "ADULT" && input.selectedChildId === undefined
      ? { selectedChildId: null } : {}),
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
            offerPriceSnapshot: snapshotDecimal(anchor),
            position: 0,
          },
        });
        let position = 1;
        for (const component of anchor.components.length ? anchor.components.filter(component => !component.isOptional) : includedCategories(anchor).map(category => ({ category, isOptional: false, id: undefined, title: undefined, refOfferId: null, priceSnapshot: null, priceDelta: null }))) {
          await tx.partyOrderItem.create({
            data: {
              partyOrderId: partyId, category: component.category, businessId, parentItemId: anchorItem.id,
              packageComponentId: component.id,
              packageComponentSnapshot: component.id ? {
                id: component.id, title: component.title ?? null, category: component.category,
                refOfferId: component.refOfferId ?? null, isOptional: component.isOptional,
                priceSnapshot: component.priceSnapshot?.toFixed(2) ?? null,
                priceDelta: component.priceDelta?.toFixed(2) ?? null,
              } : undefined,
              role: "INCLUDED", position: position++,
            },
          });
        }
        const selectedCategories = new Set(addons.map(addon => addon.category));
        for (const category of input.addonCategories ?? []) {
          if (selectedCategories.has(category) || includedCategories(anchor).includes(category)) {
            throw new PartyApiError(422, "Услуга этой категории уже выбрана");
          }
          await tx.partyOrderItem.create({
            data: { partyOrderId: partyId, category,
              role: "ADDON", position: position++ },
          });
        }
        for (const addon of addons) {
          await tx.partyOrderItem.create({
            data: {
              partyOrderId: partyId, category: addon.category ?? PartyCategory.OTHER,
              offerId: addon.id, businessId: addon.place?.ownerBusinessId,
              role: "STANDALONE",
              offerPriceSnapshot: snapshotDecimal(addon),
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
