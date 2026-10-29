import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("classes listing preserves full ordered candidate IDs, bounded page hydration and page size", () => {
  const page = readFileSync("src/server/discovery/classesListingPage.ts", "utf8");
  assert.match(page, /const pageSize = 24/);
  assert.match(page, /orderedIds\.slice\(\(page - 1\) \* pageSize, page \* pageSize\)/);
  assert.match(page, /onlyIds: visibleIds/);
  assert.match(page, /new Map\(cards\.map/);
  assert.match(page, /revalidate: 60/);
  assert.match(page, /buildClassesDiscoveryWhere\(/);
  assert.doesNotMatch(page, /userId|familyId|selectedPersonaIds/);
});

test("classes query is not capped for the selected page and honors exactly selected IDs", () => {
  const feed = readFileSync("src/server/discovery/classesDiscoveryFeed.ts", "utf8");
  assert.match(feed, /onlyIds \? \{ AND: \[where, \{ id: \{ in: onlyIds \} \} \] \} : where/);
  assert.match(feed, /take: onlyIds \? onlyIds\.length/);
});
