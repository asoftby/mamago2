/**
 * Integration test for branding-asset handling in `canLoadMediaAnonymously()`
 * (mediaPublicAccess.ts) and `recalculateMediaUsageStatus()`
 * (media.service.ts). Both files start with `import "server-only"`, whose
 * default export unconditionally throws outside Next's server-component
 * graph — `--conditions=react-server` makes Node resolve `server-only`'s
 * `react-server` export condition (a no-op) instead, the same trick
 * `pnpm test:branding-media-asset-usage` already wires in via NODE_OPTIONS.
 * Requires DATABASE_URL:
 *   set -a; source .env; set +a
 *   NODE_OPTIONS=--conditions=react-server npx tsx src/server/media/brandingMediaAssetUsage.test.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { MediaAssetStatus } from "@prisma/client";
import { canLoadMediaAnonymously } from "./mediaPublicAccess";
import { recalculateMediaUsageStatus } from "@/server/services/media/media.service";

async function createMediaAsset(status: MediaAssetStatus) {
  const key = randomUUID();
  return prisma.mediaAsset.create({
    data: {
      kind: "IMAGE",
      status,
      filename: `${key}.jpg`,
      originalName: `${key}.jpg`,
      mimeType: "image/jpeg",
      extension: "jpg",
      sizeBytes: 1024,
      storageKey: `test/branding-media-asset-usage/${key}.jpg`,
      sourceType: "ADMIN_UPLOAD",
    },
  });
}

/** Creates a BrandingConfig row (test-only id, never the real "singleton" row) referencing the given asset as logo. */
async function createBrandingConfigFor(mediaId: string) {
  return prisma.brandingConfig.create({
    data: { id: `test-branding-config-${randomUUID()}`, logoAssetId: mediaId },
  });
}

async function main() {
  console.log("Starting branding media asset usage tests...");

  const cleanupMediaIds: string[] = [];
  const cleanupBrandingConfigIds: string[] = [];
  const cleanupUsageIds: string[] = [];

  try {
    // 1. ORPHANED branding asset, still linked via BrandingConfig:
    //    anonymous load allowed; recalculation corrects it to ACTIVE.
    const orphanedBranding = await createMediaAsset(MediaAssetStatus.ORPHANED);
    cleanupMediaIds.push(orphanedBranding.id);
    const orphanedBrandingConfig = await createBrandingConfigFor(orphanedBranding.id);
    cleanupBrandingConfigIds.push(orphanedBrandingConfig.id);

    assert.strictEqual(
      await canLoadMediaAnonymously(orphanedBranding),
      true,
      "ORPHANED branding asset must remain publicly loadable",
    );
    const recalculatedOrphanedBranding = await recalculateMediaUsageStatus(orphanedBranding.id);
    assert.strictEqual(
      recalculatedOrphanedBranding.status,
      MediaAssetStatus.ACTIVE,
      "ORPHANED branding asset must be corrected to ACTIVE by recalculation",
    );

    // 2. ARCHIVED branding asset, still linked via BrandingConfig:
    //    anonymous load denied; recalculation leaves status=ARCHIVED.
    //    (P1 regression caught by review on this PR — archiving is a
    //    deliberate admin decision the branding exception must never undo.)
    const archivedBranding = await createMediaAsset(MediaAssetStatus.ARCHIVED);
    cleanupMediaIds.push(archivedBranding.id);
    const archivedBrandingConfig = await createBrandingConfigFor(archivedBranding.id);
    cleanupBrandingConfigIds.push(archivedBrandingConfig.id);

    assert.strictEqual(
      await canLoadMediaAnonymously(archivedBranding),
      false,
      "ARCHIVED branding asset must stay private despite the BrandingConfig FK",
    );
    const recalculatedArchivedBranding = await recalculateMediaUsageStatus(archivedBranding.id);
    assert.strictEqual(
      recalculatedArchivedBranding.status,
      MediaAssetStatus.ARCHIVED,
      "Recalculation must never move an ARCHIVED branding asset back to ACTIVE",
    );

    // 3. ACTIVE branding asset: anonymous load allowed (unchanged happy path).
    const activeBranding = await createMediaAsset(MediaAssetStatus.ACTIVE);
    cleanupMediaIds.push(activeBranding.id);
    const activeBrandingConfig = await createBrandingConfigFor(activeBranding.id);
    cleanupBrandingConfigIds.push(activeBrandingConfig.id);

    assert.strictEqual(
      await canLoadMediaAnonymously(activeBranding),
      true,
      "ACTIVE branding asset must be publicly loadable",
    );
    const recalculatedActiveBranding = await recalculateMediaUsageStatus(activeBranding.id);
    assert.strictEqual(
      recalculatedActiveBranding.status,
      MediaAssetStatus.ACTIVE,
      "Already-ACTIVE branding asset with zero usages must stay ACTIVE",
    );

    // 4. Regular (non-branding) media assets keep their prior behavior:
    //    zero usages -> ORPHANED, has usage -> ACTIVE, and no free pass on
    //    canLoadMediaAnonymously without ACTIVE status + published linkage.
    const regularAssetNoUsage = await createMediaAsset(MediaAssetStatus.ACTIVE);
    cleanupMediaIds.push(regularAssetNoUsage.id);
    const regularAssetWithUsage = await createMediaAsset(MediaAssetStatus.ORPHANED);
    cleanupMediaIds.push(regularAssetWithUsage.id);
    const usage = await prisma.mediaUsage.create({
      data: {
        mediaId: regularAssetWithUsage.id,
        entityType: "ARTICLE",
        entityId: `test-entity-${randomUUID()}`,
        field: "coverImageId",
      },
    });
    cleanupUsageIds.push(usage.id);

    const recalculatedNoUsage = await recalculateMediaUsageStatus(regularAssetNoUsage.id);
    assert.strictEqual(
      recalculatedNoUsage.status,
      MediaAssetStatus.ORPHANED,
      "Regular media asset with zero usages must still become ORPHANED",
    );

    const recalculatedWithUsage = await recalculateMediaUsageStatus(regularAssetWithUsage.id);
    assert.strictEqual(
      recalculatedWithUsage.status,
      MediaAssetStatus.ACTIVE,
      "Regular media asset with a usage must still become ACTIVE",
    );

    const regularLoadable = await canLoadMediaAnonymously(regularAssetNoUsage);
    assert.strictEqual(
      regularLoadable,
      false,
      "Regular ORPHANED media asset with no published linkage must stay non-loadable (fail-closed, unchanged)",
    );

    console.log("All branding media asset usage tests passed.");
  } finally {
    if (cleanupUsageIds.length > 0) {
      await prisma.mediaUsage.deleteMany({ where: { id: { in: cleanupUsageIds } } }).catch(() => {});
    }
    if (cleanupBrandingConfigIds.length > 0) {
      await prisma.brandingConfig.deleteMany({ where: { id: { in: cleanupBrandingConfigIds } } }).catch(() => {});
    }
    if (cleanupMediaIds.length > 0) {
      await prisma.mediaAsset.deleteMany({ where: { id: { in: cleanupMediaIds } } });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
