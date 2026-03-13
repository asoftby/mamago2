/**
 * Backfill Media Library
 * 
 * Migrates existing media files into the MediaAsset registry.
 * Creates MediaAsset records and MediaUsage mappings.
 * 
 * Run: npx tsx scripts/backfill-media-library.ts
 */

import { prisma } from "../src/lib/prisma";
import { MediaAssetKind, MediaSourceType, MediaEntityType } from "@prisma/client";

async function backfillMediaLibrary() {
  console.log("🎬 Starting media library backfill...\n");

  let created = 0;
  let skipped = 0;
  let usagesCreated = 0;

  // 1. Backfill PlaceImage (logo and gallery)
  console.log("📍 Processing Place images...");
  const placeImages = await prisma.placeImage.findMany({
    include: {
      place: {
        select: {
          id: true,
          ownerUserId: true,
        },
      },
    },
  });

  for (const img of placeImages) {
    try {
      // Check if already exists
      const existing = await prisma.mediaAsset.findUnique({
        where: { storageKey: img.url },
      });

      if (existing) {
        skipped++;
        
        // Ensure usage exists
        const usageExists = await prisma.mediaUsage.findFirst({
          where: {
            mediaId: existing.id,
            entityType: MediaEntityType.PLACE,
            entityId: img.placeId,
          },
        });

        if (!usageExists) {
          await prisma.mediaUsage.create({
            data: {
              mediaId: existing.id,
              entityType: MediaEntityType.PLACE,
              entityId: img.placeId,
              field: img.kind === "LOGO" ? "logo" : "gallery",
            },
          });
          usagesCreated++;
        }

        continue;
      }

      // Extract filename from URL
      const filename = img.url.split("/").pop() || img.url;
      const extension = filename.split(".").pop() || "";

      // Create MediaAsset
      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          kind: MediaAssetKind.IMAGE,
          filename,
          originalName: filename,
          mimeType: `image/${extension}`,
          extension,
          sizeBytes: 0, // Unknown for migrated files
          width: img.width,
          height: img.height,
          storageKey: img.url,
          publicUrl: img.url,
          sourceType: MediaSourceType.MIGRATED,
          uploadedById: img.place.ownerUserId,
        },
      });

      // Create MediaUsage
      await prisma.mediaUsage.create({
        data: {
          mediaId: mediaAsset.id,
          entityType: MediaEntityType.PLACE,
          entityId: img.placeId,
          field: img.kind === "LOGO" ? "logo" : "gallery",
        },
      });

      created++;
      usagesCreated++;
    } catch (error: any) {
      console.error(`Error processing PlaceImage ${img.id}:`, error.message);
    }
  }

  console.log(`✅ Place images: ${created} created, ${skipped} skipped\n`);

  // 2. Backfill Activity coverImageUrl
  console.log("🎯 Processing Activity covers...");
  const activities = await prisma.activity.findMany({
    where: {
      coverImageUrl: {
        not: null,
      },
    },
    select: {
      id: true,
      coverImageUrl: true,
      createdBy: true,
    },
  });

  let activityCreated = 0;
  let activitySkipped = 0;

  for (const activity of activities) {
    if (!activity.coverImageUrl) continue;

    try {
      const existing = await prisma.mediaAsset.findUnique({
        where: { storageKey: activity.coverImageUrl },
      });

      if (existing) {
        activitySkipped++;

        const usageExists = await prisma.mediaUsage.findFirst({
          where: {
            mediaId: existing.id,
            entityType: MediaEntityType.EVENT,
            entityId: activity.id,
          },
        });

        if (!usageExists) {
          await prisma.mediaUsage.create({
            data: {
              mediaId: existing.id,
              entityType: MediaEntityType.EVENT,
              entityId: activity.id,
              field: "cover",
            },
          });
          usagesCreated++;
        }

        continue;
      }

      const filename = activity.coverImageUrl.split("/").pop() || activity.coverImageUrl;
      const extension = filename.split(".").pop() || "";

      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          kind: MediaAssetKind.IMAGE,
          filename,
          originalName: filename,
          mimeType: `image/${extension}`,
          extension,
          sizeBytes: 0,
          storageKey: activity.coverImageUrl,
          publicUrl: activity.coverImageUrl,
          sourceType: MediaSourceType.MIGRATED,
          uploadedById: activity.createdBy,
        },
      });

      await prisma.mediaUsage.create({
        data: {
          mediaId: mediaAsset.id,
          entityType: MediaEntityType.EVENT,
          entityId: activity.id,
          field: "cover",
        },
      });

      activityCreated++;
      usagesCreated++;
    } catch (error: any) {
      console.error(`Error processing Activity ${activity.id}:`, error.message);
    }
  }

  console.log(`✅ Activity covers: ${activityCreated} created, ${activitySkipped} skipped\n`);

  // 3. Backfill Offer coverImage
  console.log("🎁 Processing Offer covers...");
  const offers = await prisma.offer.findMany({
    where: {
      coverImage: {
        not: null,
      },
    },
    select: {
      id: true,
      coverImage: true,
      placeId: true,
      place: {
        select: {
          ownerUserId: true,
        },
      },
    },
  });

  let offerCreated = 0;
  let offerSkipped = 0;

  for (const offer of offers) {
    if (!offer.coverImage) continue;

    try {
      const existing = await prisma.mediaAsset.findUnique({
        where: { storageKey: offer.coverImage },
      });

      if (existing) {
        offerSkipped++;

        const usageExists = await prisma.mediaUsage.findFirst({
          where: {
            mediaId: existing.id,
            entityType: MediaEntityType.OFFER,
            entityId: offer.id,
          },
        });

        if (!usageExists) {
          await prisma.mediaUsage.create({
            data: {
              mediaId: existing.id,
              entityType: MediaEntityType.OFFER,
              entityId: offer.id,
              field: "cover",
            },
          });
          usagesCreated++;
        }

        continue;
      }

      const filename = offer.coverImage.split("/").pop() || offer.coverImage;
      const extension = filename.split(".").pop() || "";

      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          kind: MediaAssetKind.IMAGE,
          filename,
          originalName: filename,
          mimeType: `image/${extension}`,
          extension,
          sizeBytes: 0,
          storageKey: offer.coverImage,
          publicUrl: offer.coverImage,
          sourceType: MediaSourceType.MIGRATED,
          uploadedById: offer.place.ownerUserId,
        },
      });

      await prisma.mediaUsage.create({
        data: {
          mediaId: mediaAsset.id,
          entityType: MediaEntityType.OFFER,
          entityId: offer.id,
          field: "cover",
        },
      });

      offerCreated++;
      usagesCreated++;
    } catch (error: any) {
      console.error(`Error processing Offer ${offer.id}:`, error.message);
    }
  }

  console.log(`✅ Offer covers: ${offerCreated} created, ${offerSkipped} skipped\n`);

  // Summary
  console.log("📊 Backfill Summary:");
  console.log(`- Total MediaAssets created: ${created + activityCreated + offerCreated}`);
  console.log(`- Total MediaAssets skipped: ${skipped + activitySkipped + offerSkipped}`);
  console.log(`- Total MediaUsages created: ${usagesCreated}`);
  console.log("\n✅ Backfill complete!");
}

backfillMediaLibrary()
  .catch((error) => {
    console.error("❌ Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
