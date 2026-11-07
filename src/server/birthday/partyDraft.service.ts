import { PartyCategory, PartyOrderStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { getPublicPublishedOfferWhere } from "@/server/public/publicContentVisibility";
import { withDraftEstimate } from "./partyDraftEstimate";
import { PartyApiError, type UpdatePartyDraft } from "./partyDraft.validation";
import {
  assertCompatibleSelection, includedCategories, isCompatiblePartyLocation, isVenueOffer, offerPriceSnapshot, type CatalogOffer,
} from "./partySelection";

const draftComponentSelect = {
  id: true, title: true, category: true, refOfferId: true,
  isOptional: true, priceSnapshot: true, priceDelta: true,
  removalPolicy: true, removalCreditByn: true,
} satisfies Prisma.PackageComponentSelect;

type DraftCatalogOffer = Omit<CatalogOffer, "components"> & {
  components: Prisma.PackageComponentGetPayload<{ select: typeof draftComponentSelect }>[];
};

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

const draftOfferSelect = {
  id: true, title: true, priceFrom: true, priceMode: true, currency: true,
} satisfies Prisma.OfferSelect;

export async function readPartyOrder(ownerUserId: string, partyId: string) {
  const party = await prisma.partyOrder.findFirst({
    where: { id: partyId, ownerUserId },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          offer: { select: draftOfferSelect },
          requests: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true, partyStage: true, responseDueAt: true, bookingPriceSnapshot: true,
              partyQuotes: {
                select: {
                  id: true, version: true, status: true, type: true,
                  priceByn: true, includes: true, changeReason: true,
                  prepaymentTerms: true, cancellationTerms: true, validUntil: true, declineReason: true, declineComment: true,
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
  return withDraftEstimate(party);
}

/** Fetch all selected offers using the same public visibility and approved BIRTHDAY placement. */
export async function verifyPartyOffers(
  citySlug: string, offerIds: string[], tx?: Prisma.TransactionClient,
): Promise<Map<string, DraftCatalogOffer>> {
  const city = await findCityBySlug(citySlug, { select: { id: true }, isActive: true });
  if (!city) throw new PartyApiError(422, "Город не найден");
  if (new Set(offerIds).size !== offerIds.length) {
    throw new PartyApiError(422, "Повторяющиеся услуги");
  }
  const rows = await (tx ?? prisma).offer.findMany({
    where: { AND: [
      { id: { in: offerIds } },
      getPublicPublishedOfferWhere(),
      { productType: { in: ["PARTY_SERVICE", "PARTY_PACKAGE"] } },
      { place: { cityId: city.id, ownerBusinessId: { not: null } } },
      { placements: { some: { key: "BIRTHDAY", status: "APPROVED" } } },
    ] },
    select: {
      id: true, productType: true, category: true, partyLocationType: true,
      priceFrom: true, priceMode: true, currency: true, details: true,
      ageMinMonths: true, ageMaxMonths: true, minChildren: true, maxChildren: true,
      components: {
        where: { archivedAt: null },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: draftComponentSelect,
      },
      place: { select: { ownerBusinessId: true } },
    },
  });
  if (rows.length !== offerIds.length) {
    throw new PartyApiError(422, "Одно из предложений больше не опубликовано");
  }
  return new Map(rows.map((offer) => [offer.id, offer]));
}

function snapshotDecimal(offer: CatalogOffer): Prisma.Decimal | null {
  const price = offerPriceSnapshot(offer);
  return price == null ? null : new Prisma.Decimal(price);
}

function changeObject(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function changePackageItem(
  tx: Prisma.TransactionClient, partyId: string, mode: UpdatePartyDraft["venueMode"],
  items: { id: string; role: string; category: PartyCategory; offerId: string | null; businessId: string | null;
    position: number; offerPriceSnapshot: Prisma.Decimal | null; draftPriceModeSnapshot: string | null;
    packageComponentSnapshot: Prisma.JsonValue; packageComponentChange: Prisma.JsonValue;
    packageComponentChangeHistory: Prisma.JsonValue }[],
  change: NonNullable<UpdatePartyDraft["packageChange"]>, replacement: DraftCatalogOffer | undefined,
) {
  const item = items.find(row => row.id === change.itemId && row.role === "INCLUDED");
  const anchor = items.find(row => row.role === "ANCHOR");
  if (!item || !anchor) throw new PartyApiError(422, "Компонент не входит в этот пакет");
  const previous = changeObject(item.packageComponentChange);
  if (change.undo) {
    if (!previous) return;
    if (typeof previous.replacementItemId === "string") {
      await tx.partyOrderItem.deleteMany({ where: { partyOrderId: partyId, id: previous.replacementItemId, role: "STANDALONE" } });
    }
    const history = Array.isArray(item.packageComponentChangeHistory) ? item.packageComponentChangeHistory : [];
    await tx.partyOrderItem.update({ where: { id: item.id }, data: {
      packageComponentChange: Prisma.DbNull,
      packageComponentChangeHistory: [...history, { ...previous, undoneAt: new Date().toISOString() }] as Prisma.InputJsonArray,
    } });
    return;
  }

  if (previous) {
    if ((previous.replacementOfferId ?? undefined) === change.replacementOfferId) return;
    throw new PartyApiError(409, "Сначала отмените предыдущее изменение компонента");
  }
  const snapshot = changeObject(item.packageComponentSnapshot);
  const policy = snapshot?.removalPolicy;
  if (policy === "REQUIRED") throw new PartyApiError(422, "Обязательный компонент нельзя убрать");
  const fixedCreditAvailable = policy === "REMOVABLE_FIXED_CREDIT" &&
    typeof snapshot?.removalCreditByn === "string" && anchor.offerPriceSnapshot !== null &&
    Boolean(anchor.draftPriceModeSnapshot);
  const requiresQuote = policy !== "REMOVABLE_NO_REFUND" && !fixedCreditAvailable;
  let credit = new Prisma.Decimal(0);
  if (fixedCreditAvailable && typeof snapshot?.removalCreditByn === "string" && anchor.offerPriceSnapshot !== null) {
    credit = new Prisma.Decimal(snapshot.removalCreditByn);
    const applied = items.reduce((total, row) => {
      const saved = changeObject(row.packageComponentChange);
      return typeof saved?.creditByn === "string" ? total.plus(saved.creditByn) : total;
    }, credit);
    if (credit.lte(0) || applied.gt(anchor.offerPriceSnapshot)) {
      throw new PartyApiError(422, "Уменьшение превышает исходную стоимость пакета");
    }
  }

  let replacementItemId: string | null = null;
  if (change.replacementOfferId) {
    if (!replacement || !mode || replacement.category !== item.category || isVenueOffer(replacement) ||
        !isCompatiblePartyLocation(mode, replacement) || replacement.place?.ownerBusinessId === item.businessId ||
        items.some(row => row.offerId === replacement.id || (row.id !== item.id && row.category === item.category &&
          (row.role === "ADDON" || row.role === "STANDALONE" || (row.role === "INCLUDED" && !row.packageComponentChange))))) {
      throw new PartyApiError(422, "Выберите совместимую услугу другой компании");
    }
    const added = await tx.partyOrderItem.create({ data: {
      partyOrderId: partyId, role: "STANDALONE", category: item.category,
      offerId: replacement.id, businessId: replacement.place?.ownerBusinessId,
      offerPriceSnapshot: snapshotDecimal(replacement), draftPriceModeSnapshot: replacement.priceMode,
      position: Math.max(...items.map(row => row.position)) + 1,
    }, select: { id: true } });
    replacementItemId = added.id;
  }
  await tx.partyOrderItem.update({ where: { id: item.id }, data: {
    packageComponentChange: {
      requiresQuote, creditByn: credit.toFixed(2), replacementItemId,
      replacementOfferId: replacement?.id ?? null, requestedAt: new Date().toISOString(),
    },
  } });
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
  if (input.venueMode && input.venueMode !== existing.venueMode && !selectionChange) {
    throw new PartyApiError(422, "При смене формата выберите основное предложение заново");
  }
  let anchor: DraftCatalogOffer | null = null;
  let addons: CatalogOffer[] = [];
  if (selectionChange && input.anchorOfferId) {
    const ids = [input.anchorOfferId, ...(input.addonOfferIds ?? [])];
    const verified = await verifyPartyOffers(existing.citySlug, ids);
    anchor = verified.get(input.anchorOfferId) ?? null;
    if (!anchor) throw new PartyApiError(422, "Основное предложение не найдено");
    addons = (input.addonOfferIds ?? []).map((id) => verified.get(id)!);
  } else if (selectionChange && input.addonOfferIds?.length) {
    throw new PartyApiError(422, "Для дополнительных услуг выберите основную");
  }

  const packageChange = input.packageChange;
  const replacement = packageChange?.replacementOfferId
    ? (await verifyPartyOffers(existing.citySlug, [packageChange.replacementOfferId])).get(packageChange.replacementOfferId)
    : undefined;
  const { version, anchorOfferId, anchorNote, addonOfferIds, addonCategories, packageChange: _packageChange, ...changes } = input;
  void _packageChange;
  void anchorOfferId;
  void addonOfferIds;
  void addonCategories;
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

    const items = packageChange || selectionChange ? await tx.partyOrderItem.findMany({ where: { partyOrderId: partyId }, select: {
        id: true, role: true, category: true, offerId: true, businessId: true, position: true,
        offerPriceSnapshot: true, draftPriceModeSnapshot: true, packageComponentSnapshot: true,
        packageComponentChange: true, packageComponentChangeHistory: true,
    } }) : [];
    if (packageChange) {
      await changePackageItem(tx, partyId, newMode, items, packageChange, replacement);
    } else if (selectionChange) {
      if (items.some(item => item.packageComponentChange !== null)) {
        throw new PartyApiError(422, "Сначала отмените изменения компонентов пакета");
      }
      const savedAnchor = anchor?.productType === "PARTY_PACKAGE"
        ? items.find(item => item.role === "ANCHOR" && item.offerId === anchor?.id) : undefined;
      if (!savedAnchor && items.some(item => item.packageComponentChangeHistory !== null)) {
        throw new PartyApiError(422, "Для другого пакета создайте новый черновик");
      }
      const savedComponents = savedAnchor ? items.filter(item => item.role === "INCLUDED") : [];
      if (anchor) assertCompatibleSelection(newMode, savedAnchor ? {
        ...anchor, components: [], details: { includedCategories: savedComponents.map(item => item.category) },
      } : anchor, addons);
      const savedAddons = new Map(items.filter(item => item.role === "STANDALONE").map(item => [item.offerId, item]));
      // Preserve package snapshots and component IDs when saving the same anchor.
      await tx.partyOrderItem.deleteMany({ where: {
        partyOrderId: partyId, ...(savedAnchor ? { role: { in: ["STANDALONE", "ADDON"] } } : {}),
      } });
      if (anchor) {
        const businessId = anchor.place?.ownerBusinessId ?? null;
        if (!businessId) throw new PartyApiError(422, "Исполнитель недоступен");
        const anchorItem = savedAnchor ?? await tx.partyOrderItem.create({
          data: {
            partyOrderId: partyId, category: anchor.category ?? PartyCategory.OTHER,
            offerId: anchor.id, businessId, role: "ANCHOR",
            offerPriceSnapshot: snapshotDecimal(anchor),
            draftPriceModeSnapshot: anchor.priceMode,
            note: anchorNote?.trim() || null,
            position: 0,
          },
        });
        if (savedAnchor && anchorNote !== undefined) {
          await tx.partyOrderItem.update({ where: { id: savedAnchor.id }, data: { note: anchorNote?.trim() || null } });
        }
        let position = Math.max(0, ...savedComponents.map(item => item.position)) + 1;
        const included = savedAnchor ? savedComponents.map(item => item.category) : includedCategories(anchor);
        const components = !savedAnchor && anchor.productType === "PARTY_PACKAGE"
          ? anchor.components.filter(component => !component.isOptional) : [];
        const componentCategories = new Set(components.map(component => component.category));
        const selectedCategories = new Set(addons.map(addon => addon.category));
        const requestedCategories = input.addonCategories ?? [];
        if (requestedCategories.some(category => selectedCategories.has(category) || included.includes(category))) {
          throw new PartyApiError(422, "Услуга этой категории уже выбрана");
        }
        const remainingItems: Prisma.PartyOrderItemCreateManyInput[] = [
          ...components.map(component => ({
            partyOrderId: partyId, category: component.category, businessId, parentItemId: anchorItem.id,
            packageComponentId: component.id,
            packageComponentSnapshot: {
              id: component.id, title: component.title, category: component.category,
              refOfferId: component.refOfferId, isOptional: component.isOptional,
              priceSnapshot: component.priceSnapshot?.toFixed(2) ?? null,
              priceDelta: component.priceDelta?.toFixed(2) ?? null,
              removalPolicy: component.removalPolicy,
              removalCreditByn: component.removalCreditByn?.toFixed(2) ?? null,
            },
            role: "INCLUDED" as const, position: position++,
          })),
          ...included.filter(category => !savedAnchor && !componentCategories.has(category)).map(category => ({
            partyOrderId: partyId, category, businessId, parentItemId: anchorItem.id,
            role: "INCLUDED" as const, position: position++,
          })),
          ...requestedCategories.map(category => ({
            partyOrderId: partyId, category, role: "ADDON" as const, position: position++,
          })),
          ...addons.map(addon => {
            const saved = savedAnchor ? savedAddons.get(addon.id) : undefined;
            return {
              partyOrderId: partyId, category: addon.category ?? PartyCategory.OTHER,
              offerId: addon.id, businessId: addon.place?.ownerBusinessId,
              role: "STANDALONE" as const,
              offerPriceSnapshot: saved ? saved.offerPriceSnapshot : snapshotDecimal(addon),
              draftPriceModeSnapshot: saved ? saved.draftPriceModeSnapshot : addon.priceMode,
              position: position++,
            };
          }),
        ];
        if (remainingItems.length > 0) await tx.partyOrderItem.createMany({ data: remainingItems });
      }
    }
    const updated = await tx.partyOrder.findUniqueOrThrow({
      where: { id: partyId },
      include: { items: { orderBy: { position: "asc" }, include: { offer: { select: draftOfferSelect } } } },
    });
    return withDraftEstimate(updated);
  });
}
