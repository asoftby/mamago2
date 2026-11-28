import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  disabledFeatureForPagePath,
  isOfferSectionPublic,
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

test("DEV release scope exposes deferred features while PROD stays fail-closed", () => {
  const devEnv = { APP_ENV: "dev" };
  const prodEnv = { APP_ENV: "production" };
  for (const feature of ["classes", "birthday", "placesCatalog"] as const) {
    assert.equal(isPublicReleaseFeatureEnabled(feature, devEnv), true);
    assert.equal(isPublicReleaseFeatureEnabled(feature, prodEnv), false);
  }
  assert.equal(disabledFeatureForPagePath("/minsk/classes", devEnv), null);
  assert.equal(disabledFeatureForPagePath("/minsk/birthday", devEnv), null);
  assert.equal(disabledFeatureForPagePath("/minsk/classes", prodEnv), "classes");
  assert.equal(disabledFeatureForPagePath("/minsk/birthday", prodEnv), "birthday");
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

test("offer sections: programs and birthday follow their features, the rest stay public", () => {
  assert.equal(isOfferSectionPublic("programs", off), false);
  assert.equal(isOfferSectionPublic("birthday", off), false);
  for (const section of ["camps", "services", "events"]) assert.equal(isOfferSectionPublic(section, off), true);
  assert.equal(isOfferSectionPublic("programs", on), true);
  assert.equal(isOfferSectionPublic("birthday", on), true);
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
  assert.match(sitemap, /getReleaseScopedPublicOfferWhere\(\)/);
  assert.match(src("src/features/city-home/config/homeSectionAvailability.ts"), /isPublicReleaseFeatureEnabled\("classes", env\)/);
  assert.match(src("src/app/(public)/[city]/offers/[slug]/page.tsx"), /isReleaseScopedOfferPubliclyVisible\(offer\)/);
  assert.match(src("src/app/api/search/route.ts"), /getReleaseScopedPublicOfferWhere\(\)/);
});

test("public offer detail/search/sitemap consistently rely on productType visibility", () => {
  const source = (path: string) => readFileSync(path, "utf8");
  const page = source("src/app/(public)/[city]/offers/[slug]/page.tsx");
  const search = source("src/app/api/search/route.ts");
  const sitemap = source("src/app/sitemap.ts");
  assert.match(page, /isReleaseScopedOfferPubliclyVisible\(offer\)/);
  assert.doesNotMatch(page, /isOfferSectionPublic\(getOfferPublicSection\(offer\)\)/);
  assert.match(search, /getReleaseScopedPublicOfferWhere\(\)/);
  assert.doesNotMatch(search, /offers\.filter\(x => isOfferSectionPublic/);
  assert.match(sitemap, /getReleaseScopedPublicOfferWhere\(\)/);
  assert.doesNotMatch(sitemap, /isOfferSectionPublic\(getOfferPublicSection/);
});
