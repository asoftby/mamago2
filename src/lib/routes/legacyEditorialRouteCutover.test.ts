import assert from "node:assert/strict";
import {
  getLegacyEditorialRouteArticlePath,
  isLegacyEditorialRouteSlug,
  LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG,
  LEGACY_EDITORIAL_ROUTE_SLUGS,
} from "./legacyEditorialRouteCutover";
import {
  buildLegacyEditorialRouteArticleContent,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SLUG,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXPECTED_STOPS,
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE,
  LEGACY_NOVOGODNIY_ROUTE_MEDIA_IDS,
} from "./legacyEditorialRouteArticleMigration";

assert.equal(LEGACY_EDITORIAL_ROUTE_SLUGS.length, 13);
assert.equal(new Set(LEGACY_EDITORIAL_ROUTE_SLUGS).size, 13);
assert.equal(new Set(LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.map((item) => item.sourceRecordKey)).size, 13);
assert.equal(
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.reduce((sum, item) => sum + item.expectedStops, 0),
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXPECTED_STOPS,
);
assert.equal(
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.reduce((sum, item) => sum + item.expectedBlocks, 0),
  181,
);
assert.equal(LEGACY_NOVOGODNIY_ROUTE_MEDIA_IDS.length, 9);
assert.equal(new Set(LEGACY_NOVOGODNIY_ROUTE_MEDIA_IDS).size, 9);
assert.equal(
  LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_EXCLUDED_SLUG,
  LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG,
);
assert.equal(LEGACY_EDITORIAL_ROUTE_SLUGS.includes(LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG as never), false);

for (const slug of LEGACY_EDITORIAL_ROUTE_SLUGS) {
  assert.equal(isLegacyEditorialRouteSlug(slug), true);
  assert.equal(getLegacyEditorialRouteArticlePath(slug), `/minsk/blog/${slug}`);
}

const novogodniy = LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.find(
  (item) => item.slug === "novogodniy-marshrut",
);
assert.ok(novogodniy);
const novogodniyContent = buildLegacyEditorialRouteArticleContent(
  novogodniy.sourceRecordKey,
  Array.from({ length: 9 }, (_, index) => ({
    order: index + 1,
    customTitle: `Stop ${index + 1}`,
    note: `Note ${index + 1}`,
    mediaId: LEGACY_NOVOGODNIY_ROUTE_MEDIA_IDS[index],
  })),
);
assert.equal(novogodniyContent.blocks.length, 27);
assert.deepEqual(
  novogodniyContent.blocks.slice(0, 3).map((block) => block.type),
  ["heading", "text", "image"],
);

const ordinary = LEGACY_EDITORIAL_ROUTE_ARTICLE_MIGRATION_SCOPE.find(
  (item) => item.sourceRecordKey === "wordpress-db:routes:17822",
);
assert.ok(ordinary);
const ordinaryContent = buildLegacyEditorialRouteArticleContent(
  ordinary.sourceRecordKey,
  Array.from({ length: ordinary.expectedStops }, (_, index) => ({
    order: index + 1,
    customTitle: `Stop ${index + 1}`,
    note: `Note ${index + 1}`,
  })),
);
assert.equal(ordinaryContent.blocks.length, ordinary.expectedBlocks);
assert.equal(ordinaryContent.blocks.every((block) => block.type !== "image"), true);

assert.equal(isLegacyEditorialRouteSlug(LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG), false);
assert.equal(getLegacyEditorialRouteArticlePath(LEGACY_EDITORIAL_ROUTE_EXCLUDED_SLUG), null);
assert.equal(getLegacyEditorialRouteArticlePath("some-future-ugc-route"), null);

console.log("legacyEditorialRouteCutover.test.ts: PASS");
