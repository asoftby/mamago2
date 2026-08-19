/**
 * Pure decision-rule tests for the PAGE_VIEW route observer.
 * Запуск: npx tsx src/lib/analytics/pageViewObserver.test.ts
 */
import assert from "node:assert/strict";
import { shouldEmitPageView } from "./pageViewObserver";

function main() {
  assert.equal(
    shouldEmitPageView(null, "/minsk/events"),
    true,
    "initial mount (no previous pathname) must emit",
  );
  assert.equal(
    shouldEmitPageView("/minsk/events", "/minsk/places"),
    true,
    "navigation to a different pathname must emit",
  );
  assert.equal(
    shouldEmitPageView("/minsk/events", "/minsk/events"),
    false,
    "re-render with the same pathname must not emit (no dup)",
  );

  // usePathname() never includes the query string, so a query-only change
  // is represented as the SAME pathname argument twice — already covered
  // by the same-pathname case above, which is the mechanism (not a special
  // case) that satisfies the "no dup on query-only change" rule.

  console.log("pageViewObserver.test.ts: OK");
}

main();
