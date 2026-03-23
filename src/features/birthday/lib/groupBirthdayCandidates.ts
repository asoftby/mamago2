import type { BirthdayOffer, BirthdayCandidateGroup } from "../types/birthday";
import { rankBirthdayOffers } from "./rankBirthdayOffers";

const CORE_CATEGORIES = new Set(["PACKAGE", "VENUE"]);
const ENTERTAINMENT_CATEGORIES = new Set(["ANIMATOR", "SHOW", "MASTER_CLASS"]);
const EXTRAS_CATEGORIES = new Set(["CAKE", "DECOR", "PHOTO", "FOOD", "ADDON"]);

export function groupBirthdayCandidates(offers: BirthdayOffer[]): BirthdayCandidateGroup[] {
  const ranked = rankBirthdayOffers(offers);

  const core = ranked.filter((o) => CORE_CATEGORIES.has(o.category)).slice(0, 3);
  const entertainment = ranked.filter((o) => ENTERTAINMENT_CATEGORIES.has(o.category)).slice(0, 3);
  const extras = ranked.filter((o) => EXTRAS_CATEGORIES.has(o.category)).slice(0, 3);

  const groups: BirthdayCandidateGroup[] = [];
  if (core.length > 0) groups.push({ label: "Основа праздника", layer: "BASE", offers: core });
  if (entertainment.length > 0) groups.push({ label: "Развлечения", layer: "ENTERTAINMENT", offers: entertainment });
  if (extras.length > 0) groups.push({ label: "Торт и декор", layer: "EXTRA", offers: extras });

  return groups;
}

export function getCoreCandidates(offers: BirthdayOffer[]): BirthdayOffer[] {
  return rankBirthdayOffers(offers.filter((o) => CORE_CATEGORIES.has(o.category))).slice(0, 3);
}

export function getAddonCandidates(offers: BirthdayOffer[]): BirthdayOffer[] {
  return rankBirthdayOffers(
    offers.filter((o) => ENTERTAINMENT_CATEGORIES.has(o.category) || EXTRAS_CATEGORIES.has(o.category))
  ).slice(0, 4);
}
