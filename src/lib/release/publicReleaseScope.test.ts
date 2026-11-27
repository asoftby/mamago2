import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  disabledFeatureForPagePath,
  isOfferPublicInRelease,
  offerReleaseFeature,
  isPublicReleaseFeatureEnabled,
} from "./publicReleaseScope";

const off = {};
const on = { ENABLE_PUBLIC_CLASSES: "true", ENABLE_PUBLIC_BIRTHDAY: "true", ENABLE_PUBLIC_PLACES_CATALOG: "true" };

test("excluded features are off unless explicitly enabled", () => {
  for (const feature of ["classes", "birthday", "placesCatalog"] as const) {
    assert.equal(isPublicReleaseFeatureEnabled(feature, off), false);
    assert.equal(isPublicReleaseFeatureEnabled(feature, { ENABLE_PUBLIC_CLASSES: "1", ENABLE_PUBLIC_BIRTHDAY: "yes" }), false);
    assert.equal(isPublicReleaseFeatureEnabled(feature, on), true);
  }
});

test("gated page paths answer 404 while their feature is off", () => {
  for (const [path, feature] of [
    ["/minsk/classes", "classes"],
    ["/minsk/classes/dance", "classes"],
    ["/grodno/programs", "classes"],
    ["/minsk/programs/some-program", "classes"],
    ["/minsk/birthday", "birthday"],
    ["/minsk/birthday/make", "birthday"],
    ["/me/birthdays", "birthday"],
    ["/me/birthdays/abc", "birthday"],
  ] as const) {
    assert.equal(disabledFeatureForPagePath(path, off), feature, path);
    assert.equal(disabledFeatureForPagePath(path, on), null, path);
  }
});

test("allowed scenarios are never gated", () => {
  for (const path of [
    "/", "/minsk", "/minsk/events/some-event", "/minsk/places/some-place", "/places/legacy-id",
    "/minsk/blog/article", "/blog/classes", "/minsk/kuda", "/minsk/where-to-go", "/minsk/search",
    "/minsk/offers/some-offer", "/me", "/me/plan", "/me/bookings", "/business/dashboard",
    "/admin", "/offers/classes", "/search/birthday",
  ]) {
    assert.equal(disabledFeatureForPagePath(path, off), null, path);
  }
});

test("offers are classified by product type; camps, visits and legacy services stay public", () => {
  for (const productType of ["ONE_TIME_ACTIVITY", "REGULAR_ACTIVITY"]) {
    assert.equal(offerReleaseFeature({ productType }), "classes");
    assert.equal(isOfferPublicInRelease({ productType }, off), false);
    assert.equal(isOfferPublicInRelease({ productType }, on), true);
  }
  for (const productType of ["PARTY_SERVICE", "PARTY_PACKAGE"]) {
    assert.equal(offerReleaseFeature({ productType }), "birthday");
    assert.equal(isOfferPublicInRelease({ productType }, off), false);
  }
  for (const offer of [{ productType: "CAMP" }, { productType: "PLACE_VISIT" }, { productType: null },
    {}, { productType: "REGULAR_ACTIVITY", campProgramType: "CITY" }]) {
    assert.equal(isOfferPublicInRelease(offer, off), true, JSON.stringify(offer));
  }
});

test("gate is wired into proxy, public APIs, sitemap, home and offer page", () => {
  const src = (p: string) => readFileSync(p, "utf8");
  assert.match(src("src/proxy.ts"), /disabledFeatureForPagePath\(pathname\)[\s\S]*status: 404/);
  for (const [path, feature] of [
    ["src/app/api/public/birthday/catalog/route.ts", "birthday"],
    ["src/app/api/public/birthday/availability/route.ts", "birthday"],
    ["src/app/api/public/party-availability/route.ts", "birthday"],
    ["src/app/api/public/discovery/class-chips/route.ts", "classes"],
    ["src/app/api/public/offers/[id]/reserve/route.ts", "classes"],
    ["src/app/api/public/offers/[id]/slots/route.ts", "classes"],
  ] as const) {
    assert.match(src(path), new RegExp(`releaseScopeApiGuard\\("${feature}"\\)`), path);
  }
  const sitemap = src("src/app/sitemap.ts");
  assert.match(sitemap, /if \(classesPublic\)/);
  assert.match(sitemap, /if \(placesCatalogPublic\) try/);
  assert.match(sitemap, /isOfferPublicInRelease\(offer\)/);
  assert.match(src("src/features/city-home/config/homeSectionAvailability.ts"), /isPublicReleaseFeatureEnabled\("classes", env\)/);
  assert.match(src("src/app/(public)/[city]/offers/[slug]/page.tsx"), /isOfferPublicInRelease\(offer\)\) notFound\(\)/);
  assert.match(src("src/app/api/search/route.ts"), /offers\.filter\(x => isOfferPublicInRelease\(x\)\)/);
  assert.match(src("src/app/api/public/bookings/route.ts"), /!isOfferPublicInRelease\(offer\)[\s\S]*status: 404[\s\S]*createPublicBooking\(/);
  assert.match(src("src/app/api/public/offers/[id]/price-quote/route.ts"), /!isOfferPublicInRelease\(offer\)/);
});
