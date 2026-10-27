import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("Kuda candidate selection is driven by explicit filters, not current user", () => {
  const feed = source("./kudaDiscoveryFeed.ts");
  const whereBuilder = feed.slice(
    feed.indexOf("export async function buildKudaDiscoveryWhere("),
    feed.indexOf("export async function getKudaDiscoveryFeed("),
  );
  assert.ok(whereBuilder.includes("buildEventRuntimeWhere(options.eventFilters)"));
  assert.ok(whereBuilder.includes("getPublicListingActivityWhere(now)"));
  assert.doesNotMatch(whereBuilder, /currentUserId|selectedPersonaIds|familyId|profileInterest/);
  const candidateQuery = feed.slice(
    feed.indexOf("const { where, primaryCityId } = await buildKudaDiscoveryWhere("),
    feed.indexOf('perf.mark("candidates")'),
  );
  assert.ok(candidateQuery.includes("prisma.activity.findMany({"));
  assert.match(candidateQuery, /\bwhere\s*,/);
  assert.doesNotMatch(candidateQuery, /currentUserId|selectedPersonaIds|familyId/);
});

test("literal public search precedes keyboard-layout fallback, independent of user identity", () => {
  const route = source("../../app/api/search/route.ts");
  const docs = route.slice(route.indexOf("const findDocs ="), route.indexOf("const activityIds ="));
  assert.match(docs, /findDocs\(q, limit\)/);
  assert.match(docs, /findDocs\(alternate, limit\)/);
  assert.doesNotMatch(docs, /user\.id|familyId|selectedPersonaIds|ageFrom.*child/);
});
