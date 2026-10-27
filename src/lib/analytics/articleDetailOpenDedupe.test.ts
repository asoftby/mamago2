/**
 * Continuous-reading article pages emit exactly ONE DETAIL_OPEN per article:
 * ContinuousArticleReader tracks `article_view` -> DETAIL_OPEN itself, so the
 * server page must not also render AnalyticsDetailBeacon in that branch.
 * Static source check (no DB, no browser).
 * Run: npx tsx src/lib/analytics/articleDetailOpenDedupe.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

const tracker = read("src/lib/article/continuousReadingAnalytics.ts");
assert.match(tracker, /kind === "article_view"[\s\S]{0,80}"DETAIL_OPEN"/, "article_view must stay the reader's DETAIL_OPEN source");

for (const page of ["src/app/(public)/blog/[slug]/page.tsx", "src/app/(public)/[city]/blog/[slug]/page.tsx"]) {
  const src = read(page);
  const at = src.indexOf("<ContinuousArticleReader");
  assert.ok(at > 0, `${page} renders the reader`);
  // The JSX fragment that contains the reader starts at the nearest preceding `return (`.
  const block = src.slice(src.lastIndexOf("return (", at), at);
  assert.ok(!block.includes("<AnalyticsDetailBeacon"), `${page}: no beacon next to ContinuousArticleReader (would double DETAIL_OPEN)`);
}

// Branches without the reader keep their single beacon.
assert.ok(read("src/app/(public)/blog/[slug]/page.tsx").includes("<AnalyticsDetailBeacon"), "standalone article view keeps the beacon");

console.log("articleDetailOpenDedupe.test.ts: OK");
