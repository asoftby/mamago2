import type { BirthdayCatalogItem, PartyCategoryKey } from "@/features/birthday/builder/lib/realCatalog";

const MAX_HOME_BIRTHDAY_CARDS = 12;

/** Diverse compact preview: packages first, then different service categories. */
export function selectHomeBirthdayOffers(items: readonly BirthdayCatalogItem[]): BirthdayCatalogItem[] {
  const chosen: BirthdayCatalogItem[] = [];
  const seen = new Set<string>();
  for (const offer of items) {
    if (offer.productType !== "PARTY_PACKAGE" || chosen.length >= 2) continue;
    chosen.push(offer);
    seen.add(offer.id);
  }
  const serviceCategories = new Set<PartyCategoryKey>();
  for (const offer of items) {
    if (chosen.length >= MAX_HOME_BIRTHDAY_CARDS) break;
    if (offer.productType !== "PARTY_SERVICE" || !offer.category || serviceCategories.has(offer.category)) continue;
    chosen.push(offer);
    seen.add(offer.id);
    serviceCategories.add(offer.category);
  }
  // If a city only has one kind of service, still fill the row with its offers.
  for (const offer of items) {
    if (chosen.length >= MAX_HOME_BIRTHDAY_CARDS) break;
    if (seen.has(offer.id)) continue;
    chosen.push(offer);
    seen.add(offer.id);
  }
  return chosen;
}
