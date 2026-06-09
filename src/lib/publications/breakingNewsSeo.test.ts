/**
 * Run: pnpm exec tsx src/lib/publications/breakingNewsSeo.test.ts
 */
import assert from "node:assert/strict";
import { buildBreakingNewsCanonicalUrl } from "./breakingNewsSeo";

assert.equal(
  buildBreakingNewsCanonicalUrl("srochnaya-novost", "https://mamago.by"),
  "https://mamago.by/blog/srochnaya-novost",
);

assert.equal(
  buildBreakingNewsCanonicalUrl("srochnaya-novost", "https://mamago.by/"),
  "https://mamago.by/blog/srochnaya-novost",
);

assert.equal(buildBreakingNewsCanonicalUrl("", "https://mamago.by"), "");

console.log("✅ breakingNewsSeo.test.ts — all assertions passed");
