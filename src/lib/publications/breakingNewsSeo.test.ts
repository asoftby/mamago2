/**
 * Run: pnpm exec tsx src/lib/publications/breakingNewsSeo.test.ts
 */
import assert from "node:assert/strict";
import {
  buildBreakingNewsCanonicalUrl,
  generateBreakingNewsSeoDescription,
  generateBreakingNewsSeoTitle,
  SEO_DESC_LIMIT,
} from "./breakingNewsSeo";

assert.equal(
  generateBreakingNewsSeoTitle("Самая безопасная игровая в Минске"),
  "Самая безопасная игровая в Минске",
  "SEO title uses headline without site suffix",
);

assert.equal(
  generateBreakingNewsSeoTitle("1"),
  "1",
  "SEO title uses short headline as-is",
);

const longBody = "А".repeat(200);
assert.equal(
  generateBreakingNewsSeoDescription(`<p>${longBody}</p>`).length,
  SEO_DESC_LIMIT,
  "SEO description is capped at 160 chars",
);
assert.ok(
  !generateBreakingNewsSeoDescription(`<p>${longBody}</p>`).includes("mamaGo"),
  "SEO description has no CTA suffix",
);

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
