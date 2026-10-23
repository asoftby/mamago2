import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getPublicBirthdayOfferWhere } from "@/server/birthday/birthdayOfferVisibility";
import { projectBirthdayOfferCard } from "./birthdayDiscoveryFeed";

const where = getPublicBirthdayOfferWhere("city-minsk");
const parts = where.AND;
assert.ok(Array.isArray(parts), "birthday query requires all publication checks");
assert.deepEqual(parts[1], { place: { cityId: "city-minsk", ownerBusiness: { isNot: null } } });
assert.deepEqual(parts[2], {
  OR: [{ productType: "PARTY_PACKAGE" }, { productType: "PARTY_SERVICE", category: { not: null } }],
});
assert.deepEqual(parts[3], { placements: { some: { key: "BIRTHDAY", status: "APPROVED" } } });
assert.match(JSON.stringify(parts[0]), /PUBLISHED/);
assert.doesNotMatch(JSON.stringify(parts[2]), /ONE_TIME_ACTIVITY|REGULAR_ACTIVITY|EVENT/);

const common = {
  id: "party-1", slug: "party-1", title: "Аниматор на праздник", description: null,
  coverImage: "https://example.test/image.jpg", ageMinMonths: 36, ageMaxMonths: 120,
  agePolicy: "SPECIFIC" as const,
  priceMode: "FROM" as const, priceFrom: 50, priceTo: null, currency: "BYN",
};
const service = projectBirthdayOfferCard({ ...common, productType: "PARTY_SERVICE", category: "ANIMATOR" }, "minsk");
assert.equal(service.analyticsEntityType, "OFFER");
assert.equal(service.discoveryIntent, "birthday");
assert.equal(service.type, "BIRTHDAY_BOOKING");
assert.equal(service.href, "/minsk/offers/party-1");
assert.equal(service.badge, "Аниматор");
assert.equal(service.ageFrom, 3);
assert.equal(service.ageTo, 10);
const bundle = projectBirthdayOfferCard({ ...common, productType: "PARTY_PACKAGE", category: null }, "minsk");
assert.equal(bundle.badge, "Праздник под ключ");

// The birthday page must never call the event feed, even when no offers exist.
const shell = readFileSync("src/components/city/CityShell.tsx", "utf8");
assert.match(shell, /if \(intent === "birthday"\) \{[\s\S]*?getBirthdayDiscoveryFeed\(city\.id, city\.slug\)/);
assert.match(shell, /if \(intent === "kuda"\) \{/);
assert.doesNotMatch(shell, /if \(intent === "kuda" \|\| intent === "birthday"\)/);
const sticky = readFileSync("src/features/birthday/builder/components/BirthdayBuilderStickyBar.tsx", "utf8");
assert.equal(sticky.match(/budgetGroup && budgetGroup !== "unknown" \? <BelarusianRubleIcon size="sm" \/>/g)?.length, 2);
console.log("birthdayDiscoveryFeed.contract.test.ts: OK");
