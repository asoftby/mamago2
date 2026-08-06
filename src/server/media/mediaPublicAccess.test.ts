/**
 * Run: tsx src/server/media/mediaPublicAccess.test.ts (assert-based, project convention).
 *
 * `canLoadMediaAnonymously()`/`hasPublishedPublicLinkage()` read straight
 * from the real `prisma` singleton (no injectable client, unlike the
 * migration runtime modules) — this suite temporarily monkey-patches the
 * exact delegate methods each scenario touches, restoring every one of them
 * after each test, and never lets a real query reach the database. No DB
 * writes, no DB reads — every Prisma call in-scope is a fake for the
 * duration of a single test.
 */
import assert from "node:assert/strict";
import { ContentStatus, MediaAssetStatus, MediaEntityType, type MediaAsset } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canLoadMediaAnonymously } from "./mediaPublicAccess";

/** Snapshot every delegate method this module's read path can call, stub them to safe "nothing found" defaults, and return a restorer. */
function stubPrismaDefaults(): () => void {
  const originals = {
    articleFindFirst: prisma.article.findFirst,
    articleCount: prisma.article.count,
    placeFindFirst: prisma.place.findFirst,
    placeCount: prisma.place.count,
    placeImageFindFirst: prisma.placeImage.findFirst,
    activityFindFirst: prisma.activity.findFirst,
    activityCount: prisma.activity.count,
    mediaUsageFindMany: prisma.mediaUsage.findMany,
    offerCount: prisma.offer.count,
    routeCount: prisma.route.count,
    businessCount: prisma.business.count,
    brandingConfigFindFirst: prisma.brandingConfig.findFirst,
  };

  prisma.article.findFirst = (async () => null) as unknown as typeof prisma.article.findFirst;
  prisma.article.count = (async () => 0) as unknown as typeof prisma.article.count;
  prisma.place.findFirst = (async () => null) as unknown as typeof prisma.place.findFirst;
  prisma.place.count = (async () => 0) as unknown as typeof prisma.place.count;
  prisma.placeImage.findFirst = (async () => null) as unknown as typeof prisma.placeImage.findFirst;
  prisma.activity.findFirst = (async () => null) as unknown as typeof prisma.activity.findFirst;
  prisma.activity.count = (async () => 0) as unknown as typeof prisma.activity.count;
  prisma.mediaUsage.findMany = (async () => []) as unknown as typeof prisma.mediaUsage.findMany;
  prisma.offer.count = (async () => 0) as unknown as typeof prisma.offer.count;
  prisma.route.count = (async () => 0) as unknown as typeof prisma.route.count;
  prisma.business.count = (async () => 0) as unknown as typeof prisma.business.count;
  prisma.brandingConfig.findFirst = (async () => null) as unknown as typeof prisma.brandingConfig.findFirst;

  return () => {
    prisma.article.findFirst = originals.articleFindFirst;
    prisma.article.count = originals.articleCount;
    prisma.place.findFirst = originals.placeFindFirst;
    prisma.place.count = originals.placeCount;
    prisma.placeImage.findFirst = originals.placeImageFindFirst;
    prisma.activity.findFirst = originals.activityFindFirst;
    prisma.activity.count = originals.activityCount;
    prisma.mediaUsage.findMany = originals.mediaUsageFindMany;
    prisma.offer.count = originals.offerCount;
    prisma.route.count = originals.routeCount;
    prisma.business.count = originals.businessCount;
    prisma.brandingConfig.findFirst = originals.brandingConfigFindFirst;
  };
}

function activeMedia(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "media-1",
    status: MediaAssetStatus.ACTIVE,
    deletedAt: null,
    publicUrl: "/api/media/file/example.webp",
    storageKey: "/api/media/file/example.webp",
    ...overrides,
  } as unknown as MediaAsset;
}

function stubInlineArticleUsage(articleStatus: ContentStatus | null) {
  prisma.mediaUsage.findMany = (async () => [
    { entityType: MediaEntityType.ARTICLE, entityId: "article-1" },
  ]) as unknown as typeof prisma.mediaUsage.findMany;
  prisma.article.count = (async (args: { where: { id: { in: string[] }; status: { in: ContentStatus[] } } }) => {
    if (articleStatus === null) return 0;
    return args.where.status.in.includes(articleStatus) ? 1 : 0;
  }) as unknown as typeof prisma.article.count;
}

