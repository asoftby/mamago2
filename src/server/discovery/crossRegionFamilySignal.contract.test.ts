import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20261027120000_boost_regions_family_home_city/migration.sql", "utf8");
const signal = readFileSync("src/server/discovery/crossRegionFamilySignal.ts", "utf8");
const feed = readFileSync("src/server/discovery/kudaDiscoveryFeed.ts", "utf8");
const classes = readFileSync("src/server/discovery/classesDiscoveryFeed.ts", "utf8");
const purchase = readFileSync("src/server/services/billing/boostPurchase.service.ts", "utf8");
const action = readFileSync("src/app/business/(protected)/offers/[id]/boost/actions.ts", "utf8");
const form = readFileSync("src/app/business/(protected)/offers/[id]/boost/BoostPurchaseClient.tsx", "utf8");

assert.match(schema, /targetRegionIds\s+String\[\]/);
assert.match(schema, /homeCityId\s+String\?/);
assert.match(migration, /ADD COLUMN "targetRegionIds"/);
assert.match(migration, /ADD COLUMN "homeCityId"/);
assert.match(signal, /getCrossRegionFamilyThreshold/);
assert.ok(signal.includes('HAVING COUNT(DISTINCT pi."familyId") >= ${threshold}'));
assert.match(signal, /COUNT\(DISTINCT pi\."familyId"\)/);
assert.match(signal, /f\."homeCityId" IN/);
assert.match(signal, /pi\.status = 'CONFIRMED'/);
assert.match(signal, /pi\."cancelledAt" IS NULL/);
assert.match(feed, /readCrossRegionEligibility/);
assert.match(feed, /activityInAnyOfCitiesWhere\(expandedCityIds\)/);
assert.match(classes, /purchaseRequestKey: \{ not: null \}/);
assert.match(classes, /targetRegionIds: \{ has: targetRegionId \}/);
assert.match(classes, /targetRegionIds: \{ has: ALL_BELARUS_REGIONS \}/);
assert.match(purchase, /validateBoostTargetRegions/);
assert.match(purchase, /targetRegionIds,/);
assert.match(action, /targetRegionIds: z\.array/);
assert.match(form, /Вся Беларусь/);

const editor = readFileSync("src/app/(content-editor)/editor/event/[id]/edit/page.tsx", "utf8");
const overrideApi = readFileSync("src/app/api/admin/discovery/cross-region-overrides/route.ts", "utf8");
assert.doesNotMatch(editor, /EventCrossRegionOverrides/, "editorial geo controls must not render in the event wizard");
assert.match(overrideApi, /requireAdminOrModeratorApiUser/, "protected editorial override API remains available");
assert.match(signal, /crossRegionEditorialOverride\.findMany/, "cross-region overrides remain active in discovery");

console.log("cross-region Boost and 50-family signal contract tests: OK");
