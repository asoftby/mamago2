/**
 * Pure-function tests for the review-queue pagination added on top of the
 * existing searchParams filter pattern (status/source/entity). Without
 * this, 44 of a 144-record ABWS import queue were silently invisible —
 * the page fetched a hard `take: 100` with no way to see beyond it.
 *
 * DB-touching parts of page.tsx (getImportedObjects/getQueueStats) aren't
 * covered here — no local DB in this environment, and this repo has no
 * existing test convention for this admin page. Covers the two pure
 * pieces most likely to have an off-by-one: page-number parsing and the
 * URL builder pagination links are constructed from.
 *
 * Запуск: npx tsx src/app/admin/import/review/page.pagination.test.ts
 */
import assert from "node:assert/strict";
import { parsePage, buildReviewHref, QUEUE_PAGE_SIZE } from "./page";

assert.equal(QUEUE_PAGE_SIZE, 50, "page size must match what was requested");

// ── parsePage ──────────────────────────────────────────────────────────────
assert.equal(parsePage(undefined), 1, "no page param defaults to page 1");
assert.equal(parsePage(""), 1, "empty string defaults to page 1");
assert.equal(parsePage("1"), 1);
assert.equal(parsePage("3"), 3);
assert.equal(parsePage("0"), 1, "page 0 is not valid, falls back to 1");
assert.equal(parsePage("-5"), 1, "negative page is not valid, falls back to 1");
assert.equal(parsePage("abc"), 1, "non-numeric input falls back to 1");
assert.equal(parsePage("2.7"), 2, "parseInt stops at the first non-digit — reads \"2\" from \"2.7\", already an integer");
assert.equal(parsePage("3abc"), 3, "parseInt's own leading-number behavior — matches Number.parseInt directly");

// ── buildReviewHref: page omitted from the URL on page 1 (matches the
// existing convention of omitting status="PENDING", the default) ──────────
assert.equal(buildReviewHref({}), "/admin/import/review");
assert.equal(buildReviewHref({ page: 1 }), "/admin/import/review", "page 1 must not appear in the URL");
assert.equal(buildReviewHref({ page: 2 }), "/admin/import/review?page=2");
assert.equal(
  buildReviewHref({ stage: "COMPLETED", sourceId: "src1", page: 3 }),
  "/admin/import/review?status=COMPLETED&source=src1&page=3",
  "page combines with existing filters in the established param order",
);
assert.equal(
  buildReviewHref({ stage: "ALL", page: 0 }),
  "/admin/import/review?status=ALL",
  "page<=1 (including an invalid 0) never appears in the URL",
);

console.log("review queue pagination tests: OK");