async function testPublishedArticleInlineUsageIsAllowed() {
  const restore = stubPrismaDefaults();
  try {
    stubInlineArticleUsage(ContentStatus.PUBLISHED);
    const result = await canLoadMediaAnonymously(activeMedia());
    assert.equal(result, true, "a media asset used only inline inside a PUBLISHED Article's contentJson must be publicly loadable");
  } finally {
    restore();
  }
}

async function testDraftArticleInlineUsageIsDenied() {
  const restore = stubPrismaDefaults();
  try {
    // MediaUsage row exists, but the Article it points at is DRAFT — count() over LIVE_CONTENT statuses returns 0.
    prisma.mediaUsage.findMany = (async () => [
      { entityType: MediaEntityType.ARTICLE, entityId: "article-1" },
    ]) as unknown as typeof prisma.mediaUsage.findMany;
    prisma.article.count = (async () => 0) as unknown as typeof prisma.article.count;
    const result = await canLoadMediaAnonymously(activeMedia());
    assert.equal(result, false, "a MediaUsage row pointing at a DRAFT (non-live) Article must not grant public access");
  } finally {
    restore();
  }
}

async function testRemovedUsageIsDeniedUnlessAnotherLinkageExists() {
  const restore = stubPrismaDefaults();
  try {
    // No MediaUsage rows at all (as if the usage row was removed by a sync) and no other linkage anywhere.
    prisma.mediaUsage.findMany = (async () => []) as unknown as typeof prisma.mediaUsage.findMany;
    const result = await canLoadMediaAnonymously(activeMedia());
    assert.equal(result, false, "no MediaUsage row and no direct cover/seo/logo linkage means no public access");
  } finally {
    restore();
  }
}

async function testRemovedUsageStillAllowedViaAnotherValidLinkage() {
  const restore = stubPrismaDefaults();
  try {
    // No MediaUsage row for this asset, but it is directly the Article's cover — a separate, independent linkage path.
    prisma.article.findFirst = (async (args: { where: { OR: Array<{ coverImageId?: string; seoImageId?: string }> } }) => {
      const matchesCover = args.where.OR.some((clause) => clause.coverImageId === "media-1");
      return matchesCover ? { id: "article-1" } : null;
    }) as unknown as typeof prisma.article.findFirst;
    const result = await canLoadMediaAnonymously(activeMedia());
    assert.equal(result, true, "an asset with no MediaUsage row can still be public via a direct coverImageId linkage");
  } finally {
    restore();
  }
}

async function testCoverBehaviorUnchanged() {
  const restore = stubPrismaDefaults();
  try {
    // Zero MediaUsage rows anywhere — cover visibility must not depend on MediaUsage at all.
    prisma.article.findFirst = (async (args: { where: { OR: Array<{ coverImageId?: string; seoImageId?: string }> } }) => {
      const matches = args.where.OR.some((clause) => clause.coverImageId === "media-cover" || clause.seoImageId === "media-cover");
      return matches ? { id: "article-1" } : null;
    }) as unknown as typeof prisma.article.findFirst;
    const result = await canLoadMediaAnonymously(activeMedia({ id: "media-cover" }));
    assert.equal(result, true, "Article.coverImageId/seoImageId direct linkage keeps working exactly as before this fix");
  } finally {
    restore();
  }
}

async function testUnlinkedMigratedAssetRemainsDenied() {
  const restore = stubPrismaDefaults();
  try {
    // ACTIVE, no MediaUsage row, no cover/seo/logo/place-image linkage — sourceType/lineage/uploader are irrelevant to this gate by design.
    const result = await canLoadMediaAnonymously(activeMedia({ id: "media-orphan" }));
    assert.equal(result, false, "an ACTIVE MediaAsset with real WordPress lineage but zero live entity linkage must stay denied — provenance alone never grants public access");
  } finally {
    restore();
  }
}

async function main() {
  await testPublishedArticleInlineUsageIsAllowed();
  await testDraftArticleInlineUsageIsDenied();
  await testRemovedUsageIsDeniedUnlessAnotherLinkageExists();
  await testRemovedUsageStillAllowedViaAnotherValidLinkage();
  await testCoverBehaviorUnchanged();
  await testUnlinkedMigratedAssetRemainsDenied();
  console.log("mediaPublicAccess tests: OK");
}

main().catch((error) => {
  console.error("mediaPublicAccess tests: FAILED", error);
  process.exitCode = 1;
});
