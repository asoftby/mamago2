import { redactPartyContacts } from "./partyPrivacy";
import { Prisma } from "@prisma/client";
import { packageChangeScopeSchema, supportsPackageChanges, type PackageChangeScope } from "@/lib/birthday/packageChangeScope";
import { PartyApiError } from "./partyDraft.validation";

type Item = { note?: string | null; id: string; role: string; offerId: string | null; businessId: string | null;
  category: string; offerPriceSnapshot: Prisma.Decimal | null; draftPriceModeSnapshot: string | null;
  packageComponentSnapshot: Prisma.JsonValue; packageComponentChange: Prisma.JsonValue;
  offer: { title: string } | null };
function object(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}
function price(item: Item): PackageChangeScope["originalPrice"] {
  const known = item.draftPriceModeSnapshot && item.draftPriceModeSnapshot !== "ON_REQUEST" && item.offerPriceSnapshot !== null;
  return { mode: !known ? "ON_REQUEST" : ["EXACT", "FREE"].includes(item.draftPriceModeSnapshot!) ? "EXACT" : "FROM",
    amountByn: known ? item.offerPriceSnapshot!.toFixed(2) : null };
}
/** Immutable request brief from the CAS-claimed draft, never current catalogue prices. */
export function packageChangeScope(party: { id: string; version: number; venueMode: string; items: Item[] }): PackageChangeScope | null {
  if (!party.items.some(item => item.packageComponentChange !== null)) return null;
  const anchor = party.items.find(item => item.role === "ANCHOR");
  if (!supportsPackageChanges(party.venueMode) || !anchor?.offerId) throw new PartyApiError(422, "Состав пакета не поддерживает согласование");
  let credit = new Prisma.Decimal(0);
  let requiresQuote = false;
  const components = party.items.filter(item => item.role === "INCLUDED").map(item => {
    const saved = object(item.packageComponentSnapshot);
    const change = object(item.packageComponentChange);
    const snapshot = { ...saved, title: typeof saved?.title === "string" ? saved.title : item.category, category: item.category };
    if (change && saved?.removalPolicy === "REQUIRED") throw new PartyApiError(422, "Обязательный компонент нельзя убрать");
    const amount = new Prisma.Decimal(typeof change?.creditByn === "string" ? change.creditByn : "0");
    if (amount.lt(0) || !amount.isFinite()) throw new PartyApiError(422, "Некорректное уменьшение");
    credit = credit.plus(amount);
    if (change?.requiresQuote === true) requiresQuote = true;
    const replacementItemId = typeof change?.replacementItemId === "string" ? change.replacementItemId : null;
    if (replacementItemId && !party.items.some(row => row.id === replacementItemId && row.role === "STANDALONE")) {
      throw new PartyApiError(422, "Услуга для замены не найдена");
    }
    return { itemId: item.id, snapshot, action: !change ? "KEPT" : replacementItemId ? "REPLACED" : "REMOVED",
      creditByn: amount.toFixed(2), requiresQuote: change?.requiresQuote === true, replacementItemId };
  });
  const originalPrice = price(anchor);
  const net = originalPrice.amountByn === null ? null : new Prisma.Decimal(originalPrice.amountByn).minus(credit);
  if (net?.lt(0)) throw new PartyApiError(422, "Уменьшение превышает стоимость пакета");
  return packageChangeScopeSchema.parse({ kind: "PARTY_PACKAGE_CHANGE", orderId: party.id, draftVersion: party.version,
    comment: redactPartyContacts(anchor.note ?? null),
    packageId: anchor.offerId, packageTitle: anchor.offer?.title ?? "Пакет праздника", originalPrice,
    requestedPrice: requiresQuote ? { mode: "ON_REQUEST", amountByn: null } : { mode: originalPrice.mode, amountByn: net?.toFixed(2) ?? null },
    components, standalone: party.items.filter(item => ["ADDON", "STANDALONE"].includes(item.role)).map(item => ({
      itemId: item.id, offerId: item.offerId, businessId: item.businessId, title: item.offer?.title ?? item.category, price: price(item),
    })),
  });
}
