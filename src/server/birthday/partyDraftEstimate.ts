import { Prisma, type PartyOrderStatus } from "@prisma/client";
import { offerPriceSnapshot, type CatalogOffer } from "./partySelection";

export function withDraftEstimate<T extends {
  status: PartyOrderStatus;
  items: { role: string; offerId: string | null; draftPriceModeSnapshot?: string | null; offerPriceSnapshot?: Prisma.Decimal | null; packageComponentChange?: Prisma.JsonValue; offer: Pick<CatalogOffer, "priceFrom" | "priceMode" | "currency"> | null }[];
}>(party: T) {
  if (party.status !== "DRAFT") return party;
  let exactByn = new Prisma.Decimal(0);
  let fromByn = new Prisma.Decimal(0);
  let unknownCount = 0;
  let credit = new Prisma.Decimal(0);
  let requiresPackageQuote = false;
  for (const item of party.items) {
    const change = item.packageComponentChange;
    if (!change || typeof change !== "object" || Array.isArray(change)) continue;
    if (change.requiresQuote === true) requiresPackageQuote = true;
    if (typeof change.creditByn === "string") credit = credit.plus(change.creditByn);
  }
  const lines = party.items.flatMap((item) => {
    if (item.role === "INCLUDED") return [];
    const frozen = item.draftPriceModeSnapshot;
    const livePrice = item.offer ? offerPriceSnapshot(item.offer) : null;
    let price = frozen ? item.offerPriceSnapshot ?? null : livePrice === null ? null : new Prisma.Decimal(livePrice);
    if (item.role === "ANCHOR" && price !== null) price = price.minus(credit);
    if (item.role === "ANCHOR" && requiresPackageQuote) price = null;
    const priceMode = frozen ?? item.offer?.priceMode;
    const mode = price === null ? "ON_REQUEST"
      : priceMode === "EXACT" || priceMode === "FREE" ? "EXACT" : "FROM";
    const amount = price?.toNumber() ?? null;
    if (mode === "EXACT") exactByn = exactByn.plus(price ?? 0);
    else if (mode === "FROM") fromByn = fromByn.plus(price ?? 0);
    else unknownCount++;
    return [{ offerId: item.offerId, mode, amount }];
  });
  return { ...party, estimate: { minimumByn: exactByn.plus(fromByn).toNumber(), exactByn: exactByn.toNumber(), fromByn: fromByn.toNumber(), unknownCount, lines } };
}
