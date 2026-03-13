/**
 * Repair Media Metadata
 * 
 * Fixes broken metadata in MediaAsset records:
 * - Repairs "blob" extensions
 * - Attempts to recover real file sizes
 * - Fixes generic MIME types
 * 
 * Run: npx tsx scripts/repair-media-metadata.ts
 */

import { prisma } from "../src/lib/prisma";
import { extractExtension } from "../src/lib/media/extractExtension";
import { stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function repairMediaMetadata() {
  console.log("🔧 Starting media metadata repair...\n");

  let extensionFixed = 0;
  let sizeFixed = 0;
  let mimeFixed = 0;
  let skipped = 0;

  // Find media with broken metadata
  const brokenMedia = await prisma.mediaAsset.findMany({
    where: {
      OR: [
        { extension: "blob" },
        { extension: "tmp" },
        { mimeType: "image/blob" },
        { mimeType: "application/octet-stream" },
      ],
    },
  });

  console.log(`Found ${brokenMedia.length} media assets with broken metadata\n`);

  for (const media of brokenMedia) {
    console.log(`Processing ${media.id} (${media.filename})...`);
    
    const updates: any = {};
    let needsUpdate = false;

    // 1. Fix extension and MIME type using file command
    if ((media.extension === "blob" || media.extension === "tmp" || !media.extension) && 
        media.publicUrl?.startsWith("/uploads/")) {
      const filepath = join(process.cwd(), "public", media.publicUrl);
      
      if (existsSync(filepath)) {
        try {
          // Detect MIME type using file command
          const { stdout } = await execAsync(`file --mime-type -b "${filepath}"`);
          const detectedMime = stdout.trim();
          
          // Map MIME to extension
          const mimeToExt: Record<string, string> = {
            "image/webp": "webp",
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/gif": "gif",
            "image/avif": "avif",
            "image/svg+xml": "svg",
            "video/mp4": "mp4",
            "video/webm": "webm",
            "application/pdf": "pdf",
          };
          
          if (mimeToExt[detectedMime]) {
            updates.extension = mimeToExt[detectedMime];
            needsUpdate = true;
            extensionFixed++;
            console.log(`  ✓ Extension: ${media.extension} → ${mimeToExt[detectedMime]}`);
          }
          
          // Update MIME type if it was wrong
          if (media.mimeType !== detectedMime) {
            updates.mimeType = detectedMime;
            needsUpdate = true;
            mimeFixed++;
            console.log(`  ✓ MIME: ${media.mimeType} → ${detectedMime}`);
          }
        } catch (error) {
          console.log(`  ✗ Could not detect file type`);
        }
      } else {
        console.log(`  ✗ File not found: ${filepath}`);
      }
    }

    // 2. Fix size (try to get from filesystem)
    if ((media.sizeBytes === 0 || !media.sizeBytes) && media.publicUrl?.startsWith("/uploads/")) {
      const filepath = join(process.cwd(), "public", media.publicUrl);
      
      if (existsSync(filepath)) {
        try {
          const stats = await stat(filepath);
          updates.sizeBytes = stats.size;
          needsUpdate = true;
          sizeFixed++;
          console.log(`  ✓ Size: ${media.sizeBytes || 0} → ${stats.size} bytes`);
        } catch (error) {
          console.log(`  ✗ Could not stat file`);
        }
      }
    }

    // 3. Fix MIME type (if not already fixed above)
    if (!updates.mimeType && (media.mimeType === "application/octet-stream" || !media.mimeType)) {
      // Try to infer from extension
      const ext = updates.extension || media.extension;
      
      const extToMime: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        avif: "image/avif",
        gif: "image/gif",
        svg: "image/svg+xml",
        mp4: "video/mp4",
        webm: "video/webm",
        pdf: "application/pdf",
      };

      if (ext && extToMime[ext.toLowerCase()]) {
        updates.mimeType = extToMime[ext.toLowerCase()];
        needsUpdate = true;
        mimeFixed++;
        console.log(`  ✓ MIME: ${media.mimeType} → ${updates.mimeType}`);
      }
    }

    // Apply updates
    if (needsUpdate) {
      await prisma.mediaAsset.update({
        where: { id: media.id },
        data: updates,
      });
      console.log(`  ✅ Updated\n`);
    } else {
      skipped++;
      console.log(`  ⊘ No fixes available\n`);
    }
  }

  console.log("📊 Repair Summary:");
  console.log(`- Extensions fixed: ${extensionFixed}`);
  console.log(`- Sizes fixed: ${sizeFixed}`);
  console.log(`- MIME types fixed: ${mimeFixed}`);
  console.log(`- Skipped (no fixes): ${skipped}`);
  console.log("\n✅ Repair complete!");
}

repairMediaMetadata()
  .catch((error) => {
    console.error("❌ Repair failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
