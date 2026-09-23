import assert from "node:assert/strict";

import type { ArticleContentPayload } from "@/lib/publications/articleMvp";
import {
  legacyRouteArticleBlockId,
  planLegacyRouteArticleMediaBackfill,
} from "./legacyRouteArticleMediaBackfill";
import {
  LEGACY_ROUTE_ARTICLE_MEDIA_ATTACHMENT_COUNT,
  LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST,
} from "./legacyRouteArticleMediaManifest";

const sourceRecordKey = "wordpress-db:routes:17822";

function baseContent(): ArticleContentPayload {
  return {
    version: 1,
    blocks: [
      {
        id: legacyRouteArticleBlockId(sourceRecordKey, 1, "heading"),
        type: "heading",
        level: 2,
        text: "Stop 1",
      },
      {
        id: legacyRouteArticleBlockId(sourceRecordKey, 1, "text"),
        type: "text",
        text: "Text 1",
      },
      {
        id: legacyRouteArticleBlockId(sourceRecordKey, 1, "image"),
        type: "image",
        mediaId: "m1",
        alt: "Stop 1",
      },
      {
        id: legacyRouteArticleBlockId(sourceRecordKey, 2, "heading"),
        type: "heading",
        level: 2,
        text: "Stop 2",
      },
      {
        id: legacyRouteArticleBlockId(sourceRecordKey, 2, "text"),
        type: "text",
        text: "Text 2",
      },
    ],
  };
}

function testConvertsFirstImageToOrderedGalleryAndInsertsMissingSlot() {
  const result = planLegacyRouteArticleMediaBackfill({
    sourceRecordKey,
    currentContent: baseContent(),
    stops: [
      { order: 1, mediaIds: ["m1", "m2", "m3"] },
      { order: 2, mediaIds: ["m4", "m5"] },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.changed, true);
  assert.equal(result.desiredMediaCount, 5);
  assert.equal(result.existingLegacyMediaCount, 1);
  assert.equal(result.galleryCount, 2);
  assert.equal(result.replacedBlockCount, 1);
  assert.equal(result.insertedBlockCount, 1);

  const media = result.content.blocks.filter(
    (block) => block.type === "image" || block.type === "gallery",
  );
  assert.deepEqual(media, [
    {
      id: legacyRouteArticleBlockId(sourceRecordKey, 1, "image"),
      type: "gallery",
      mediaIds: ["m1", "m2", "m3"],
      presentation: "carousel",
    },
    {
      id: legacyRouteArticleBlockId(sourceRecordKey, 2, "image"),
      type: "gallery",
      mediaIds: ["m4", "m5"],
      presentation: "carousel",
    },
  ]);
}

function testIdempotent() {
  const first = planLegacyRouteArticleMediaBackfill({
    sourceRecordKey,
    currentContent: baseContent(),
    stops: [{ order: 1, mediaIds: ["m1", "m2"] }, { order: 2, mediaIds: [] }],
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const second = planLegacyRouteArticleMediaBackfill({
    sourceRecordKey,
    currentContent: first.content,
    stops: [{ order: 1, mediaIds: ["m1", "m2"] }, { order: 2, mediaIds: [] }],
  });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.changed, false);
}

function testFirstMediaMismatchRefuses() {
  const result = planLegacyRouteArticleMediaBackfill({
    sourceRecordKey,
    currentContent: baseContent(),
    stops: [{ order: 1, mediaIds: ["different", "m2"] }, { order: 2, mediaIds: [] }],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.startsWith("STOP_1_FIRST_MEDIA_MISMATCH")));
}

function testCustomMediaWithoutLegacySlotRefuses() {
  const content = baseContent();
  content.blocks.push({ id: "manual", type: "image", mediaId: "manual-media" });

  const result = planLegacyRouteArticleMediaBackfill({
    sourceRecordKey,
    currentContent: content,
    stops: [{ order: 1, mediaIds: ["m1"] }, { order: 2, mediaIds: ["m4"] }],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.includes("STOP_2_CUSTOM_MEDIA_PRESENT_WITHOUT_LEGACY_SLOT"));
}


function testMovedLegacyMediaRefuses() {
  const content = baseContent();
  const legacyImageId = legacyRouteArticleBlockId(sourceRecordKey, 1, "image");
  const imageIndex = content.blocks.findIndex((block) => block.id === legacyImageId);
  const [image] = content.blocks.splice(imageIndex, 1);
  content.blocks.push(image!);

  const result = planLegacyRouteArticleMediaBackfill({
    sourceRecordKey,
    currentContent: content,
    stops: [{ order: 1, mediaIds: ["m1", "m2"] }, { order: 2, mediaIds: [] }],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.includes("STOP_1_LEGACY_MEDIA_OUTSIDE_STOP_SEGMENT"));
}


function testFrozenManifestIntegrity() {
  assert.equal(LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.length, 13);
  assert.equal(LEGACY_ROUTE_ARTICLE_MEDIA_ATTACHMENT_COUNT, 577);
  assert.equal(
    LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.map((route) => String(route.sourceRecordKey)).includes(
      "wordpress-db:routes:46963",
    ),
    false,
  );

  const sourceKeys = LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.map((route) => route.sourceRecordKey);
  const slugs = LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.map((route) => route.slug);
  assert.equal(new Set(sourceKeys).size, sourceKeys.length);
  assert.equal(new Set(slugs).size, slugs.length);

  const actualCount = LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST.reduce(
    (routeSum, route) =>
      routeSum +
      route.stops.reduce((stopSum, stop) => {
        assert.ok(stop.order > 0);
        assert.equal(new Set(stop.attachmentIds).size, stop.attachmentIds.length);
        return stopSum + stop.attachmentIds.length;
      }, 0),
    0,
  );
  assert.equal(actualCount, LEGACY_ROUTE_ARTICLE_MEDIA_ATTACHMENT_COUNT);

  for (const route of LEGACY_ROUTE_ARTICLE_MEDIA_MANIFEST) {
    const orders = route.stops.map((stop) => stop.order);
    assert.equal(new Set(orders).size, orders.length);
  }
}

function main() {
  testFrozenManifestIntegrity();
  testConvertsFirstImageToOrderedGalleryAndInsertsMissingSlot();
  testIdempotent();
  testFirstMediaMismatchRefuses();
  testCustomMediaWithoutLegacySlotRefuses();
  testMovedLegacyMediaRefuses();
}

main();
console.log("legacyRouteArticleMediaBackfill tests: OK");
