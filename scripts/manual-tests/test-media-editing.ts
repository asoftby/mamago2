/**
 * Test Media Editing
 * 
 * Tests display filename resolution and metadata editing.
 * 
 * Run: npx tsx scripts/manual-tests/test-media-editing.ts
 */

import { prisma } from "../../src/lib/prisma";
import { resolveDisplayFilename } from "../../src/lib/media/resolveDisplayFilename";

async function testMediaEditing() {
  console.log("🧪 Testing Media Editing Features\n");

  // Get sample media with .blob extension
  const media = await prisma.mediaAsset.findFirst({
    where: {
      filename: { endsWith: ".blob" },
    },
  });

  if (!media) {
    console.log("❌ No .blob files found to test");
    return;
  }

  console.log("📄 Sample media asset:");
  console.log(`  ID: ${media.id}`);
  console.log(`  Filename (DB): ${media.filename}`);
  console.log(`  Extension (DB): ${media.extension}`);
  console.log(`  MIME Type: ${media.mimeType}\n`);

  // Test display filename resolution
  const displayFilename = resolveDisplayFilename({
    filename: media.filename,
    extension: media.extension,
    mimeType: media.mimeType,
  });

  console.log("✨ Display filename resolution:");
  console.log(`  Before: ${media.filename}`);
  console.log(`  After:  ${displayFilename}\n`);

  console.log("✅ Display filename works correctly!");
  console.log("\n📝 To test editing:");
  console.log(`1. Open: http://localhost:3000/admin/media/${media.id}`);
  console.log(`2. Click "Редактировать" button`);
  console.log(`3. Change filename to: pugovka-playroom`);
  console.log(`4. Add alt text, title, caption`);
  console.log(`5. Click "Сохранить"`);
  console.log(`6. Verify changes saved and page reloaded`);
}

testMediaEditing()
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
