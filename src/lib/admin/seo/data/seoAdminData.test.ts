import assert from "node:assert/strict";
import {
  buildRedirectCenterData,
  type RedirectCenterQuery,
} from "./seoAdminData";
import type {
  ClassifiedRedirectEntry,
  RedirectManifestClassification,
} from "@/lib/seo/redirectManifestClassifier";

const dispositions = [
  "EXACT_REDIRECT",
  "VALID_HUB_REMAP",
  "P1_START_OR_CONTAINS",
  "INVALID_TARGET",
] as const;

const entries: ClassifiedRedirectEntry[] = Array.from({ length: 53 }, (_, index) => ({
  source: `/legacy/source-${index}`,
  destination: index === 40 ? "/minsk/blog/destination-needle" : `/minsk/blog/target-${index}`,
  type: "article",
  clicks: index,
  permanent: true,
  disposition: dispositions[index % dispositions.length],
  resolvedTable: index % 4 === 3 ? "Article" : "City",
  resolvedStatus: index % 4 === 0 ? "PUBLISHED" : null,
  reason: null,
}));

const counts = {
  EXACT_REDIRECT: 14,
  VALID_HUB_REMAP: 13,
  P1_START_OR_CONTAINS: 13,
  INVALID_TARGET: 13,
  COLLISION: 0,
  CHAIN: 0,
  LOOP: 0,
};

const classification: RedirectManifestClassification = {
  total: entries.length,
  entries,
  counts,
  formatErrors: [],
  duplicates: [],
  chains: [],
  brokenTargets: [],
  unpublished: [],
  brokenByTable: {},
  rootRouteCollisions: [],
};

function load(query: RedirectCenterQuery = {}) {
  return buildRedirectCenterData(classification, query);
}

assert.equal(load().summary.systemTotal, 53);
assert.equal(load().automatic.length, 25);
assert.equal(load({ page: 3 }).automatic.length, 3);
assert.equal(load({ page: 999 }).automaticPagination.page, 3);
assert.equal(load({ page: 999 }).automatic[0]?.fromUrl, "/legacy/source-50");
assert.equal(load({ search: "source-17" }).automatic[0]?.fromUrl, "/legacy/source-17");
assert.equal(load({ search: "destination-needle" }).automatic[0]?.fromUrl, "/legacy/source-40");
assert.ok(load({ filter: "INVALID_TARGET" }).automatic.every((row) => row.disposition === "INVALID_TARGET"));
assert.doesNotThrow(() => load({ filter: "ALL" }));
assert.ok(load().automatic.every((row) => row.source === "wp-redirect-map.json"));
assert.ok(load().automatic.every((row) => row.ruleType === "legacy_migration"));
assert.equal(load().manual.length, 0);
assert.equal(load().summary.manualCount, 0);
assert.ok(load().automatic.every((row) => !("edit" in row) && !("delete" in row)));

console.log("seoAdminData tests: PASS");
