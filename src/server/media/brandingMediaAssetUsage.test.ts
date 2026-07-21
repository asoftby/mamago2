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

async function main() {
  console.log("Starting branding media asset usage tests...");

  const brandingAsset = await createMediaAsset(MediaAssetStatus.ORPHANED);
  const brandingConfig = await prisma.brandingConfig.create({
    data: { id: `test-branding-config-${randomUUID()}`, logoAssetId: brandingAsset.id },
  });
  const regularAssetNoUsage = await createMediaAsset(MediaAssetStatus.ACTIVE);
  const regularAssetWithUsage = await createMediaAsset(MediaAssetStatus.ORPHANED);
  const usage = await prisma.mediaUsage.create({
    data: {
      mediaId: regularAssetWithUsage.id,
      entityType: "ARTICLE",
      entityId: `test-entity-${randomUUID()}`,
      field: "coverImageId",
    },
  });

  try {
    // 1. Branding asset stays publicly loadable even without ACTIVE status
    //    or any published linkage — the whole point of the fix.
    const brandingLoadable = await canLoadMediaAnonymously(brandingAsset);
    assert.strictEqual(brandingLoadable, true, "Branding asset (ORPHANED, no linkage) must remain publicly loadable");

    // 2. Branding asset must never be flipped to ORPHANED by usage-based
    //    recalculation, and must be corrected back to ACTIVE if it drifted.
    const recalculatedBranding = await recalculateMediaUsageStatus(brandingAsset.id);
    assert.strictEqual(
      recalculatedBranding.status,
      MediaAssetStatus.ACTIVE,
      "Branding asset must be corrected to ACTIVE, never left/set to ORPHANED",
    );

    const alreadyActiveBranding = await createMediaAsset(MediaAssetStatus.ACTIVE);
    const brandingConfig2 = await prisma.brandingConfig.create({
      data: { id: `test-branding-config-${randomUUID()}`, faviconAssetId: alreadyActiveBranding.id },
    });
    try {
      const recalculatedActiveBranding = await recalculateMediaUsageStatus(alreadyActiveBranding.id);
      assert.strictEqual(
        recalculatedActiveBranding.status,
        MediaAssetStatus.ACTIVE,
        "Already-ACTIVE branding asset with zero usages must stay ACTIVE, not become ORPHANED",
      );
    } finally {
      await prisma.brandingConfig.delete({ where: { id: brandingConfig2.id } });
      await prisma.mediaAsset.delete({ where: { id: alreadyActiveBranding.id } });
    }

    // 3. Regular (non-branding) media assets keep their prior behavior:
    //    zero usages -> ORPHANED, has usage -> ACTIVE, and no free pass on
    //    canLoadMediaAnonymously without ACTIVE status + published linkage.
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
    await prisma.mediaUsage.delete({ where: { id: usage.id } }).catch(() => {});
    await prisma.brandingConfig.delete({ where: { id: brandingConfig.id } }).catch(() => {});
    await prisma.mediaAsset.deleteMany({
      where: { id: { in: [brandingAsset.id, regularAssetNoUsage.id, regularAssetWithUsage.id] } },
    });
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
