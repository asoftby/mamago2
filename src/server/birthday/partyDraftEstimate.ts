import type { PartyOrderStatus } from "@prisma/client";
import { offerPriceSnapshot, type CatalogOffer } from "./partySelection";

export function withDraftEstimate<T extends {
  status: PartyOrderStatus;
  items: { role: string; offerId: string | null; offer: Pick<CatalogOffer, "priceFrom" | "priceMode" | "currency"> | null }[];
}>(party: T) {
  if (party.status !== "DRAFT") return party;
  let exactByn = 0;
  let fromByn = 0;
  let unknownCount = 0;
  const lines = party.items.flatMap((item) => {
    if (item.role === "INCLUDED") return [];
    const amount = item.offer ? offerPriceSnapshot(item.offer) : null;
    const mode = amount === null ? "ON_REQUEST"
      : item.offer?.priceMode === "EXACT" || item.offer?.priceMode === "FREE" ? "EXACT" : "FROM";
    if (mode === "EXACT") exactByn += amount ?? 0;
    else if (mode === "FROM") fromByn += amount ?? 0;
    else unknownCount++;
    return [{ offerId: item.offerId, mode, amount }];
  });
  return { ...party, estimate: { exactByn, fromByn, unknownCount, lines } };
}
