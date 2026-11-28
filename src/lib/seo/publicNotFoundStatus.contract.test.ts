import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

// AUDIT-XR-15: a segment-level loading.tsx wraps every nested page in Suspense,
// so the 200 shell is streamed before a page can call notFound(). Missing
// places, events, articles and arbitrary paths then answered HTTP 200 with
// only a noindex meta tag, including for search-engine bots. Detail and
// catch-all segments must not declare a loading boundary; put skeletons in an
// inner <Suspense> after the existence check instead.
test("public layout and city segments have no streaming loading boundary", () => {
  for (const path of [
    "src/app/(public)/loading.tsx",
    "src/app/(public)/[city]/loading.tsx",
    "src/app/(public)/[city]/places/[slug]/loading.tsx",
    "src/app/(public)/[city]/events/[slugOrId]/loading.tsx",
    "src/app/(public)/places/[slug]/loading.tsx",
  ]) {
    assert.equal(existsSync(path), false, `${path} would turn notFound() into a soft 200`);
  }
});
