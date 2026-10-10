/**
 * Responsive contract for public discovery cards and Place detail.
 *
 * Protects the mobile UX fixes from the 2026-09 responsive audit:
 * - 320px discovery uses one readable column; 2 columns start at 360px;
 * - public card save actions expose 44px touch targets on mobile;
 * - Offer promo and save action never occupy the same corner;
 * - Place detail uses one 16/24/28px responsive gutter contract;
 * - Place headings/body copy remain readable and review actions are tappable.
 *
 * Run: pnpm test:responsive-public-detail
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatVenueAddressForPublicDisplay } from "@/lib/event/formatVenueAddressForDisplay";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const discovery = read("src/components/discovery/DiscoveryActivitiesGrid.tsx");
const eventCard = read("src/components/events/EventCard.tsx");
const offerCard = read("src/components/offers/OfferCard.tsx");
const activityCard = read("src/components/activity/ActivityCard.tsx");
const homeRows = read("src/features/city-home/components/CityHomeContentRows.tsx");
const placeHero = read("src/components/place/marketplace/PlaceHero.tsx");
const placePage = read("src/components/place/marketplace/MarketplacePlacePage.tsx");
const placeAbout = read("src/components/place/marketplace/PlaceAboutSection.tsx");
const placeOffers = read("src/components/place/marketplace/PlaceOffersSection.tsx");
const placeEvents = read("src/components/place/marketplace/PlaceEventsSection.tsx");
const placeReviews = read("src/components/place/marketplace/PlaceReviewsSection.tsx");
const placeStickyActionBar = read("src/components/place/marketplace/PlaceStickyActionBar.tsx");
const locationBlock = read("src/components/shared/LocationBlock.tsx");
const eventRichDescription = read("src/components/event-page/EventRichDescription.tsx");

const discoveryGridContract =
  /grid grid-cols-1 gap-5 min-\[360px\]:grid-cols-2 lg:grid-cols-4/g;
assert.ok(
  (discovery.match(discoveryGridContract) ?? []).length >= 2,
  "Primary and secondary discovery grids must stay one-column below 360px",
);

for (const [name, source] of [
  ["EventCard", eventCard],
  ["OfferCard", offerCard],
  ["ActivityCard", activityCard],
  ["CityHome article card", homeRows],
] as const) {
  assert.match(
    source,
    /h-11 w-11[^"]*sm:h-8 sm:w-8/,
    `${name} save action must expose a 44px mobile touch target`,
  );
  assert.match(
    source,
    /h-5 w-5 sm:h-4 sm:w-4/,
    `${name} save icon should scale with the mobile touch target`,
  );
}

assert.match(
  offerCard,
  /absolute left-3 top-3[^"]*max-w-\[calc\(100%-4\.5rem\)\]/,
  "Offer promo must stay in the left corner and reserve room for the save action",
);
assert.doesNotMatch(
  offerCard,
  /promoBadge[\s\S]{0,500}absolute right-3 top-3/,
  "Offer promo must not return to the same top-right corner as the save action",
);

assert.match(
  placeHero,
  /breadcrumbs mx-auto w-full max-w-\[1200px\] px-4[^"]*sm:px-6 lg:px-7/,
  "Place breadcrumbs must use the shared responsive mobile gutter",
);
assert.match(
  placeHero,
  /hero-grid mx-auto w-full max-w-\[1200px\] px-4 sm:px-6 lg:px-7/,
  "Place hero must use the shared responsive mobile gutter",
);
assert.match(
  placeHero,
  /text-\[34px\] sm:text-\[40px\]/,
  "Place title must shrink on narrow mobile screens",
);
assert.match(
  placeHero,
  /text-\[17px\] sm:text-\[19px\]/,
  "Place lead copy must shrink on narrow mobile screens",
);

for (const [name, source] of [
  ["MarketplacePlacePage", placePage],
  ["PlaceAboutSection", placeAbout],
  ["PlaceOffersSection", placeOffers],
  ["PlaceEventsSection", placeEvents],
  ["PlaceReviewsSection", placeReviews],
] as const) {
  assert.match(
    source,
    /px-4 sm:px-6 lg:px-7/,
    `${name} must use the shared 16/24/28px responsive gutter`,
  );
  assert.doesNotMatch(
    source,
    /padding:\s*["']0 28px["']/,
    `${name} must not hardcode a 28px gutter for mobile`,
  );
  assert.doesNotMatch(
    source,
    /padding:\s*0 22px/,
    `${name} must not force a separate 22px mobile gutter`,
  );
  assert.doesNotMatch(
    source,
    /padding:\s*0 18px/,
    `${name} must not force a separate 18px mobile gutter`,
  );
}

assert.match(
  placeAbout,
  /text-\[17px\][^"]*sm:text-\[19px\]/,
  "Place About body copy must stay readable on mobile",
);
assert.match(
  placeReviews,
  /text-\[26px\] leading-tight sm:text-\[30px\]/,
  "Place Reviews heading must be responsive instead of fixed/nowrap",
);
assert.match(
  placeReviews,
  /inline-flex min-h-11 items-center rounded-lg px-2/,
  "Place Reviews 'read all' action must expose a 44px touch target",
);
assert.doesNotMatch(
  placeOffers,
  /Все предложения/,
  "Place Offers section no longer renders the 'all offers' link",
);

assert.match(
  placeStickyActionBar,
  /hasThreeActions && "hidden sm:block"/,
  "Place sticky bar must hide secondary detail copy on phones when all three actions are present",
);
assert.match(
  placeStickyActionBar,
  /hasThreeActions \? "w-\[46px\] px-0 sm:w-auto sm:px-5" : "px-5"/,
  "Place sticky call action must become a 46px icon target in the three-action mobile layout",
);
assert.match(
  placeStickyActionBar,
  /hasThreeActions && "sr-only sm:not-sr-only"/,
  "Place sticky call label must remain accessible while visually compact on phones",
);

assert.match(
  locationBlock,
  /mt-auto hidden flex-wrap gap-3 md:flex/,
  "Location actions must stay in the desktop text column",
);
assert.match(
  locationBlock,
  /flex flex-wrap gap-3 md:hidden/,
  "Location actions must render below the map on mobile",
);

assert.equal(
  formatVenueAddressForPublicDisplay("просп. Машерова 15, Минск, Минская область"),
  "Минск, пр-т Машерова, 15",
  "Public venue address must use city-first compact formatting",
);

assert.match(
  eventRichDescription,
  /\[&_ul\]:my-5 \[&_ul\]:list-disc/,
  "Event rich text must style lists without relying on the optional typography plugin",
);
assert.doesNotMatch(
  eventRichDescription,
  /prose-ul:list-disc/,
  "Event rich text must not rely on @tailwindcss/typography for list markers",
);

console.log("publicDetailMobileContract.test.ts: OK");
